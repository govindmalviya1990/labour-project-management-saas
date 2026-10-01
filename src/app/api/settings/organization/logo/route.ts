import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireOrg } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

// Allowed image MIME types
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];

// Forbidden file extensions that might be executable or dangerous
const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.sh', '.php', '.phtml', '.js', '.mjs',
  '.html', '.htm', '.xhtml', '.vbs', '.py', '.rb', '.jar', '.com', '.msi'
];

/**
 * Validates file buffer magic bytes and sanitized MIME type.
 */
function detectAndValidateImage(buffer: Buffer, fileName: string, clientMime: string): { valid: boolean; mime: string; error?: string } {
  // Check extension against dangerous extensions
  const lowerName = fileName.toLowerCase();
  for (const ext of DANGEROUS_EXTENSIONS) {
    if (lowerName.endsWith(ext)) {
      return { valid: false, mime: '', error: `Executable or dangerous file extension '${ext}' is strictly forbidden.` };
    }
  }

  // 1. PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, mime: 'image/png' };
  }

  // 2. JPEG magic bytes: FF D8 FF
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { valid: true, mime: 'image/jpeg' };
  }

  // 3. WebP magic bytes: 'RIFF' at 0..3 and 'WEBP' at 8..11
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { valid: true, mime: 'image/webp' };
  }

  // 4. SVG validation & sanitization
  const headerSlice = buffer.slice(0, 1000).toString('utf8').trim().toLowerCase();
  if (
    (headerSlice.includes('<svg') || headerSlice.startsWith('<?xml')) &&
    (clientMime === 'image/svg+xml' || lowerName.endsWith('.svg'))
  ) {
    const svgText = buffer.toString('utf8');

    // Strict security scan: Reject any scripts, external entities, foreignObjects, or event handlers
    const dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /<foreignobject\b[^<]*(?:(?!<\/foreignobject>)<[^<]*)*<\/foreignobject>/gi,
      /javascript:/gi,
      /data:\s*text\/html/gi,
      /\bon[a-z]+\s*=/gi, // onclick, onload, onerror, etc.
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(svgText)) {
        return {
          valid: false,
          mime: '',
          error: 'SVG contains executable scripts or event handlers. For security reasons, this file was rejected.',
        };
      }
    }

    if (!svgText.includes('<svg')) {
      return { valid: false, mime: '', error: 'Invalid SVG file structure.' };
    }

    return { valid: true, mime: 'image/svg+xml' };
  }

  return {
    valid: false,
    mime: '',
    error: 'Invalid file format. Only PNG, JPG/JPEG, WebP, and clean SVG are allowed.',
  };
}

export async function POST(req: Request) {
  try {
    const session = await requireOrg();

    // STRICT OWNER CHECK: Only OWNER can upload company logo
    if (session.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Forbidden: Only OWNER can upload or change the company logo.' },
        { status: 403 }
      );
    }

    const orgId = session.organizationId;
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded. Please select an image.' }, { status: 400 });
    }

    // Size limit verification
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds 2 MB limit (Current: ${(file.size / (1024 * 1024)).toFixed(2)} MB).` },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Sanitize filename: remove directory traversal and non-safe characters
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Verify magic bytes & MIME type
    const validation = detectAndValidateImage(buffer, safeFileName, file.type);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error || 'Invalid file type.' }, { status: 400 });
    }

    // Convert to base64 Data URI
    let dataUri = '';
    if (validation.mime === 'image/svg+xml') {
      // Clean SVG string
      const cleanSvg = buffer.toString('utf8');
      dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(cleanSvg)}`;
    } else {
      dataUri = `data:${validation.mime};base64,${buffer.toString('base64')}`;
    }

    // Fetch previous logo for audit log
    const prevOrg = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { logoUrl: true },
    });

    // Update Organization logoUrl
    const updatedOrg = await prisma.organization.update({
      where: { id: orgId },
      data: { logoUrl: dataUri },
      select: { id: true, name: true, logoUrl: true },
    });

    // Write Audit Log
    try {
      await prisma.auditLog.create({
        data: {
          organizationId: orgId,
          userId: session.userId,
          entityType: 'Organization',
          entityId: orgId,
          action: 'UPDATE',
          oldValue: JSON.stringify({ logoUrl: prevOrg?.logoUrl ? 'existing_logo' : null }),
          newValue: JSON.stringify({ logoUrl: 'new_logo_uploaded', mime: validation.mime, size: file.size }),
        },
      });
    } catch (auditErr) {
      console.warn('Failed to write logo audit log:', auditErr);
    }

    return NextResponse.json({
      success: true,
      logoUrl: updatedOrg.logoUrl,
      message: 'Company logo uploaded and saved successfully!',
    });
  } catch (error: any) {
    console.error('Logo upload error:', error);
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (error.message === 'NO_ORGANIZATION') {
      return NextResponse.json({ error: 'No active organization found' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to upload logo: ' + (error.message || 'Internal error') }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireOrg();

    // STRICT OWNER CHECK: Only OWNER can remove company logo
    if (session.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Forbidden: Only OWNER can remove the company logo.' },
        { status: 403 }
      );
    }

    const orgId = session.organizationId;

    const prevOrg = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { logoUrl: true },
    });

    const updatedOrg = await prisma.organization.update({
      where: { id: orgId },
      data: { logoUrl: null },
      select: { id: true, name: true, logoUrl: true },
    });

    // Write Audit Log
    try {
      await prisma.auditLog.create({
        data: {
          organizationId: orgId,
          userId: session.userId,
          entityType: 'Organization',
          entityId: orgId,
          action: 'DELETE',
          oldValue: JSON.stringify({ logoUrl: prevOrg?.logoUrl ? 'existing_logo' : null }),
          newValue: JSON.stringify({ logoUrl: null }),
        },
      });
    } catch (auditErr) {
      console.warn('Failed to write logo audit log:', auditErr);
    }

    return NextResponse.json({
      success: true,
      logoUrl: null,
      message: 'Company logo removed. Reverted to default branding.',
    });
  } catch (error: any) {
    console.error('Logo delete error:', error);
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (error.message === 'NO_ORGANIZATION') {
      return NextResponse.json({ error: 'No active organization found' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to remove logo: ' + (error.message || 'Internal error') }, { status: 500 });
  }
}
