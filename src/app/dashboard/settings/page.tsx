'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Plus, Pencil, Trash } from 'lucide-react';
import { getCurrentUser, supabase } from '@/lib/supabase';

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [fontScale, setFontScale] = useState<number>(1);
  const [phases, setPhases] = useState<Array<{ id: number; term: number; half: number; code: string; start_date: string | null; end_date: string | null }>>([]);
  const [loadingPhases, setLoadingPhases] = useState(false);
  const [newTerm, setNewTerm] = useState<string>("");
  const [newHalf, setNewHalf] = useState<'' | '1' | '2'>("");

  useEffect(() => {
    (async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
          router.push('/auth/login');
          return;
        }
        setUser(currentUser);

        // Load previously saved preference from localStorage
        if (typeof window !== 'undefined') {
          const saved = Number(localStorage.getItem('font-scale') || '1');
          if (!Number.isNaN(saved) && saved > 0.75 && saved < 1.75) {
            setFontScale(saved);
            document.documentElement.style.setProperty('--font-scale', String(saved));
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const updateScale = (value: number) => {
    const clamped = Math.min(1.6, Math.max(0.8, Number(value)));
    setFontScale(clamped);
    if (typeof window !== 'undefined') {
      document.documentElement.style.setProperty('--font-scale', String(clamped));
      localStorage.setItem('font-scale', String(clamped));
    }
  };

  const loadPhases = async () => {
    setLoadingPhases(true);
    try {
      const { data } = await supabase
        .from('phases')
        .select('id, term, half, code, start_date, end_date')
        .order('term', { ascending: false })
        .order('half', { ascending: false });
      setPhases((data as any) || []);
    } finally {
      setLoadingPhases(false);
    }
  };

  useEffect(() => {
    loadPhases();
  }, []);

  const handleNewPhase = async () => {
    // Determine next phase: if latest is .2 → create next year .1, else same year .2
    let nextTerm: number;
    let nextHalf: number;
    if (phases.length > 0) {
      const latest = [...phases].sort((a,b)=> a.term===b.term ? a.half-b.half : a.term-b.term).pop()!;
      if (latest.half === 2) {
        nextTerm = latest.term + 1;
        nextHalf = 1;
      } else {
        nextTerm = latest.term;
        nextHalf = 2;
      }
    } else {
      const y = new Date().getFullYear();
      nextTerm = y;
      nextHalf = 1;
    }
    const { error } = await supabase.from('phases').insert({ term: nextTerm, half: nextHalf });
    if (!error) await loadPhases();
  };

  const handleUpdateDates = async (id: number, start: string | null, end: string | null) => {
    const { error } = await supabase.from('phases').update({ start_date: start, end_date: end }).eq('id', id);
    if (!error) await loadPhases();
  };

  const handleDeletePhase = async (id: number) => {
    if (!confirm('Delete this phase?')) return;
    const { error } = await supabase.from('phases').delete().eq('id', id);
    if (!error) await loadPhases();
  };

  const handleUpdateTermHalf = async (id: number, nextTerm: number, nextHalf: number) => {
    const cleanHalf = nextHalf === 1 ? 1 : 2;
    const { error } = await supabase.from('phases').update({ term: nextTerm, half: cleanHalf }).eq('id', id);
    if (!error) await loadPhases();
  };

  const handleAddSpecificPhase = async () => {
    if (!newTerm || !newHalf) return;
    const termNum = Number(newTerm);
    const halfNum = Number(newHalf) === 2 ? 2 : 1;
    const { error } = await supabase.from('phases').insert({ term: termNum, half: halfNum });
    if (!error) {
      setNewTerm("");
      setNewHalf("");
      await loadPhases();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <img src="/giphy.gif" alt="Loading..." className="h-24 w-24 object-contain" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-bl from-[#f3f4f6] to-[#e5e7eb]">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={() => window.dispatchEvent(new Event('sidebar:toggle'))}
              className="p-2 rounded-md hover:bg-gray-100 text-gray-700"
              aria-label="Toggle sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M3.75 5.25a.75.75 0 01.75-.75h15a.75.75 0 010 1.5h-15a.75.75 0 01-.75-.75zm0 6a.75.75 0 01.75-.75h15a.75.75 0 010 1.5h-15a.75.75 0 01-.75-.75zm.75 5.25a.75.75 0 000 1.5h15a.75.75 0 000-1.5h-15z" clipRule="evenodd" /></svg>
            </button>
            <Settings className="h-5 w-5 sm:h-6 sm:w-6 text-gray-700" />
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">Settings</h1>
          </div>
        </div>
      </header>

      <main className="p-3 sm:p-4 md:p-6 max-w-3xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 sm:p-4 md:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Font size</h2>
          <p className="text-sm text-gray-600 mb-4">Adjust the overall font size across the app.</p>

          <div className="flex items-center gap-2 sm:gap-4">
            <input
              type="range"
              min={0.8}
              max={1.6}
              step={0.05}
              value={fontScale}
              onChange={(e) => updateScale(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="w-24 text-right text-sm text-gray-700">
              {(fontScale * 100).toFixed(0)}%
            </div>
          </div>

          <div className="mt-4 flex gap-1 sm:gap-2 flex-wrap">
            {[0.9, 1, 1.1, 1.2, 1.3].map((v) => (
              <button
                key={v}
                onClick={() => updateScale(v)}
                className={`px-2 sm:px-3 py-1 rounded-md border text-sm ${fontScale === v ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                {(v * 100).toFixed(0)}%
              </button>
            ))}
          </div>
        </div>

        {/* Admin-only: Phases management */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 sm:p-4 md:p-6 mt-4 sm:mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Phases</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="number"
                  value={newTerm}
                  onChange={(e)=>setNewTerm(e.target.value)}
                  placeholder="Term (e.g. 2024)"
                  className="w-32 sm:w-40 border border-gray-300 rounded px-2 py-1 text-sm"
                />
                <select
                  value={newHalf}
                  onChange={(e)=>setNewHalf(e.target.value as any)}
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="">Half</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                </select>
                <button onClick={handleAddSpecificPhase} className="inline-flex items-center bg-gray-100 text-gray-700 px-2 sm:px-3 py-2 rounded-md hover:bg-gray-200 text-sm">Add specific</button>
              </div>
              <button onClick={handleNewPhase} className="inline-flex items-center bg-primary text-white px-2 sm:px-3 py-2 rounded-md hover:brightness-95 text-sm">
                <Plus className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">New phase</span><span className="sm:hidden">New</span>
              </button>
            </div>
          </div>
          {loadingPhases ? (
            <div>Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-gray-900">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2">Code</th>
                    <th className="text-left py-2 px-2">Term</th>
                    <th className="text-left py-2 px-2">Half</th>
                    <th className="text-left py-2 px-2">Start</th>
                    <th className="text-left py-2 px-2">End</th>
                    <th className="text-left py-2 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {phases.map(p => (
                    <tr key={p.id} className="border-b border-gray-100">
                      <td className="py-2 px-2 font-medium">{p.code}</td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          defaultValue={p.term}
                          onBlur={(e)=>{
                            const val = Number(e.target.value)||p.term;
                            if (val!==p.term) handleUpdateTermHalf(p.id, val, p.half);
                          }}
                          className="w-32 border border-gray-300 rounded px-2 py-1"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <select
                          defaultValue={String(p.half)}
                          onChange={(e)=> handleUpdateTermHalf(p.id, p.term, Number(e.target.value)===2?2:1)}
                          className="border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="1">1</option>
                          <option value="2">2</option>
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="date"
                          defaultValue={p.start_date ?? ''}
                          onBlur={(e) => handleUpdateDates(p.id, e.target.value || null, p.end_date)}
                          className="border border-gray-300 rounded px-2 py-1"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="date"
                          defaultValue={p.end_date ?? ''}
                          onBlur={(e) => handleUpdateDates(p.id, p.start_date, e.target.value || null)}
                          className="border border-gray-300 rounded px-2 py-1"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <button onClick={() => handleDeletePhase(p.id)} className="p-2 text-red-600 hover:text-red-700">
                          <Trash className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


