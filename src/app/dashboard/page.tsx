'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  BarChart3, 
  Users, 
  TrendingUp, 
  Settings, 
  LogOut, 
  Search,
  Bell,
  User,
  FileText,
  Target,
  Activity
} from 'lucide-react';
import { getCurrentUser, signOut, supabase } from '@/lib/supabase';
import MultiSelect from '@/components/MultiSelect';

interface LCStats {
  lc: string;
  total_forms: number;
  ye_count: number;
  apd_count: number;
  re_count: number;
  _yourUtm?: number;
  _emt?: number;
  _organic?: number;
  _other?: number;
  _notFound?: number;
}

interface SimpleCount {
  lc: string;
  count: number;
}

interface SummaryRow {
  lc: string;
  goal: number;
  total: number; // SUs | market (total)
  msu: number;   // unique by phone/email
  yourUtm: number; // SUs | utm source (utm_source matches LC)
  emtPlusOrganic: number; // EMT + Organic
  otherSource: number;    // has UTM but utm_source belongs to others (not LC, not EMT)
  notFound: number;       // has UTM but missing utm_source (not EMT)
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [lcStats, setLcStats] = useState<LCStats[]>([]);
  const [lcGoals, setLcGoals] = useState<Record<string, number>>({});
  const [totalStats, setTotalStats] = useState({
    totalForms: 0,
    totalYE: 0,
    totalAPD: 0,
    totalRE: 0
  });
  const [nationalByLc, setNationalByLc] = useState<SimpleCount[]>([]);
  const [organicByLc, setOrganicByLc] = useState<SimpleCount[]>([]);
  const [nationalTotal, setNationalTotal] = useState(0);
  const [organicTotal, setOrganicTotal] = useState(0);
  const [localSummary, setLocalSummary] = useState<SummaryRow[]>([]);
  const [localTotals, setLocalTotals] = useState<SummaryRow | null>(null);
  const [nationalSummary, setNationalSummary] = useState<Array<{ label: string; count: number }>>([]);
  const [termFilter, setTermFilter] = useState<string>(''); // comma-separated years
  const [phaseFilter, setPhaseFilter] = useState<string>(''); // comma-separated codes
  const [phaseRanges, setPhaseRanges] = useState<Array<{ code: string; start: string | null; end: string | null }>>([]);
  const [phasesMeta, setPhasesMeta] = useState<Array<{ code: string; term: number; half: number; start: string | null; end: string | null }>>([]);
  const [allSubmissionsState, setAllSubmissionsState] = useState<any[]>([]);
  const [displayedTotals, setDisplayedTotals] = useState({ totalForms: 0, totalYE: 0, totalAPD: 0, totalRE: 0 });
  const [utmLinksByLc, setUtmLinksByLc] = useState<Record<string, string[]>>({});
  const [universityMap, setUniversityMap] = useState<Map<string, string>>(new Map());
  const [summarySort, setSummarySort] = useState<{ column: 'msu' | 'total' | null; direction: 'asc' | 'desc' }>({ column: null, direction: 'desc' });
  const [comparePhaseFilter, setComparePhaseFilter] = useState<string>('');
  const [compareMsuByPhase, setCompareMsuByPhase] = useState<Record<string, Record<string, number>>>({});
  const [compareTotalsByPhase, setCompareTotalsByPhase] = useState<Record<string, number>>({});
  const [compareLoading, setCompareLoading] = useState<boolean>(false);

  // Helper functions for calculations
  const calculateProgress = (total: number, goal: number) => {
    if (goal === 0) return 0;
    return (total / goal) * 100;
  };

  const calculatePercentage = (numerator: number, denominator: number) => {
    if (denominator === 0) return 0;
    return (numerator / denominator) * 100;
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `${rank}.`;
  };

