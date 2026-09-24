'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Mail,
  Phone,
  Shield,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

const ROLES = [
  {
    role: 'OWNER',
    name: 'Company Owner / Director',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    desc: 'Unrestricted access to all company finances, projects, settings & deletion.',
  },
  {
    role: 'MANAGER',
    name: 'Project / General Manager',
    badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    desc: 'Manage projects, sites, budgets, worker directories & approving work.',
  },
  {
    role: 'SITE_SUPERVISOR',
    name: 'Site Supervisor / Engineer',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    desc: 'Daily muster roll, attendance mark, daily material usage & work logs.',
  },
  {
    role: 'ACCOUNTANT',
    name: 'Chief Accountant / Cashier',
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    desc: 'Financial payments, khata ledger, wage settlements & site expenses.',
  },
  {
    role: 'LABOUR',
    name: 'Field Labour / Worker',
    badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    desc: 'Self-service view only: Check own attendance history, wages, and received payments.',
  },
];

export default function UsersAndRolesPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'SITE_SUPERVISOR',
    mobile: '',
    password: 'password123',
  });

  const [editFormData, setEditFormData] = useState({
    name: '',
    role: 'SITE_SUPERVISOR',
    mobile: '',
    status: 'ACTIVE',
  });

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to add user');
        setIsSubmitting(false);
        return;
      }
      setIsAddModalOpen(false);
      setFormData({
        name: '',
        email: '',
        role: 'SITE_SUPERVISOR',
        mobile: '',
        password: 'password123',
      });
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setError('');
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update user');
        setIsSubmitting(false);
        return;
      }
      setIsEditModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove team member '${name}'?`)) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchUsers();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to remove user');
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-amber-500" />
            Users, Staff & Role Permissions (RBAC)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage organization users, field supervisors, accountants and granular access controls
          </p>
        </div>

        <Button
          onClick={() => {
            setError('');
            setIsAddModalOpen(true);
          }}
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs"
        >
          <UserPlus className="w-4 h-4 mr-1.5" />
          Add Team Member
        </Button>
      </div>

      {/* Role Descriptions Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {ROLES.map((r) => (
          <div key={r.role} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${r.badge}`}>
                {r.role}
              </span>
              <Shield className="w-4 h-4 text-slate-500" />
            </div>
            <h2 className="text-xs font-bold text-slate-200 mt-2">{r.name}</h2>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{r.desc}</p>
          </div>
        ))}
      </div>

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3">Contact</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Joined Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-500">
                    Loading team members...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    No team members found.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const roleConfig = ROLES.find((r) => r.role === u.role) || ROLES[2];
                  return (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-100">{u.name}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-500" /> {u.email}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${roleConfig.badge}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        {u.mobile ? (
                          <div className="flex items-center gap-1 font-mono text-[11px]">
                            <Phone className="w-3 h-3 text-slate-500" /> {u.mobile}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400">
                        {new Date(u.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            title="Edit Role & Profile"
                            onClick={() => {
                              setSelectedUser(u);
                              setEditFormData({
                                name: u.name,
                                role: u.role,
                                mobile: u.mobile || '',
                                status: u.status,
                              });
                              setError('');
                              setIsEditModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {u.role !== 'OWNER' && (
                            <button
                              title="Delete User"
                              onClick={() => handleDeleteUser(u.id, u.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD USER MODAL */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Team Member"
        description="Invite staff with role-based permissions (RBAC)"
        size="md"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Full Name *
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Anand Kulkarni"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Email Address *
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="anand@company.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Role & Permissions *
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="SITE_SUPERVISOR">Site Supervisor (Daily attendance & consumption)</option>
              <option value="ACCOUNTANT">Accountant (Payments, Khata ledger, Expenses)</option>
              <option value="LABOUR">Field Labour (View own attendance & payment records)</option>
              <option value="MANAGER">Manager (Projects, sites, workers, approvals)</option>
              <option value="OWNER">Owner (Unrestricted administrator)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Mobile Number (Optional)
            </label>
            <Input
              value={formData.mobile}
              onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
              placeholder="+91 98765 43210"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Temporary Password *
            </label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="At least 6 characters"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold">
              {isSubmitting ? 'Creating...' : 'Create Account'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* EDIT USER MODAL */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Team Member: ${selectedUser?.name}`}
        description="Update permissions and active status"
        size="md"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Full Name *
            </label>
            <Input
              value={editFormData.name}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Role & Permissions
            </label>
            <select
              value={editFormData.role}
              onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="SITE_SUPERVISOR">Site Supervisor</option>
              <option value="ACCOUNTANT">Accountant</option>
              <option value="LABOUR">Field Labour</option>
              <option value="MANAGER">Manager</option>
              <option value="OWNER">Owner</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Status
            </label>
            <select
              value={editFormData.status}
              onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Mobile Number
            </label>
            <Input
              value={editFormData.mobile}
              onChange={(e) => setEditFormData({ ...editFormData, mobile: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold">
              {isSubmitting ? 'Updating...' : 'Update Member'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
