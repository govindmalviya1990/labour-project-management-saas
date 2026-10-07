/**
 * Utility functions for recording and extracting material verification details
 * when a site supervisor verifies and approves material received at a construction site.
 */

export interface VerificationInfo {
  isVerified: boolean;
  verifierName: string;
  role: string;
  verifiedAt: string | null;
  receivedQty: string | null;
  remarks: string;
  displayDate: string;
}

/**
 * Format a structured verification note to be saved in MaterialUsage and MaterialReceipt.
 */
export function formatVerificationNote({
  verifierName,
  role,
  receivedQty,
  unit,
  remarks,
}: {
  verifierName: string;
  role: string;
  receivedQty: number;
  unit?: string;
  remarks?: string;
}): string {
  const now = new Date().toISOString();
  const cleanRemarks = remarks?.trim() || 'Physical stock verified and received in good condition at site.';
  const qtyStr = unit ? `${receivedQty} ${unit}` : `${receivedQty}`;
  const cleanRole = role || 'SITE_SUPERVISOR';
  const cleanName = verifierName?.trim() || 'Site Supervisor';
  return `[VERIFIED_BY: ${cleanName} | ROLE: ${cleanRole} | AT: ${now} | QTY: ${qtyStr}] ${cleanRemarks}`;
}

/**
 * Extract verification details from notes or fallback user objects.
 */
export function extractVerificationInfo(notes?: string | null, fallbackUser?: any): VerificationInfo | null {
  if (!notes && !fallbackUser) return null;

  // Format 1: [VERIFIED_BY: Name | ROLE: Role | AT: IsoDate | QTY: 50] Remarks
  const tagMatch = notes?.match(/\[VERIFIED_BY:\s*([^|]+)\|\s*ROLE:\s*([^|]+)\|\s*AT:\s*([^|]+)(?:\|\s*QTY:\s*([^\]]+))?\]\s*(.*)/i);
  if (tagMatch) {
    const rawDate = tagMatch[3].trim();
    let displayDate = rawDate;
    try {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        displayDate = d.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    } catch (_) {}

    return {
      isVerified: true,
      verifierName: tagMatch[1].trim(),
      role: normalizeRoleLabel(tagMatch[2].trim()),
      verifiedAt: rawDate,
      receivedQty: tagMatch[4] ? tagMatch[4].trim() : null,
      remarks: tagMatch[5]?.trim() || '',
      displayDate,
    };
  }

  // Format 2: [VERIFIED: Received 50 Bags by Ramesh on 08/10/2026] Remarks
  const legacyMatch = notes?.match(/\[VERIFIED:\s*Received\s*(.+?)\s*by\s*(.+?)\s*on\s*([^\]]+)\]\s*(.*)/i);
  if (legacyMatch) {
    return {
      isVerified: true,
      verifierName: legacyMatch[2].trim(),
      role: 'Site Supervisor',
      verifiedAt: legacyMatch[3].trim(),
      receivedQty: legacyMatch[1].trim(),
      remarks: legacyMatch[4]?.trim() || '',
      displayDate: legacyMatch[3].trim(),
    };
  }

  // Format 3: notes mentions "Verified & Approved at site by supervisor: Name (Role)"
  const mentionMatch = notes?.match(/Verified & Approved at site by supervisor:\s*([^(]+)(?:\(([^)]+)\))?/i);
  if (mentionMatch) {
    return {
      isVerified: true,
      verifierName: mentionMatch[1].trim(),
      role: normalizeRoleLabel(mentionMatch[2]?.trim() || 'SITE_SUPERVISOR'),
      verifiedAt: null,
      receivedQty: null,
      remarks: notes || '',
      displayDate: '',
    };
  }

  // Format 4: Fallback user (e.g. purchasedBy on MaterialReceipt)
  if (fallbackUser && fallbackUser.name) {
    return {
      isVerified: true,
      verifierName: fallbackUser.name,
      role: 'Direct Inward / Staff',
      verifiedAt: null,
      receivedQty: null,
      remarks: notes || '',
      displayDate: '',
    };
  }

  return null;
}

function normalizeRoleLabel(rawRole: string): string {
  const r = rawRole.toUpperCase().trim();
  if (r === 'SITE_SUPERVISOR') return 'Site Supervisor';
  if (r === 'OWNER') return 'Owner / Admin';
  if (r === 'PARTNER') return 'Project Partner';
  if (r === 'MANAGER') return 'Project Manager';
  if (r === 'ACCOUNTANT') return 'Accountant';
  return rawRole;
}