  useEffect(() => {
    checkUser();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.profile-dropdown')) {
        setProfileDropdownOpen(false);
      }
    };

    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileDropdownOpen]);

  // Load UTM links when component mounts
  useEffect(() => {
    if (user) {
      loadUtmLinks();
    }
  }, [user]);

  const loadUtmLinks = async () => {
    try {
      // First, let's check what columns exist in the utm_links table
      const { data: tableInfo, error: tableError } = await supabase
        .from('utm_links')
        .select('*')
        .limit(1);
      
      if (tableError) {
        console.error('Error checking table structure:', tableError);
        setUtmLinksByLc({});
        return;
      }

      // Try to get all data first to see what columns exist
      const { data: utmLinks, error } = await supabase
        .from('utm_links')
        .select('*');
      
      if (error) {
        console.error('Error loading UTM links:', error);
        // Set empty object if table doesn't exist or has permission issues
        setUtmLinksByLc({});
        return;
      }
      
      const linksByLc: Record<string, string[]> = {};
      if (utmLinks && Array.isArray(utmLinks)) {
        for (const link of utmLinks) {
          
                      // Try different possible column names
            const lcCode = link.entity_code || link.lc_code || link.lc || link.local_committee || link.entity;
            const utmLink = link.url || link.utm_link || link.utm || link.link;
          
          if (lcCode && utmLink) {
            const lcCodeStr = String(lcCode);
            const utmLinkStr = String(utmLink);
            if (!linksByLc[lcCodeStr]) {
              linksByLc[lcCodeStr] = [];
            }
            linksByLc[lcCodeStr].push(utmLinkStr);
          }
        }
      }
      
      setUtmLinksByLc(linksByLc);
    } catch (error) {
      console.error('Error loading UTM links:', error);
      // Set empty object on error
      setUtmLinksByLc({});
    }
  };

  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.push('/auth/login');
        return;
      }

      // Get user profile to check role
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      setUser(currentUser);
      setUserProfile(profile);
      
      if (profile) {
        await loadFormStats();
        try {
          const { data: phases } = await supabase
            .from('phases')
            .select('term, half, code, start_date, end_date')
            .order('term', { ascending: false })
            .order('half', { ascending: false });
          setPhaseRanges((phases as any[] || []).map(p => ({ code: String(p.code), start: p.start_date ?? null, end: p.end_date ?? null })));
          setPhasesMeta((phases as any[] || []).map(p => ({ code: String(p.code), term: Number(p.term), half: Number(p.half), start: p.start_date ?? null, end: p.end_date ?? null })));
        } catch {}
      }
    } catch (error) {
      console.error('Error checking user:', error);
      router.push('/auth/login');
    } finally {
      setLoading(false);
    }
  };

  // Recompute stats when filters change using cached submissions
  useEffect(() => {
    if (!allSubmissionsState || allSubmissionsState.length === 0) return;
    (async () => {
      const lcData: { [key: string]: LCStats } = {};
      const nationalMap: Record<string, number> = {};
      const organicMap: Record<string, number> = {};

      const getVal = (obj: any, keys: string[]): any => {
        for (const k of keys) {
          const v = obj?.[k];
          if (v !== undefined && v !== null && String(v).trim() !== '') return v;
        }
        return '';
      };

      const matchesTerm = (s: any) => {
        if (!termFilter) return true;
        try {
          const y = new Date(s.timestamp).getUTCFullYear();
          const set = new Set(termFilter.split(',').filter(Boolean));
          return set.has(String(y));
        } catch { return true; }
      };
      const matchesPhase = (s: any) => {
        if (!phaseFilter) return true;
        const codes = new Set(phaseFilter.split(',').filter(Boolean));
        return phaseRanges.some(range => {
          if (!codes.has(range.code) || !range.start || !range.end) return false;
          const t = new Date(s.timestamp).getTime();
          return t >= new Date(range.start).getTime() && t <= new Date(range.end).getTime();
        });
      };

      const filtered = allSubmissionsState.filter((s:any) => matchesTerm(s) && matchesPhase(s));

      filtered.forEach((submission: any) => {
        let lc = submission.allocated_lc || 'Organic';
        
        
        // Debug: Check Other allocations

        const form = submission?.form_data || {};
        const utm_source = getVal(submission, ['utm_source']) || getVal(form, ['utm_source', 'utmSource']);
        const utm_term = (getVal(submission, ['utm_term']) || getVal(form, ['utm_term', 'utmTerm'])).toString();
        const hasAnyUtm = [utm_source, getVal(submission, ['utm_medium']), getVal(submission, ['utm_campaign']), getVal(submission, ['utm_id']), getVal(submission, ['utm_content']), getVal(submission, ['utm_name']), utm_term].some(v => v && String(v).trim() !== '');
        // Check if UTM term matches registered EMT UTM links
        const emtUtmLinks = utmLinksByLc['EMT'] || [];
        const isNational = !!utm_term && emtUtmLinks.some(link => 
          String(utm_term).toLowerCase().includes(String(link).toLowerCase())
        );
        const isOrganic = !submission.allocated_lc || submission.allocated_lc === 'Organic';
        // Check if UTM source matches any registered UTM links for this LC
        const registeredUtmLinks = utmLinksByLc[lc] || [];
        const isYourUtm = !!utm_source && registeredUtmLinks.some(link => 
          String(utm_source).toLowerCase().includes(String(link).toLowerCase())
        );
        const hasUtmSource = !!utm_source && String(utm_source).trim() !== '';

        if (!lcData[lc]) lcData[lc] = { lc, total_forms: 0, ye_count: 0, apd_count: 0, re_count: 0 };
        lcData[lc].total_forms++;
        if (submission.Demand === 'YE') lcData[lc].ye_count++;
        if (submission.Demand === 'APD') lcData[lc].apd_count++;
        if (submission.Demand === 'RE') lcData[lc].re_count++;
        if (isNational) nationalMap[lc] = (nationalMap[lc] || 0) + 1;
        if (isOrganic) organicMap[lc] = (organicMap[lc] || 0) + 1;

        const row = (lcData as any)[lc] as any;
        row._yourUtm = (row._yourUtm || 0) + (isYourUtm ? 1 : 0);
        row._emt = (row._emt || 0) + (isNational ? 1 : 0);
        row._organic = (row._organic || 0) + (isOrganic ? 1 : 0);
        const isOther = hasAnyUtm && !isYourUtm && !isNational && hasUtmSource;
        row._other = (row._other || 0) + (isOther ? 1 : 0);
        const isNotFound = hasAnyUtm && !isNational && !hasUtmSource;
        row._notFound = (row._notFound || 0) + (isNotFound ? 1 : 0);
      });

             const sortedStats = Object.values(lcData)
         .filter(stat => stat.lc !== 'Organic')
         .sort((a, b) => b.total_forms - a.total_forms);
      
      
      setLcStats(sortedStats);
      // Calculate totals including Organic
      const allStats = Object.values(lcData);
      const totals = allStats.reduce((acc, stat) => ({
        totalForms: acc.totalForms + stat.total_forms,
        totalYE: acc.totalYE + stat.ye_count,
        totalAPD: acc.totalAPD + stat.apd_count,
        totalRE: acc.totalRE + stat.re_count
      }), { totalForms: 0, totalYE: 0, totalAPD: 0, totalRE: 0 });
      setTotalStats(totals);

      const nationalArr: SimpleCount[] = Object.entries(nationalMap).map(([lc, count]) => ({ lc, count })).sort((a, b) => b.count - a.count);
      const organicArr: SimpleCount[] = Object.entries(organicMap).map(([lc, count]) => ({ lc, count })).sort((a, b) => b.count - a.count);
      setNationalByLc(nationalArr);
      setOrganicByLc(organicArr);
      setNationalTotal(nationalArr.reduce((s, r) => s + r.count, 0));
      // Calculate total organic forms from all LCs
      const totalOrganicForms = Object.values(organicMap).reduce((sum, count) => sum + count, 0);
      setOrganicTotal(totalOrganicForms);

      // Goals per filters (phase(s) > term(s) sum > latest term when none)
      let goalsByLc: Record<string, number> = { FHN: 0, Hanoi: 0, NEU: 0, Danang: 0, FHCMC: 0, HCMC: 0, HCME: 0, HCMS: 0, Cantho: 0, EMT: 0, Organic: 0 };
      try {
        if (phaseFilter) {
          const codes = phaseFilter.split(',').filter(Boolean);
          const { data: goalRowsPhase } = await supabase.from('lc_goals_phase').select('lc_code, goal, phase_code').in('phase_code', codes as any);
          if (goalRowsPhase) for (const r of goalRowsPhase as any[]) goalsByLc[String(r.lc_code)] = (goalsByLc[String(r.lc_code)] || 0) + (Number(r.goal) || 0);
        } else if (termFilter) {
          const years = new Set(termFilter.split(',').filter(Boolean));
          const target = phasesMeta.filter(p => years.has(String(p.term))).map(p => p.code);
          if (target.length > 0) {
            const { data: goalRowsPhases } = await supabase.from('lc_goals_phase').select('lc_code, goal, phase_code').in('phase_code', target as any);
            if (goalRowsPhases) for (const r of goalRowsPhases as any[]) goalsByLc[String(r.lc_code)] = (goalsByLc[String(r.lc_code)] || 0) + (Number(r.goal) || 0);
          }
        } else {
          // default to latest term, but for EMT, try to find any available goal
          const latestTerm = phasesMeta.reduce((max, p) => Math.max(max, Number(p.term) || 0), 0);
          const latestCodes = phasesMeta.filter(p => Number(p.term) === latestTerm).map(p => p.code);
          if (latestCodes.length > 0) {
            const { data: goalRowsLatest } = await supabase.from('lc_goals_phase').select('lc_code, goal, phase_code').in('phase_code', latestCodes as any);
            if (goalRowsLatest) for (const r of goalRowsLatest as any[]) goalsByLc[String(r.lc_code)] = (goalsByLc[String(r.lc_code)] || 0) + (Number(r.goal) || 0);
          }
          
          // For EMT, if no goal found in latest term, try to find any available goal
          if (goalsByLc['EMT'] === 0) {
            const { data: emtGoalsAny } = await supabase.from('lc_goals_phase').select('lc_code, goal, phase_code').eq('lc_code', 'EMT').neq('phase_code', '');
            if (emtGoalsAny && emtGoalsAny.length > 0) {
              // Use the first available EMT goal
              goalsByLc['EMT'] = Number(emtGoalsAny[0].goal) || 0;
            }
          }
          
          // For Organic, if no goal found in latest term, try to find any available goal
          if (goalsByLc['Organic'] === 0) {
            const { data: organicGoalsAny } = await supabase.from('lc_goals_phase').select('lc_code, goal, phase_code').eq('lc_code', 'Organic').neq('phase_code', '');
            if (organicGoalsAny && organicGoalsAny.length > 0) {
              // Use the first available Organic goal
              goalsByLc['Organic'] = Number(organicGoalsAny[0].goal) || 0;
            }
          }
        }
      } catch {}
    ;
      
      setLcGoals(goalsByLc);
      
      // Wait a bit to ensure goals are properly set before calculating summary
      await new Promise(resolve => setTimeout(resolve, 100));
    })();
  }, [termFilter, phaseFilter, phasesMeta, allSubmissionsState]);

  // Separate useEffect to calculate summary when goals and data are ready
  useEffect(() => {
    if (Object.keys(lcGoals).length === 0 || allSubmissionsState.length === 0) return;
  
    
    const getVal = (obj: any, keys: string[]): any => {
      for (const k of keys) {
        const v = obj?.[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') return v;
      }
      return '';
    };
    
    // Apply filters first
    const matchesTerm = (s: any) => {
      if (!termFilter) return true;
      try {
        const y = new Date(s.timestamp).getUTCFullYear();
        const set = new Set(termFilter.split(',').filter(Boolean));
        return set.has(String(y));
      } catch { return true; }
    };
    const matchesPhase = (s: any) => {
      if (!phaseFilter) return true;
      const codes = new Set(phaseFilter.split(',').filter(Boolean));
      return phaseRanges.some(range => {
        if (!codes.has(range.code) || !range.start || !range.end) return false;
        const t = new Date(s.timestamp).getTime();
        return t >= new Date(range.start).getTime() && t <= new Date(range.end).getTime();
      });
    };

    const filteredSubmissions = allSubmissionsState.filter((s:any) => matchesTerm(s) && matchesPhase(s));

    // Calculate MSUs and SUs | utm source: forms with UTM Term matching registered UTM links
    const msuByLc = new Map<string, number>();
    const utmSourceByLc = new Map<string, number>();
    const totalFormsByLc = new Map<string, number>();
    
    // First, count total forms per LC
    filteredSubmissions.forEach(submission => {
      const formData = submission.form_data || {};
      const university = getVal(formData, ['university', 'University', 'uni', 'Uni', 'other_uni', 'other_uni_2']);
      const resolvedLc = resolveLcFromUniversity(university);
      const lc = resolvedLc || submission.allocated_lc || 'Organic';
      totalFormsByLc.set(lc, (totalFormsByLc.get(lc) || 0) + 1);
    });
    
    // Calculate MSUs: Count ALL forms with UTM Term matching ANY registered UTM links
    filteredSubmissions.forEach(submission => {
      const formData = submission.form_data || {};
      
      // Get UTM Term from form data
      const utmTerm = getVal(formData, ['utm_term', 'utmTerm', 'UTM Term', 'utm term', 'term', 'Term']) || 
                     getVal(submission, ['utm_term', 'utmTerm', 'UTM Term', 'utm term', 'term', 'Term']);
      
      if (utmTerm) {
        // Check which LC this UTM Term belongs to
        Object.entries(utmLinksByLc).forEach(([lcCode, links]) => {
          const isMatchingUtm = links.some(link =>
            String(utmTerm).toLowerCase().includes(String(link).toLowerCase())
          );
          
          if (isMatchingUtm) {
            // MSUs: Count this form for the LC that owns this UTM link
            msuByLc.set(lcCode, (msuByLc.get(lcCode) || 0) + 1);
            
            // SUs | utm source: Count if this form is also allocated to this LC
            if (submission.allocated_lc === lcCode) {
              utmSourceByLc.set(lcCode, (utmSourceByLc.get(lcCode) || 0) + 1);
            }
          }
        });
      }
    });

    // Calculate EMT + Organic: forms allocated to LC but with empty UTM Term or UTM Term registered by national
    const emtOrganicByLc = new Map<string, number>();
    
    filteredSubmissions.forEach(submission => {
      const formData = submission.form_data || {};
      const utmTerm = getVal(formData, ['utm_term', 'utmTerm', 'UTM Term', 'utm term', 'term', 'Term']) || 
                     getVal(submission, ['utm_term', 'utmTerm', 'UTM Term', 'utm term', 'term', 'Term']);
      
      // Check if form is allocated to any LC
      if (submission.allocated_lc && submission.allocated_lc !== 'Other') {
        const lc = submission.allocated_lc;
        
        // Check if UTM Term is empty or belongs to national (EMT, Organic)
        const isUtmTermEmpty = !utmTerm || utmTerm.trim() === '';
        const isUtmTermNational = utmTerm && (
          utmTerm.toLowerCase().includes('emt') || 
          utmTerm.toLowerCase().includes('organic')
        );
        
        // Check if UTM Term is NOT registered by this LC
        const lcUtmLinks = utmLinksByLc[lc] || [];
        const isUtmTermNotRegisteredByLc = !utmTerm || !lcUtmLinks.some(link =>
          String(utmTerm).toLowerCase().includes(String(link).toLowerCase())
        );
        
        if (isUtmTermEmpty || isUtmTermNational || isUtmTermNotRegisteredByLc) {
          emtOrganicByLc.set(lc, (emtOrganicByLc.get(lc) || 0) + 1);
        }
      }
    });
    
    // Special debug for Danang
    const danangFormsWithUtmTerm = filteredSubmissions.filter(submission => {
      const formData = submission.form_data || {};
      const university = getVal(formData, ['university', 'University', 'uni', 'Uni', 'other_uni', 'other_uni_2']);
      const resolvedLc = resolveLcFromUniversity(university);
      const lc = resolvedLc || submission.allocated_lc || 'Organic';
      return lc === 'Danang';
    });
    const danangFormsWithMatchingUtm = danangFormsWithUtmTerm.filter(submission => {
      const formData = submission.form_data || {};
      const utmTerm = getVal(formData, ['utm_term', 'utmTerm', 'UTM Term', 'utm term', 'term', 'Term']) || 
                     getVal(submission, ['utm_term', 'utmTerm', 'UTM Term', 'utm term', 'term', 'Term']);
      const registeredUtmLinks = utmLinksByLc['Danang'] || [];
      const isMatching = !!utmTerm && registeredUtmLinks.some(link =>
        String(utmTerm).toLowerCase().includes(String(link).toLowerCase())
      );
      
      
      return isMatching;
    });
    
    // Count UTM terms for Danang
    const danangUtmTerms = new Map<string, number>();
    danangFormsWithUtmTerm.forEach(submission => {
      const formData = submission.form_data || {};
      const utmTerm = getVal(formData, ['utm_term', 'utmTerm', 'UTM Term', 'utm term', 'term', 'Term']) || 
                     getVal(submission, ['utm_term', 'utmTerm', 'UTM Term', 'utm term', 'term', 'Term']);
      if (utmTerm) {
        danangUtmTerms.set(utmTerm, (danangUtmTerms.get(utmTerm) || 0) + 1);
      }
    });
    
    // Compare MSUs with total forms for each LC
    lcStats.forEach(stat => {
      const totalForms = stat.total_forms;
      const msus = msuByLc.get(stat.lc) || 0;
      const utmSource = utmSourceByLc.get(stat.lc) || 0;
    });
    
    // Calculate summary rows with proper MSUs
    const summaryRows: SummaryRow[] = lcStats.map(stat => ({
      lc: stat.lc,
      goal: lcGoals[stat.lc] ?? 0,
      total: stat.total_forms,
      msu: msuByLc.get(stat.lc) || 0,
      yourUtm: utmSourceByLc.get(stat.lc) || 0,
      emtPlusOrganic: emtOrganicByLc.get(stat.lc) || 0,
      otherSource: Math.max(0, stat.total_forms - (utmSourceByLc.get(stat.lc) || 0) - (emtOrganicByLc.get(stat.lc) || 0)),
      notFound: 0, // Will be calculated properly later
    }));
    
    setLocalSummary(summaryRows);
    
    const totalsRow: SummaryRow = summaryRows.reduce((acc, r) => ({
      lc: 'TOTAL LOCAL',
      goal: (acc.goal || 0) + r.goal,
      total: (acc.total || 0) + r.total,
      msu: (acc.msu || 0) + r.msu,
      yourUtm: (acc.yourUtm || 0) + r.yourUtm,
      emtPlusOrganic: (acc.emtPlusOrganic || 0) + r.emtPlusOrganic,
      otherSource: (acc.otherSource || 0) + r.otherSource,
      notFound: (acc.notFound || 0) + r.notFound,
    }), { lc: 'TOTAL LOCAL', goal: 0, total: 0, msu: 0, yourUtm: 0, emtPlusOrganic: 0, otherSource: 0, notFound: 0 });
    setLocalTotals(totalsRow);

    // National summary rows (EMT, Organic)
    setNationalSummary([
      { label: 'EMT', count: nationalTotal },
      { label: 'Organic', count: organicTotal },
      { label: 'Other (not found)', count: 0 }, // Will be calculated properly later
    ]);
  }, [lcGoals, lcStats, nationalTotal, organicTotal]);

  // Animate KPI numbers when totals change
  useEffect(() => {
    const duration = 500;
    const start = performance.now();
    const from = { ...displayedTotals } as any;
    const to = { ...totalStats } as any;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const ease = t < 0.5 ? 2*t*t : -1 + (4 - 2*t) * t;
      const next = {
        totalForms: Math.round(from.totalForms + (to.totalForms - from.totalForms) * ease),
        totalYE: Math.round(from.totalYE + (to.totalYE - from.totalYE) * ease),
        totalAPD: Math.round(from.totalAPD + (to.totalAPD - from.totalAPD) * ease),
        totalRE: Math.round(from.totalRE + (to.totalRE - from.totalRE) * ease),
      };
      setDisplayedTotals(next);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalStats.totalForms, totalStats.totalYE, totalStats.totalAPD, totalStats.totalRE]);
  const loadFormStats = async () => {
    try {
      // Get all form submissions with pagination (Supabase/PostgREST defaults to 1000 rows per request)
      let allSubmissions: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: page, error } = await supabase
        .from('form_submissions')
          .select('*')
          .order('timestamp', { ascending: false })
          .range(from, from + pageSize - 1);

      if (error) throw error;

        if (page && page.length > 0) {
          allSubmissions = allSubmissions.concat(page);
          from += pageSize;
          hasMore = page.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      const submissions = allSubmissions;
      setAllSubmissionsState(submissions);

      // Process data to get LC statistics
      const lcData: { [key: string]: LCStats } = {};
      const nationalMap: Record<string, number> = {};
      const organicMap: Record<string, number> = {};

      const getVal = (obj: any, keys: string[]): any => {
        for (const k of keys) {
          const v = obj?.[k];
          if (v !== undefined && v !== null && String(v).trim() !== '') return v;
        }
        return '';
      };

      let goalsByLc: Record<string, number> = {
        FHN: 0,
        Hanoi: 0,
        NEU: 0,
        Danang: 0,
        FHCMC: 0,
        HCMC: 0,
        HCME: 0,
        HCMS: 0,
        Cantho: 0,
      };
      try {
        if (phaseFilter) {
          const codes = phaseFilter.split(',').filter(Boolean);
          const { data: goalRowsPhase } = await supabase
            .from('lc_goals_phase')
            .select('lc_code, goal, phase_code')
            .in('phase_code', codes as any);
          if (goalRowsPhase && Array.isArray(goalRowsPhase)) {
            for (const r of goalRowsPhase as any[]) {
              if (r.lc_code) goalsByLc[String(r.lc_code)] = (goalsByLc[String(r.lc_code)] || 0) + (Number(r.goal) || 0);
            }
          }
        } else if (termFilter) {
          const years = new Set(termFilter.split(',').filter(Boolean));
          const targetCodes = phasesMeta.filter(p => years.has(String(p.term))).map(p => p.code);
          if (targetCodes.length > 0) {
            const { data: goalRowsPhases } = await supabase
              .from('lc_goals_phase')
              .select('lc_code, goal, phase_code')
              .in('phase_code', targetCodes as any);
            if (goalRowsPhases && Array.isArray(goalRowsPhases)) {
              for (const r of goalRowsPhases as any[]) {
                if (r.lc_code) goalsByLc[String(r.lc_code)] = (goalsByLc[String(r.lc_code)] || 0) + (Number(r.goal) || 0);
              }
            }
          }
        } else {
          // No filters: default to latest term (highest term in phasesMeta)
          const latestTerm = phasesMeta.reduce((max, p) => Math.max(max, Number(p.term) || 0), 0);
          const latestCodes = phasesMeta.filter(p => Number(p.term) === latestTerm).map(p => p.code);
          if (latestCodes.length > 0) {
            const { data: goalRowsLatest } = await supabase
              .from('lc_goals_phase')
              .select('lc_code, goal, phase_code')
              .in('phase_code', latestCodes as any);
            if (goalRowsLatest && Array.isArray(goalRowsLatest)) {
              for (const r of goalRowsLatest as any[]) {
                if (r.lc_code) goalsByLc[String(r.lc_code)] = (goalsByLc[String(r.lc_code)] || 0) + (Number(r.goal) || 0);
              }
            }
          }
        }
      } catch (_) {}
      setLcGoals(goalsByLc);

      const lcOrder = ['FHN','Hanoi','NEU','Danang','FHCMC','HCMC','HCME','HCMS','Cantho'];

      const uniqueByLc = new Map<string, Map<string, boolean>>();

      const matchesTerm = (s: any) => {
        if (!termFilter) return true;
        try {
          const y = new Date(s.timestamp).getUTCFullYear();
          const set = new Set(termFilter.split(',').filter(Boolean));
          return set.has(String(y));
        } catch { return true; }
      };
      const matchesPhase = (s: any) => {
        if (!phaseFilter) return true;
        const codes = new Set(phaseFilter.split(',').filter(Boolean));
        return phaseRanges.some(range => {
          if (!codes.has(range.code) || !range.start || !range.end) return false;
          const t = new Date(s.timestamp).getTime();
          return t >= new Date(range.start).getTime() && t <= new Date(range.end).getTime();
        });
      };

      const filtered = (submissions || []).filter((s:any) => matchesTerm(s) && matchesPhase(s));

      filtered.forEach((submission: any) => {
        // Use allocated_lc if available, otherwise try to map from uni
        let lc = submission.allocated_lc || 'Organic';
        const form = submission?.form_data || {};
        const utm_source = getVal(submission, ['utm_source']) || getVal(form, ['utm_source', 'utmSource']);
        const utm_medium = getVal(submission, ['utm_medium']) || getVal(form, ['utm_medium', 'utmMedium']);
        const utm_campaign = getVal(submission, ['utm_campaign']) || getVal(form, ['utm_campaign', 'utmCampaign']);
        const utm_id = getVal(submission, ['utm_id']) || getVal(form, ['utm_id', 'utmId']);
        const utm_content = getVal(submission, ['utm_content']) || getVal(form, ['utm_content', 'utmContent']);
        const utm_name = getVal(submission, ['utm_name']) || getVal(form, ['utm_name', 'utmName']);
        const utm_term = (getVal(submission, ['utm_term']) || getVal(form, ['utm_term', 'utmTerm'])).toString();
        const hasAnyUtm = [utm_source, utm_medium, utm_campaign, utm_id, utm_content, utm_name, utm_term]
          .some(v => v && String(v).trim() !== '');
        // Check if UTM term matches registered EMT UTM links
        const emtUtmLinks = utmLinksByLc['EMT'] || [];
        const isNational = !!utm_term && emtUtmLinks.some(link => 
          String(utm_term).toLowerCase().includes(String(link).toLowerCase())
        );
        const isOrganic = !submission.allocated_lc || submission.allocated_lc === 'Organic';
        // Check if UTM source matches any registered UTM links for this LC
        const registeredUtmLinks = utmLinksByLc[lc] || [];
        const isYourUtm = !!utm_source && registeredUtmLinks.some(link => 
          String(utm_source).toLowerCase().includes(String(link).toLowerCase())
        );
        const hasUtmSource = !!utm_source && String(utm_source).trim() !== '';

        if (!lcData[lc]) {
          lcData[lc] = {
            lc,
            total_forms: 0,
            ye_count: 0,
            apd_count: 0,
            re_count: 0
          };
        }

        lcData[lc].total_forms++;
        
        // Count based on form fields
        if (submission.Demand === 'YE') lcData[lc].ye_count++;
        if (submission.Demand === 'APD') lcData[lc].apd_count++;
        if (submission.Demand === 'RE') lcData[lc].re_count++;

        if (isNational) {
          nationalMap[lc] = (nationalMap[lc] || 0) + 1;
        }
        if (isOrganic) {
          organicMap[lc] = (organicMap[lc] || 0) + 1;
        }

        // Build per-LC unique set by phone/email for MSU
        const key = (submission.phone || form.phone || '') || (submission.email || form.email || '');
        if (!uniqueByLc.has(lc)) uniqueByLc.set(lc, new Map());
        if (key) uniqueByLc.get(lc)!.set(String(key), true);

        // Prepare summary buckets
        // your utm
        const row = lcData[lc];
        if (row) {
          row._yourUtm = (row._yourUtm || 0) + (isYourUtm ? 1 : 0);
          // EMT + Organic counted later via totals
          row._emt = (row._emt || 0) + (isNational ? 1 : 0);
          row._organic = (row._organic || 0) + (isOrganic ? 1 : 0);
          // other source (has UTM source but not yours and not EMT)
          const isOther = hasAnyUtm && !isYourUtm && !isNational && hasUtmSource;
          row._other = (row._other || 0) + (isOther ? 1 : 0);
        }
      });

      // Convert to array and sort by total forms
      const sortedStats = Object.values(lcData)
        .sort((a, b) => b.total_forms - a.total_forms);

      setLcStats(sortedStats);

      // Calculate totals
      const totals = sortedStats.reduce((acc, stat) => ({
        totalForms: acc.totalForms + stat.total_forms,
        totalYE: acc.totalYE + stat.ye_count,
        totalAPD: acc.totalAPD + stat.apd_count,
        totalRE: acc.totalRE + stat.re_count
      }), {
        totalForms: 0,
        totalYE: 0,
        totalAPD: 0,
        totalRE: 0
      });

      setTotalStats(totals);

      // Build National and Organic arrays
      const nationalArr: SimpleCount[] = Object.entries(nationalMap)
        .map(([lc, count]) => ({ lc, count }))
        .sort((a, b) => b.count - a.count);
      const organicArr: SimpleCount[] = Object.entries(organicMap)
        .map(([lc, count]) => ({ lc, count }))
        .sort((a, b) => b.count - a.count);

      setNationalByLc(nationalArr);
      setOrganicByLc(organicArr);
      setNationalTotal(nationalArr.reduce((s, r) => s + r.count, 0));
      setOrganicTotal(organicArr.reduce((s, r) => s + r.count, 0));


    } catch (error) {
      console.error('Error loading form stats:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/auth/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const resolveLcFromUniversity = (university: string): string | null => {
    if (!university || !universityMap) return null;
    const cleanUni = String(university).trim();
    if (!cleanUni) return null;
    
    // Exact match only
    const exactMatchResult = universityMap.get(cleanUni);
    if (exactMatchResult) return exactMatchResult;
    
    return null;
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const toggleSummarySort = (column: 'msu' | 'total') => {
    setSummarySort(prev => {
      if (prev.column === column) {
        return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { column, direction: 'desc' };
    });
  };

  const sortedLocalSummary = (() => {
    if (!summarySort.column) return localSummary;
    const arr = [...localSummary];
    arr.sort((a, b) => {
      const valA = summarySort.column === 'msu' ? a.msu : a.total;
      const valB = summarySort.column === 'msu' ? b.msu : b.total;
      const diff = valA - valB;
      return summarySort.direction === 'asc' ? diff : -diff;
    });
    return arr;
  })();

  // Fetch comparison MSUs when compare phase changes
  useEffect(() => {
    const loadCompare = async () => {
      if (!comparePhaseFilter) return;
      // Exclude if compare phase is also in current phaseFilter
      const currentPhases = new Set(phaseFilter.split(',').filter(Boolean));
      if (currentPhases.has(comparePhaseFilter)) return;

      try {
        setCompareLoading(true);
        // Fetch submissions within the compare phase's date range
        const range = phaseRanges.find(p => p.code === comparePhaseFilter);
        if (!range || !range.start || !range.end) { setCompareLoading(false); return; }

        let from = 0;
        const pageSize = 1000;
        let hasMore = true;
        let compareSubs: any[] = [];
        while (hasMore) {
          const { data: page, error } = await supabase
            .from('form_submissions')
            .select('*')
            .gte('timestamp', range.start)
            .lte('timestamp', range.end)
            .order('timestamp', { ascending: false })
            .range(from, from + pageSize - 1);
          if (error) throw error;
          if (page && page.length > 0) {
            compareSubs = compareSubs.concat(page);
            from += pageSize;
            hasMore = page.length === pageSize;
          } else {
            hasMore = false;
          }
        }

        // Compute MSU per LC using registered UTM term matching
        const msuByLc: Record<string, number> = {};
        const totalCount = compareSubs.length;
        const getVal = (obj: any, keys: string[]): any => {
          for (const k of keys) {
            const v = obj?.[k];
            if (v !== undefined && v !== null && String(v).trim() !== '') return v;
          }
          return '';
        };

        compareSubs.forEach(submission => {
          const formData = submission.form_data || {};
          const utmTerm = getVal(formData, ['utm_term', 'utmTerm', 'UTM Term', 'utm term', 'term', 'Term']) || 
                          getVal(submission, ['utm_term', 'utmTerm', 'UTM Term', 'utm term', 'term', 'Term']);
          if (utmTerm) {
            Object.entries(utmLinksByLc).forEach(([lcCode, links]) => {
              const isMatchingUtm = links.some(link => String(utmTerm).toLowerCase().includes(String(link).toLowerCase()));
              if (isMatchingUtm) msuByLc[lcCode] = (msuByLc[lcCode] || 0) + 1;
            });
          }
        });

        setCompareMsuByPhase(prev => ({ ...prev, [comparePhaseFilter]: msuByLc }));
        setCompareTotalsByPhase(prev => ({ ...prev, [comparePhaseFilter]: totalCount }));
      } catch (e) {
        console.error('Error loading compare phase data', e);
      } finally {
        setCompareLoading(false);
      }
    };

    loadCompare();
  }, [comparePhaseFilter, phaseRanges, utmLinksByLc, phaseFilter]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/bg.png)' }}>
        <img src="/giphy.gif" alt="Loading..." className="h-50 w-50 object-contain" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-bl from-[#f3f4f6] to-[#e5e7eb]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-3 sm:px-4 py-3">
          {/* Left side */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={() => window.dispatchEvent(new Event('sidebar:toggle'))}
              className="p-2 rounded-md hover:bg-gray-100 text-gray-700"
              aria-label="Toggle sidebar"
            >
              {/* simple menu icon */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M3.75 5.25a.75.75 0 01.75-.75h15a.75.75 0 010 1.5h-15a.75.75 0 01-.75-.75zm0 6a.75.75 0 01.75-.75h15a.75.75 0 010 1.5h-15a.75.75 0 01-.75-.75zm.75 5.25a.75.75 0 000 1.5h15a.75.75 0 000-1.5h-15z" clipRule="evenodd" /></svg>
            </button>
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">Overall Performance</h1>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            <button className="p-2 rounded-md hover:bg-gray-100 text-gray-700 hidden sm:block">
              <Search className="h-5 w-5" />
            </button>
            <button className="p-2 rounded-md hover:bg-gray-100 relative text-gray-700 hidden sm:block">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="flex items-center space-x-2">
              <div className="relative profile-dropdown">
                <button 
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-100 transition-colors"
                >
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-gray-600" />
              </div>
              <span className="hidden lg:block text-sm font-medium text-gray-700 truncate max-w-32">
                {user?.email}
              </span>
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                    <div className="py-1">
                      <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                        <div className="font-medium">{user?.email}</div>
                        <div className="text-xs text-gray-500">Signed in</div>
                      </div>
                      <button
                        onClick={handleSignOut}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Main content; shifted by global dashboard layout when sidebar open */}
        <main className="flex-1 p-3 sm:p-4 md:p-6">
          {/* Filters: Term and Phase */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 sm:p-4 mb-4 sm:mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 items-end">
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Term (Year)</label>
                <MultiSelect
                  label="Term"
                  options={Array.from(new Set(phaseRanges.map(p => {
                    if (p.start) return new Date(p.start).getUTCFullYear();
                    if (p.end) return new Date(p.end).getUTCFullYear();
                    return null;
                  }).filter(Boolean) as number[])).sort((a,b)=> b-a).map(y => ({ label: String(y), value: String(y) }))}
                  selected={termFilter ? termFilter.split(',') : []}
                  onChange={(vals) => setTermFilter(vals.join(','))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phase</label>
                <MultiSelect
                  label="Phase"
                  options={phaseRanges.map(p => ({ label: p.code, value: p.code }))}
                  selected={phaseFilter ? phaseFilter.split(',') : []}
                  onChange={(vals) => setPhaseFilter(vals.join(','))}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-1 flex items-center">
                <button onClick={() => { setTermFilter(''); setPhaseFilter(''); }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">Reset</button>
              </div>
            </div>
          </div>
          {/* Stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Forms</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">{formatNumber(displayedTotals.totalForms)}</p>
                </div>
                <div className="p-2 sm:p-3 bg-gray-100 rounded-lg">
                  <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total YE</p>
                  <p className="text-2xl font-bold text-gray-900">{formatNumber(displayedTotals.totalYE)}</p>
                </div>
                <div className="p-3 bg-gray-100 rounded-lg">
                  <Target className="h-6 w-6 text-gray-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total APD</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">{formatNumber(displayedTotals.totalAPD)}</p>
                </div>
                <div className="p-2 sm:p-3 bg-gray-100 rounded-lg">
                  <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total RE</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">{formatNumber(displayedTotals.totalRE)}</p>
                </div>
                <div className="p-2 sm:p-3 bg-gray-100 rounded-lg">
                  <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Ranking Chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 mb-6 sm:mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 sm:mb-6">Ranking</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
              {/* Bar Chart */}
                             <div className="space-y-4">
                 {lcStats.map((stat, index) => {
                  const goal = lcGoals[stat.lc] ?? 0;
                  const denom = goal > 0 ? goal : Math.max(goal, stat.total_forms || 1);
                  const pct = Math.min(100, (stat.total_forms / denom) * 100);
                  return (
                    <div key={stat.lc} className="flex items-center space-x-4">
                      <div className="w-16 text-sm font-medium text-gray-900">{stat.lc}</div>
                      <div className="flex-1">
                        <div className="bg-gray-100 rounded-full h-6 relative">
                          <div 
                            className="bg-primary rounded-full h-6 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="w-24 text-sm font-medium text-gray-900 text-right">
                        {stat.total_forms}{goal ? ` / ${goal}` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-gray-900 border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left py-3 px-4" style={{ backgroundColor: '#037EF3', color: 'white' }}>Entity</th>
                      <th className="text-left py-3 px-4" style={{ backgroundColor: '#00c16e', color: 'white' }}>Goal</th>
                      <th className="text-left py-3 px-4" style={{ backgroundColor: '#037EF3', color: 'white' }}>#YE</th>
                      <th className="text-left py-3 px-4" style={{ backgroundColor: '#037EF3', color: 'white' }}>#APD</th>
                      <th className="text-left py-3 px-4" style={{ backgroundColor: '#037EF3', color: 'white' }}>#RE</th>
                      <th className="text-left py-3 px-4" style={{ backgroundColor: '#037EF3', color: 'white' }}>Total</th>
                    </tr>
                  </thead>
                                     <tbody>
                                         {lcStats.map((stat, index) => {
                       const getRankIcon = (rank: number) => {
                         if (rank === 1) return '🥇';
                         if (rank === 2) return '🥈';
                         if (rank === 3) return '🥉';
                         return '';
                       };
                       
                       const getTopRankStyle = (rank: number) => {
                         if (rank === 1) return { backgroundColor: '#FEF3E2', color: '#000000' }; // Hot Pink
                         if (rank === 2) return { backgroundColor: '#C4E1E6', color: '#000000' }; // Light Pink
                         if (rank === 3) return { backgroundColor: '#EEEEEE', color: '#000000' }; // Pink
                         return {};
                       };
                       
                       const isTop3 = index < 3;
                       
                       return (
                         <tr key={stat.lc} className={`border-b border-gray-200 ${!isTop3 && (index % 2 === 0 ? 'bg-white' : 'bg-gray-50')}`} style={isTop3 ? getTopRankStyle(index + 1) : {}}>
                           <td className="py-3 px-4 font-medium text-gray-900">
                             {index < 3 ? getRankIcon(index + 1) : `${index + 1}.`} {stat.lc}
                           </td>
                           <td className="py-3 px-4 font-semibold" style={{ backgroundColor: '#e8f5e8', color: '#00c16e' }}>{formatNumber(lcGoals[stat.lc] ?? 0)}</td>
                           <td className="py-3 px-4">{formatNumber(stat.ye_count)}</td>
                           <td className="py-3 px-4">{formatNumber(stat.apd_count)}</td>
                           <td className="py-3 px-4">{formatNumber(stat.re_count)}</td>
                           <td className="py-3 px-4 font-semibold" style={{ backgroundColor: '#f5f5f5', color: '#000000' }}>{formatNumber(stat.total_forms)}</td>
                      </tr>
                       );
                     })}
                    {/* Total Row */}
                    <tr style={{ backgroundColor: '#ffc845', borderTop: '2px solid #FFFFFF' }}>
                      <td className="py-3 px-4 font-bold text-gray-900" style={{ backgroundColor: '#ffc845' }}>TOTAL</td>
                      <td className="py-3 px-4 font-bold" style={{ backgroundColor: '#e8f5e8', color: '#00c16e' }}>{formatNumber(Object.values(lcGoals).reduce((a, b) => a + b, 0))}</td>
                      <td className="py-3 px-4 font-bold text-gray-900" style={{ backgroundColor: '#ffc845' }}>{formatNumber(totalStats.totalYE)}</td>
                      <td className="py-3 px-4 font-bold text-gray-900" style={{ backgroundColor: '#ffc845' }}>{formatNumber(totalStats.totalAPD)}</td>
                      <td className="py-3 px-4 font-bold text-gray-900" style={{ backgroundColor: '#ffc845' }}>{formatNumber(totalStats.totalRE)}</td>
                      <td className="py-3 px-4 font-bold" style={{ backgroundColor: '#ffc845', color: '#000000' }}>{formatNumber(totalStats.totalForms)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Signup Statistics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
            {/* By LC (Total) */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Signups by LC</h3>
                <span className="text-sm text-gray-600">Total: {formatNumber(totalStats.totalForms)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-gray-900 text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left py-2 px-3" style={{ backgroundColor: '#037EF3', color: 'white' }}>LC</th>
                      <th className="text-left py-2 px-3" style={{ backgroundColor: '#037EF3', color: 'white' }}>Signups</th>
                      <th className="text-left py-2 px-3" style={{ backgroundColor: '#00c16e', color: 'white' }}>Goal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lcStats.map((s, index) => (
                      <tr key={`lc-${s.lc}`} className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="py-2 px-3 font-medium">{s.lc}</td>
                        <td className="py-2 px-3">{formatNumber(s.total_forms)}</td>
                        <td className="py-2 px-3 font-semibold" style={{ backgroundColor: '#e8f5e8', color: '#00c16e' }}>{formatNumber(lcGoals[s.lc] ?? 0)}</td>
                      </tr>
                    ))}
                    {/* Total Row */}
                    <tr style={{ backgroundColor: '#ffc845', borderTop: '2px solid #FFFFFF' }}>
                      <td className="py-2 px-3 font-bold text-gray-900" style={{ backgroundColor: '#ffc845' }}>TOTAL</td>
                      <td className="py-2 px-3 font-bold text-gray-900" style={{ backgroundColor: '#ffc845' }}>{formatNumber(totalStats.totalForms)}</td>
                      <td className="py-2 px-3 font-bold" style={{ backgroundColor: '#e8f5e8', color: '#00c16e' }}>{formatNumber(Object.values(lcGoals).reduce((a, b) => a + b, 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* National by LC */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Signups by National</h3>
                <span className="text-sm text-gray-600">Total: {formatNumber(nationalTotal)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-gray-900 text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left py-2 px-3" style={{ backgroundColor: '#037EF3', color: 'white' }}>LC</th>
                      <th className="text-left py-2 px-3" style={{ backgroundColor: '#037EF3', color: 'white' }}>National</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nationalByLc.map((s, index) => (
                      <tr key={`national-${s.lc}`} className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="py-2 px-3 font-medium">{s.lc}</td>
                        <td className="py-2 px-3 font-semibold" style={{ backgroundColor: '#f5f5f5', color: '#000000' }}>{formatNumber(s.count)}</td>
                      </tr>
                    ))}
                    {/* Total Row */}
                    <tr style={{ backgroundColor: '#ffc845', borderTop: '2px solid #FFFFFF' }}>
                      <td className="py-2 px-3 font-bold text-gray-900" style={{ backgroundColor: '#ffc845' }}>TOTAL</td>
                      <td className="py-2 px-3 font-bold" style={{ backgroundColor: '#ffc845', color: '#000000' }}>{formatNumber(nationalTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            
          </div>

          {/* Signup Summary Matrix */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Signup Summary</h3>
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-700">Compare with</label>
                <select
                  className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                  value={comparePhaseFilter}
                  onChange={(e) => setComparePhaseFilter(e.target.value)}
                >
                  <option value="">None</option>
                  {phasesMeta
                    .map(p => p.code)
                    .filter(code => code && !new Set(phaseFilter.split(',').filter(Boolean)).has(code))
                    .map(code => (
                      <option key={code} value={code}>{code}</option>
                    ))}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-gray-900 text-sm border-collapse">
                <thead>
                  <tr>
                    <th rowSpan={2} className="text-center py-3 px-3" style={{ backgroundColor: '#037EF3', color: 'white' }}>Type</th>
                    <th rowSpan={2} className="text-center py-3 px-3" style={{ backgroundColor: '#037EF3', color: 'white' }}>Entity</th>
                    <th rowSpan={2} className="text-center py-3 px-3" style={{ backgroundColor: '#00c16e', color: 'white' }}>Goal</th>
                    <th rowSpan={2} className="text-center py-3 px-3 cursor-pointer select-none" onClick={() => toggleSummarySort('total')} style={{ backgroundColor: '#037EF3', color: 'white' }} title="SUs mỗi LC có được từ các nguồn">SUs | market (total){summarySort.column==='total' ? (summarySort.direction==='asc' ? ' ▲' : ' ▼') : ''}</th>
                    <th rowSpan={2} className="text-center py-3 px-3 cursor-pointer select-none" onClick={() => toggleSummarySort('msu')} style={{ backgroundColor: '#037EF3', color: 'white' }} title="SUs mỗi LC có được từ UTM Links cho own market">MSUs{summarySort.column==='msu' ? (summarySort.direction==='asc' ? ' ▲' : ' ▼') : ''}</th>
                    <th rowSpan={2} className="text-center py-3 px-3" style={{ backgroundColor: '#037EF3', color: 'white' }} title="SUs mỗi LC có được từ UTM Links cho mọi market">SUs | utm source</th>
                    <th rowSpan={2} className="text-center py-3 px-3" style={{ backgroundColor: '#037EF3', color: 'white' }} title="SUs nhận được từ EMT + Organic">EMT + Organic</th>
                    <th rowSpan={2} className="text-center py-3 px-3" style={{ backgroundColor: '#037EF3', color: 'white' }}>SUs | other source</th>
                    <th className="text-center py-3 px-3" style={{ backgroundColor: '#037EF3', color: 'white' }} colSpan={comparePhaseFilter ? 7 : 5}>%GvA{comparePhaseFilter ? ` compared to ${comparePhaseFilter}` : ''}</th>
                  </tr>
                  <tr>
                    <th className="text-center py-3 px-3" style={{ backgroundColor: '#037EF3', color: 'white', borderLeft: '1px solid white', borderTop: '1px solid white', borderRight: '1px solid white'}} title="Progress = SUs / Goal">Progress</th>
                    <th className="text-center py-3 px-3" style={{ backgroundColor: '#037EF3', color: 'white', borderLeft: '1px solid white', borderTop: '1px solid white', borderRight: '1px solid white'}} title="%M.SUs/SUs = MSUs / SUs">%M.SUs/SUs</th>
                    <th className="text-center py-3 px-3" style={{ backgroundColor: '#037EF3', color: 'white', borderLeft: '1px solid white', borderTop: '1px solid white' }} title="%M.SUs/UTM = MSUs / SUs | utm source">%M.SUs/UTM</th>
                    {comparePhaseFilter && (
                      <>
                        <th className="text-center py-3 px-3" style={{ backgroundColor: '#037EF3', color: 'white', borderLeft: '1px solid white', borderTop: '1px solid white', borderRight: '1px solid white' }} title={`MSU at ${comparePhaseFilter}`}>MSU ({comparePhaseFilter})</th>
                        <th className="text-center py-3 px-3" style={{ backgroundColor: '#037EF3', color: 'white', borderLeft: '1px solid white', borderTop: '1px solid white' }} title="%Growth = (MSU current - MSU compare) / MSU compare">%Growth</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {/* Local section */}
                  {sortedLocalSummary.map((row, index) => (
                    <tr key={`sum-${row.lc}`} className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      {index === 0 && (
                        <td className="py-2 px-3 font-bold text-center" style={{ backgroundColor: '#037EF3', color: 'white', writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }} rowSpan={sortedLocalSummary.length}>LOCAL</td>
                      )}
                      <td className="py-2 px-3 font-medium text-gray-900">{row.lc}</td>
                      <td className="py-2 px-3 font-semibold text-center" style={{ backgroundColor: '#e8f5e8', color: '#00c16e' }}>{row.goal}</td>
                      <td className="py-2 px-3 text-center">{row.total}</td>
                      <td className="py-2 px-3 text-center">{row.msu}</td>
                      <td className="py-2 px-3 text-center" style={{ backgroundColor: '#f5f5f5', color: '#000000' }}>{row.yourUtm}</td>
                      <td className="py-2 px-3 text-center" style={{ backgroundColor: '#f5f5f5', color: '#000000' }}>{row.emtPlusOrganic}</td>
                      <td className="py-2 px-3 text-center" style={{ backgroundColor: '#f5f5f5', color: '#000000' }}>{row.otherSource}</td>
                      <td className="py-2 px-3 text-center font-semibold" style={{ backgroundColor: '#e8f5e8', color: '#00c16e' }}>{calculateProgress(row.total, row.goal).toFixed(2)}%</td>
                      <td className="py-2 px-3 text-center font-semibold" style={{ backgroundColor: '#f0f0ff', color: '#7552CC' }}>{calculatePercentage(row.msu, row.total).toFixed(2)}%</td>
                      <td className="py-2 px-3 text-center font-semibold" style={{ backgroundColor: '#ffe6e6', color: '#FF6B6B' }}>{calculatePercentage(row.msu, row.yourUtm).toFixed(2)}%</td>
                      {comparePhaseFilter && (
                        <>
                          <td className="py-2 px-3 text-center" style={{ backgroundColor: '#f5f5f5', color: '#000000' }}>
                            {compareLoading ? (
                              <img src="/giphy3.gif" alt="Loading..." className="h-5 inline-block" />
                            ) : (
                              formatNumber((compareMsuByPhase[comparePhaseFilter]?.[row.lc] || 0))
                            )}
                          </td>
                          <td className="py-2 px-3 text-center font-semibold" style={{ backgroundColor: '#fff0d6' }}>
                            {compareLoading ? (
                              <img src="/giphy3.gif" alt="Loading..." className="h-5 inline-block" />
                            ) : (
                              (() => {
                                const prev = compareMsuByPhase[comparePhaseFilter]?.[row.lc] || 0;
                                if (prev === 0) return '-';
                                const growth = ((row.msu - prev) / prev) * 100;
                                return <span style={{ color: growth < 0 ? '#E02424' : '#b36b00' }}>{growth.toFixed(2)}%</span>;
                              })()
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  {localTotals && (
                    <tr style={{ backgroundColor: '#ffc845', borderTop: '2px solid #FFFFFF' }}>
                      <td className="py-2 px-3 font-bold text-center" style={{ backgroundColor: '#ffc845', color: '#000000' }}>TOTAL</td>
                      <td className="py-2 px-3 font-bold text-gray-900 text-center" style={{ backgroundColor: '#ffc845' }}>LOCAL</td>
                      <td className="py-2 px-3 font-bold text-center" style={{ backgroundColor: '#e8f5e8', color: '#00c16e' }}>{localTotals.goal}</td>
                      <td className="py-2 px-3 font-bold text-gray-900 text-center" style={{ backgroundColor: '#ffc845' }}>{localTotals.total}</td>
                      <td className="py-2 px-3 font-bold text-gray-900 text-center" style={{ backgroundColor: '#ffc845' }}>{localTotals.msu}</td>
                      <td className="py-2 px-3 font-bold text-center" style={{ backgroundColor: '#f5f5f5', color: '#000000' }}>{localTotals.yourUtm}</td>
                      <td className="py-2 px-3 font-bold text-center" style={{ backgroundColor: '#f5f5f5', color: '#000000' }}>{localTotals.emtPlusOrganic}</td>
                      <td className="py-2 px-3 font-bold text-center" style={{ backgroundColor: '#f5f5f5', color: '#000000' }}>{localTotals.otherSource}</td>
                      <td className="py-2 px-3 font-bold text-center font-semibold" style={{ backgroundColor: '#e8f5e8', color: '#00c16e' }}>{calculateProgress(localTotals.total, localTotals.goal).toFixed(2)}%</td>
                      <td className="py-2 px-3 font-bold text-center font-semibold" style={{ backgroundColor: '#f0f0ff', color: '#7552CC' }}>{calculatePercentage(localTotals.msu, localTotals.total).toFixed(2)}%</td>
                      <td className="py-2 px-3 font-bold text-center font-semibold" style={{ backgroundColor: '#ffe6e6', color: '#FF6B6B' }}>{calculatePercentage(localTotals.msu, localTotals.yourUtm).toFixed(2)}%</td>
                      {comparePhaseFilter && (
                        <>
                          <td className="py-2 px-3 font-bold text-center" style={{ backgroundColor: '#f5f5f5', color: '#000000' }}>
                            {formatNumber(Object.values(compareMsuByPhase[comparePhaseFilter] || {}).reduce((s, v) => s + (v || 0), 0))}
                          </td>
                          <td className="py-2 px-3 font-bold text-center" style={{ backgroundColor: '#fff0d6' }}>
                            {(() => {
                              const prevTotal = Object.values(compareMsuByPhase[comparePhaseFilter] || {}).reduce((s, v) => s + (v || 0), 0);
                              if (prevTotal === 0) return '-';
                              const growth = (((localTotals.msu || 0) - prevTotal) / prevTotal) * 100;
                              return <span style={{ color: growth < 0 ? '#E02424' : '#b36b00' }}>{growth.toFixed(2)}%</span>;
                            })()}
                          </td>
                        </>
                      )}
                    </tr>
                  )}
                  {/* National section */}
                  {nationalSummary.map((r, index) => (
                    <tr key={`nat-${r.label}`} className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      {index === 0 && (
                        <td className="py-2 px-3 font-bold text-center" style={{ backgroundColor: '#037EF3', color: 'white', writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }} rowSpan={nationalSummary.length}>NATIONAL</td>
                      )}
                      <td className="py-2 px-3 font-medium text-gray-900">{r.label}</td>
                      <td className="py-2 px-3 text-center font-semibold" style={{ backgroundColor: '#e8f5e8', color: '#00c16e' }}>
                        {r.label === 'EMT' ? formatNumber(lcGoals['EMT'] ?? 0) : 
                         r.label === 'Organic' ? formatNumber(lcGoals['Organic'] ?? 0) : '-'}
                      </td>
                      <td className="py-2 px-3 text-center">{formatNumber(r.count)}</td>
                      <td className="py-2 px-3 text-center">{calculatePercentage(r.count, nationalTotal + organicTotal).toFixed(2)}%</td>
                      <td className="py-2 px-3 text-center">-</td>
                      <td className="py-2 px-3 text-center">-</td>
                      <td className="py-2 px-3 text-center">-</td>
                      <td className="py-2 px-3 text-center">-</td>
                      <td className="py-2 px-3 text-center">-</td>
                      <td className="py-2 px-3 text-center">-</td>
                    </tr>
                  ))}
                                    <tr style={{ backgroundColor: '#ffc845', borderTop: '2px solid #FFFFFF' }}>
                    <td className="py-2 px-3 font-bold text-center" style={{ backgroundColor: '#ffc845', color: '#000000' }}>TOTAL</td>
                    <td className="py-2 px-3 font-bold text-gray-900 text-center" style={{ backgroundColor: '#ffc845' }}>NATIONAL</td>
                    <td className="py-2 px-3 font-bold text-center" style={{ backgroundColor: '#e8f5e8', color: '#00c16e' }}>{formatNumber((lcGoals['EMT'] ?? 0) + (lcGoals['Organic'] ?? 0))}</td>
                    <td className="py-2 px-3 font-bold text-center" style={{ backgroundColor: '#ffc845', color: '#000000' }}>{formatNumber(nationalTotal + organicTotal)}</td>
                    <td className="py-2 px-3 font-bold text-gray-900 text-center" style={{ backgroundColor: '#ffc845' }}>100.00%</td>
                    <td className="py-2 px-3 font-bold text-center" style={{ backgroundColor: '#f5f5f5', color: '#000000' }}>-</td>
                    <td className="py-2 px-3 font-bold text-center" style={{ backgroundColor: '#f5f5f5', color: '#000000' }}>-</td>
                    <td className="py-2 px-3 font-bold text-center" style={{ backgroundColor: '#f5f5f5', color: '#000000' }}>-</td>
                    <td className="py-2 px-3 font-bold text-center">-</td>
                    <td className="py-2 px-3 font-bold text-center">-</td>
                    <td className="py-2 px-3 font-bold text-center">-</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
         
          {/* Recent Activity */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Dashboard updated</p>
                    <p className="text-sm text-gray-600">Form statistics refreshed</p>
                  </div>
                  <span className="text-sm text-gray-600">Just now</span>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">New form submission</p>
                    <p className="text-sm text-gray-600">Form data received from {lcStats[0]?.lc || 'Unknown LC'}</p>
                  </div>
                  <span className="text-sm text-gray-600">5 minutes ago</span>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">System update</p>
                    <p className="text-sm text-gray-600">Dashboard performance improved</p>
                  </div>
                  <span className="text-sm text-gray-600">1 hour ago</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      {/* Sidebar controls handled by src/app/dashboard/layout.tsx */}
    </div>
  );
}
