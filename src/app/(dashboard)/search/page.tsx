'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  Building2,
  Users,
  Package,
  Truck,
  Receipt,
  ArrowRight,
  IndianRupee,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatINR } from '@/lib/calculations';

export default function SearchResultsPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const performSearch = async (term: string) => {
    if (!term.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      performSearch(initialQuery);
    }
  }, [initialQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
  };

  const results = data?.results || {
    projects: [],
    workers: [],
    materials: [],
    suppliers: [],
    expenses: [],
  };

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2.5">
          <Search className="w-7 h-7 text-amber-500" />
          Global Search
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Search across all construction projects, workers, material inventory, vendors & expenses
        </p>
      </div>

      <form onSubmit={handleSearchSubmit} className="relative max-w-2xl">
        <Search className="w-5 h-5 text-slate-500 absolute left-3.5 top-3" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by code, worker name, material, client..."
          className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-sm rounded-xl pl-11 pr-24 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
        />
        <button
          type="submit"
          className="absolute right-2 top-2 px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition"
        >
          Search
        </button>
      </form>

      {isLoading ? (
        <div className="p-10 text-center text-slate-500">Searching SaaS database...</div>
      ) : data ? (
        <div className="space-y-6">
          <div className="text-xs text-slate-400">
            Found <strong>{data.totalCount}</strong> matching records for "{data.query}"
          </div>

          {/* 1. Projects */}
          {results.projects.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-400" /> Projects ({results.projects.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {results.projects.map((p: any) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="p-3 bg-slate-950 border border-slate-800 hover:border-amber-500/40 rounded-lg flex items-center justify-between group transition"
                  >
                    <div>
                      <div className="font-bold text-slate-100 group-hover:text-amber-400 transition">{p.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{p.projectCode} • Value: {formatINR(p.projectValue)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={p.status} />
                      <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 2. Workers */}
          {results.workers.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" /> Workers ({results.workers.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {results.workers.map((w: any) => (
                  <Link
                    key={w.id}
                    href={`/workers/${w.id}`}
                    className="p-3 bg-slate-950 border border-slate-800 hover:border-emerald-500/40 rounded-lg flex items-center justify-between group transition"
                  >
                    <div>
                      <div className="font-bold text-slate-100 group-hover:text-emerald-400 transition">{w.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{w.workerCode} • {w.category} • ₹{w.dailyWage}/day</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 3. Materials */}
          {results.materials.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-sky-400" /> Materials Inventory ({results.materials.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {results.materials.map((m: any) => (
                  <Link
                    key={m.id}
                    href={`/materials`}
                    className="p-3 bg-slate-950 border border-slate-800 hover:border-sky-500/40 rounded-lg flex items-center justify-between group transition"
                  >
                    <div>
                      <div className="font-bold text-slate-100 group-hover:text-sky-400 transition">{m.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{m.materialCode} • {m.category} • ₹{m.purchaseRate}/{m.unit}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-0.5 transition" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 4. Suppliers */}
          {results.suppliers.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                <Truck className="w-4 h-4 text-purple-400" /> Suppliers & Vendors ({results.suppliers.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {results.suppliers.map((s: any) => (
                  <Link
                    key={s.id}
                    href={`/materials/suppliers`}
                    className="p-3 bg-slate-950 border border-slate-800 hover:border-purple-500/40 rounded-lg flex items-center justify-between group transition"
                  >
                    <div>
                      <div className="font-bold text-slate-100 group-hover:text-purple-400 transition">{s.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{s.contactPerson || 'Contact'} • {s.mobile || 'No phone'}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-0.5 transition" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 5. Expenses */}
          {results.expenses.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-rose-400" /> Site Expenses ({results.expenses.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {results.expenses.map((e: any) => (
                  <Link
                    key={e.id}
                    href={`/finance/expenses`}
                    className="p-3 bg-slate-950 border border-slate-800 hover:border-rose-500/40 rounded-lg flex items-center justify-between group transition"
                  >
                    <div>
                      <div className="font-bold text-slate-100 group-hover:text-rose-400 transition">{e.description}</div>
                      <div className="text-[11px] text-slate-500 font-mono">Category: {e.category} • Vendor: {e.vendorName || 'Direct'}</div>
                    </div>
                    <div className="font-bold font-mono text-rose-400 text-sm">
                      ₹{e.amount.toLocaleString('en-IN')}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {data.totalCount === 0 && (
            <div className="p-10 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-400">
              No results found matching "{data.query}". Try searching with another term.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
