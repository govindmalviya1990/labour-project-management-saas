'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Layers, AlertCircle } from 'lucide-react';

interface SiteFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: string;
  initialData?: any;
}

export function SiteFormModal({
  isOpen,
  onClose,
  onSuccess,
  projectId,
  initialData,
}: SiteFormModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    address: '',
    supervisorName: '',
    supervisorMobile: '',
    notes: '',
  });

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        location: initialData.location || '',
        address: initialData.address || '',
        supervisorName: initialData.supervisorName || '',
        supervisorMobile: initialData.supervisorMobile || '',
        notes: initialData.notes || '',
      });
    } else {
      setFormData({
        name: '',
        location: '',
        address: '',
        supervisorName: '',
        supervisorMobile: '',
        notes: '',
      });
    }
    setError('');
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Site name is required (e.g. Tower A, Block 1)');
      return;
    }

    setIsLoading(true);

    try {
      const url = initialData
        ? `/api/projects/${projectId}/sites/${initialData.id}`
        : `/api/projects/${projectId}/sites`;
      const method = initialData ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Failed to save site');
        setIsLoading(false);
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Project Site' : 'Add New Project Site / Section'}
      description="Create a site, tower, or wing to track localized attendance, work, expenses, and materials."
      maxWidth="md"
    >
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Site / Tower Name"
          required
          placeholder="e.g. Tower B, Basement, Wing 2"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          leftIcon={<Layers className="w-4 h-4 text-amber-500" />}
        />

        <Input
          label="Location / Floor Details"
          placeholder="North-West Wing, Floors 1-14"
          value={formData.location}
          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
        />

        <Input
          label="Site Supervisor Name"
          placeholder="Sonu Yadav"
          value={formData.supervisorName}
          onChange={(e) => setFormData({ ...formData, supervisorName: e.target.value })}
        />

        <Input
          label="Supervisor Mobile Number"
          type="tel"
          placeholder="+91 9876543212"
          value={formData.supervisorMobile}
          onChange={(e) => setFormData({ ...formData, supervisorMobile: e.target.value })}
        />

        <Input
          label="Notes / Instructions"
          placeholder="Specific site guidelines or milestone notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        />

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" isLoading={isLoading}>
            {initialData ? 'Update Site' : 'Add Site'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
