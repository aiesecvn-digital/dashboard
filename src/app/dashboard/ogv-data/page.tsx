'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  TrendingUp, 
  ArrowLeft,
  Search,
  Filter,
  Edit,
  Save,
  X,
  Check,
  Database,
  Settings,
  FileText
} from 'lucide-react';
import { getCurrentUser, supabase } from '@/lib/supabase';
import MultiSelect from '@/components/MultiSelect';

interface FormSubmission {
  id: string;
  timestamp: string;
  form_code: string;
  name: string;
  birth: string;
  fb: string;
  phone: string;
  email: string;
  livewhere: string;
  uni: string;
  university?: string;
  other_uni: string;
  other_uni_2: string;
  UniversityYear: string;
  Major: string;
  startdate: string;
  enddate: string;
  Channel: string;
  url_ogta: string;
  formDate: string;
  promoteLeadership: string;
  ReceiveInformation: string;
  Demand: string;
  categorize: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_id: string;
  utm_content: string;
  utm_name: string;
  utm_term: string;
  allocated_lc?: string | null;
}

interface UniversityMapping {
  id: number;
  university_name: string;
  lc_code: string;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'raw-data' | 'cleaned-data' | 'manual-allocation'>('raw-data');
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [unmappedSubmissions, setUnmappedSubmissions] = useState<FormSubmission[]>([]);
  const [universityMappings, setUniversityMappings] = useState<UniversityMapping[]>([]);
  const [universityMap, setUniversityMap] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLC, setEditingLC] = useState('');
  const [mappingSearch, setMappingSearch] = useState('');
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [selectedSubmissions, setSelectedSubmissions] = useState<Set<string>>(new Set());
  const [bulkAllocateLC, setBulkAllocateLC] = useState('');
  const [isBulkAllocating, setIsBulkAllocating] = useState(false);
  const [isManualAllocating, setIsManualAllocating] = useState(false);
  const [lcFilter, setLcFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('');
  const [termFilter, setTermFilter] = useState<string>('');
  const [phaseFilter, setPhaseFilter] = useState<string>('');
  const [phaseRanges, setPhaseRanges] = useState<Array<{ code: string; start: string | null; end: string | null }>>([]);
  const [utmLinksByLc, setUtmLinksByLc] = useState<Record<string, string[]>>({});
  const [nationalUtmLinks, setNationalUtmLinks] = useState<string[]>([]);
  const [utmTermFilter, setUtmTermFilter] = useState<string>('');
  
  // Pagination state for raw data
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  // Pagination state for cleaned data
  const [currentPageCleaned, setCurrentPageCleaned] = useState(1);
  const [itemsPerPageCleaned, setItemsPerPageCleaned] = useState(50);
  // Pagination state for manual allocation
  const [currentPageManual, setCurrentPageManual] = useState(1);
  const [itemsPerPageManual, setItemsPerPageManual] = useState(50);
  const [importLoading, setImportLoading] = useState(false);


  useEffect(() => {
    checkUserAndLoadData();
  }, []);

  // Load UTM links
  useEffect(() => {
    loadUtmLinks();
  }, []);

  // Reset UTM Term filter when LC filter changes
  useEffect(() => {
    setUtmTermFilter('');
  }, [lcFilter]);

  const loadUtmLinks = async () => {
    try {
      const { data: utmLinks, error } = await supabase
        .from('utm_links')
        .select('*');
      
      if (error) {
        console.error('Error loading UTM links:', error);
        setUtmLinksByLc({});
        setNationalUtmLinks([]);
        return;
      }

      const linksByLc: Record<string, string[]> = {};
      const nationalLinks: string[] = [];
      
      if (utmLinks && Array.isArray(utmLinks)) {
        for (const link of utmLinks) {
          const lcCode = link.entity_code || link.lc_code || link.lc || link.local_committee || link.entity;
          const utmLink = link.url || link.utm_link || link.utm || link.link;
          const entityType = link.entity_type || link.type;
          
          if (utmLink) {
            const utmLinkStr = String(utmLink);
            
            if (entityType === 'NATIONAL') {
              nationalLinks.push(utmLinkStr);
            } else if (lcCode) {
              const lcCodeStr = String(lcCode);
              if (!linksByLc[lcCodeStr]) {
                linksByLc[lcCodeStr] = [];
              }
              linksByLc[lcCodeStr].push(utmLinkStr);
            }
          }
        }
      }
      
      setUtmLinksByLc(linksByLc);
      setNationalUtmLinks(nationalLinks);
    } catch (error) {
      console.error('Error loading UTM links:', error);
      setUtmLinksByLc({});
      setNationalUtmLinks([]);
    }
  };



  const checkUserAndLoadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.push('/auth/login');
        return;
      }

      // Check if user is admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.id)
        .single();

      if (profile?.role !== 'admin') {
        router.push('/dashboard');
        return;
      }

      setUser(currentUser);
      setUserProfile(profile);
      await loadData();
      try {
        const { data: phases } = await supabase
          .from('phases')
          .select('code, start_date, end_date')
          .order('term', { ascending: false })
          .order('half', { ascending: false });
        setPhaseRanges((phases as any[] || []).map(p => ({ code: String(p.code), start: p.start_date ?? null, end: p.end_date ?? null })));
      } catch {}
    } catch (error) {
      console.error('Error checking user:', error);
      router.push('/auth/login');
    } finally {
      setLoading(false);
    }
  };

  // Normalize university label by removing region prefixes like "Hanoi - " or "HCMC - ", extra spaces, and different dash chars
  const normalizeUniversityLabel = (label: string): string => {
    if (!label) return '';
    let normalized = label.replace(/[\u2013\u2014]/g, '-'); // en/em dash to hyphen
    const parts = normalized.split(' - ');
    if (parts.length > 1) {
      // remove the first segment (region)
      normalized = parts.slice(1).join(' - ');
    }
    return normalized.trim();
  };

  // Safely coalesce the first non-empty value
  const coalesce = (...values: any[]) => values.find(v => v !== undefined && v !== null && v !== '') ?? '';

  // UTC formatting helpers to avoid local timezone shifts
  const formatDateTimeUtc = (value: string | number | Date): string => {
    try {
      const d = new Date(value);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      const hh = String(d.getUTCHours()).padStart(2, '0');
      const mm = String(d.getUTCMinutes()).padStart(2, '0');
      const ss = String(d.getUTCSeconds()).padStart(2, '0');
      return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
    } catch {
      return String(value ?? '');
    }
  };

  const formatDateUtc = (value: string | number | Date): string => {
    try {
      const d = new Date(value);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    } catch {
      return String(value ?? '');
    }
  };

  // Normalize a raw DB row into FormSubmission shape, hydrating fields from form_data/university
  const normalizeSubmission = (row: any): FormSubmission => {
    const form = row?.form_data ?? {};
    return {
      id: String(row.id),
      timestamp: String(coalesce(row.timestamp, row.created_at, form.timestamp, new Date().toISOString())),
      form_code: String(coalesce(row.form_code, row['form-code'], form.form_code, form.formCode, form['form-code'])),
      name: String(coalesce(row.name, form.name)),
      birth: String(coalesce(row.birth, form.birth)),
      fb: String(coalesce(row.fb, form.fb)),
      phone: String(coalesce(row.phone, form.phone)),
      email: String(coalesce(row.email, form.email)),
      livewhere: String(coalesce(row.livewhere, form.livewhere)),
      uni: String(coalesce(row.uni, row.university, form.uni, form.university)),
      other_uni: String(coalesce(row['other--uni'], row.other_uni, form.other_uni)),
      other_uni_2: String(coalesce(row.other_uni_2, form.other_uni_2)),
      UniversityYear: String(coalesce(row.UniversityYear, form.UniversityYear)),
      Major: String(coalesce(row.Major, form.Major)),
      startdate: String(coalesce(row.startdate, form.startdate)),
      enddate: String(coalesce(row.enddate, form.enddate)),
      Channel: String(coalesce(row.Channel, form.Channel)),
      url_ogta: String(coalesce(row.url_ogta, form.url_ogta)),
      formDate: String(coalesce(row.formDate, form.formDate)),
      promoteLeadership: String(coalesce(row.promoteLeadership, form.promoteLeadership)),
      ReceiveInformation: String(coalesce(row.ReceiveInformation, form.ReceiveInformation)),
      Demand: String(coalesce(row.Demand, form.Demand)),
      categorize: String(coalesce(row.categorize, form.categorize)),
      utm_source: String(coalesce(row.utm_source, form.utm_source)),
      utm_medium: String(coalesce(row.utm_medium, form.utm_medium)),
      utm_campaign: String(coalesce(row.utm_campaign, form.utm_campaign)),
      utm_id: String(coalesce(row.utm_id, form.utm_id)),
      utm_content: String(coalesce(row.utm_content, form.utm_content)),
      utm_name: String(coalesce(row.utm_name, form.utm_name)),
      utm_term: String(coalesce(row.utm_term, form.utm_term)),
      allocated_lc: row.allocated_lc ?? null,
    };
  };

  const getLcBadgeClass = (lc?: string | null): string => {
    const code = (lc ?? '').toUpperCase();
    switch (code) {
      case 'HANOI':
        return 'bg-blue-100 text-blue-800';
      case 'FHN':
        return 'bg-rose-100 text-rose-800';
      case 'NEU':
        return 'bg-purple-100 text-purple-800';
      case 'HCMC':
        return 'bg-emerald-100 text-emerald-800';
      case 'FHCMC':
        return 'bg-pink-100 text-pink-800';
      case 'HCME':
        return 'bg-indigo-100 text-indigo-800';
      case 'HCMS':
        return 'bg-teal-100 text-teal-800';
      case 'CANTHO':
        return 'bg-orange-100 text-orange-800';
      case 'DANANG':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

	const resolveLcFromUniversity = (universityLabel: string, mapOverride?: Record<string, string>): string | null => {
		if (!universityLabel) return null;
		const mapToUse = mapOverride ?? universityMap;


		// 1) Exact match in mapping table (with region prefix)
		if (mapToUse[universityLabel]) {
			return mapToUse[universityLabel];
		}

		// 2) Fallback: map by region prefix before original dash
		const hyphenIndex = universityLabel.indexOf(' - ');
		if (hyphenIndex > 0) {
			const prefix = universityLabel.slice(0, hyphenIndex).trim().toLowerCase();
			if (prefix === 'hanoi') return 'Hanoi';
			if (prefix === 'hcmc' || prefix === 'ho chi minh' || prefix === 'ho chi minh city') return 'HCMC';
			if (prefix === 'danang' || prefix === 'da nang') return 'Danang';
			if (prefix === 'cantho' || prefix === 'can tho') return 'Cantho';
		}
		return null;
	};

	const autoAllocateForUnmapped = async (unmapped: FormSubmission[], mapForAllocation?: Record<string, string>) => {
		if (!unmapped || unmapped.length === 0) return;
		const updates: Array<PromiseLike<any>> = [];
		const newlyAllocated: Array<{ id: string; lc: string }> = [];
		for (const submission of unmapped) {
			const lc = resolveLcFromUniversity(submission.uni || submission.university || '', mapForAllocation);
			if (lc) {
				updates.push(
					supabase
						.from('form_submissions')
						.update({ allocated_lc: lc })
						.eq('id', submission.id)
						.select()
				);
				newlyAllocated.push({ id: submission.id, lc });
			}
		}
		if (updates.length > 0) {
			try {
				await Promise.all(updates);
				// Update local state
				setSubmissions(prev => prev.map(s => {
					const match = newlyAllocated.find(n => n.id === s.id);
					return match ? { ...s, allocated_lc: match.lc } : s;
				}));
				setUnmappedSubmissions(prev => prev.filter(s => !newlyAllocated.find(n => n.id === s.id)));
			} catch (e) {
				console.error('Auto allocation failed:', e);
			}
		}
	};

	const correctAllocationsWithMap = async (all: FormSubmission[], mapForAllocation: Record<string, string>) => {
		const regionCodes = new Set(['Hanoi', 'HCMC', 'Danang', 'Cantho']);
		const updates: Array<PromiseLike<any>> = [];
		const newlyCorrected: Array<{ id: string; lc: string }> = [];
		for (const s of all) {
			if (!s.allocated_lc) continue;
			const resolved = resolveLcFromUniversity(s.uni || s.university || '', mapForAllocation);
			if (resolved && resolved !== s.allocated_lc && !regionCodes.has(resolved)) {
				updates.push(
					supabase
						.from('form_submissions')
						.update({ allocated_lc: resolved })
						.eq('id', s.id)
						.select()
				);
				newlyCorrected.push({ id: s.id, lc: resolved });
			}
		}
		if (updates.length > 0) {
			try {
				await Promise.all(updates);
				setSubmissions(prev => prev.map(s => {
					const match = newlyCorrected.find(n => n.id === s.id);
					return match ? { ...s, allocated_lc: match.lc } : s;
				}));
			} catch (e) {
				console.error('Correction of allocations failed:', e);
			}
		}
	};

	const loadData = async () => {
		try {
			// Load all form submissions with pagination to get all records
			let allSubmissions: any[] = [];
			let from = 0;
			const pageSize = 1000;
			let hasMore = true;

			while (hasMore) {
				const { data: submissionsData, error: submissionsError } = await supabase
					.from('form_submissions')
					.select('*')
					.order('timestamp', { ascending: false })
					.range(from, from + pageSize - 1);

				if (submissionsError) throw submissionsError;

				if (submissionsData && submissionsData.length > 0) {
					allSubmissions = [...allSubmissions, ...submissionsData];
					from += pageSize;
					hasMore = submissionsData.length === pageSize;
				} else {
					hasMore = false;
				}
			}

			// Normalize rows so important fields (like form_code) are always populated
			const normalized: FormSubmission[] = (allSubmissions || []).map(normalizeSubmission);
			setSubmissions(normalized);

			// Try to load university mapping table if available
			let localMap: Record<string, string> = {};
			try {
				const { data: mappingData, error: mappingErrorRes } = await supabase
					.from('university_mapping')
					.select('id, university_name, lc_code')
					.order('lc_code', { ascending: true })
					.order('university_name', { ascending: true });
				if (mappingErrorRes) {
					setMappingError(mappingErrorRes.message ?? 'Failed to load university_mapping');
				} else if (mappingData && Array.isArray(mappingData)) {
					setMappingError(null);
					setUniversityMappings(mappingData as any);
					// Store only full names in mapping table
					for (const row of mappingData as any[]) {
						const universityName = String(row.university_name);
						const lcCode = String(row.lc_code);
						
						// Store full name mapping only
						localMap[universityName] = lcCode;
					}
					
					// Debug: Check FPT mappings
					const fptMappings = Object.entries(localMap).filter(([key]) => key.includes('FPT'));

					setUniversityMap(localMap);
				}
			} catch (e: any) {
				setMappingError(e?.message ?? 'Failed to load university_mapping');
			}

			// Filter unmapped submissions (those without allocated_lc)
			const unmapped = normalized.filter((submission: FormSubmission) => !submission.allocated_lc);
			setUnmappedSubmissions(unmapped);

			// Attempt auto allocation for unmapped based on mapping or region prefix using the freshly built local map
			if (normalized.length > 0) {
				await autoAllocateForUnmapped(unmapped, localMap);
				// Correct previously mapped region codes to specific LCs when mapping provides a better match
				if (Object.keys(localMap).length > 0) {
					await correctAllocationsWithMap(normalized, localMap);
				}
			}
		} catch (error) {
			console.error('Error loading data:', error);
		}
	};

  const handleAllocateLC = async (submissionId: string, lcCode: string) => {
		setIsManualAllocating(true);
		try {
			const prevLC = submissions.find(s => s.id === submissionId)?.allocated_lc ?? null;
			const { error } = await supabase
				.from('form_submissions')
				.update({ allocated_lc: lcCode })
				.eq('id', submissionId)
				.select();

			if (error) {
				console.error('Error allocating LC:', error);
				// Surface error to user for quicker debugging
				if (typeof window !== 'undefined') {
					alert(`Allocate failed: ${'message' in (error as any) ? (error as any).message : JSON.stringify(error)}`);
				}
				return;
			}

			// Log manual allocation (best-effort; ignore errors)
			try {
				await supabase.from('allocation_logs').insert({
					submission_id: submissionId,
					previous_lc: prevLC,
					new_lc: lcCode,
					method: 'manual',
					allocated_by: user?.id ?? null,
				});
			} catch (logErr) {
				console.warn('Failed to log manual allocation:', logErr);
			}

			// Update local state
			setSubmissions(prev => 
				prev.map(sub => 
					sub.id === submissionId 
						? { ...sub, allocated_lc: lcCode }
						: sub
				)
			);

			setUnmappedSubmissions(prev => 
				prev.filter(sub => sub.id !== submissionId)
			);

			setEditingId(null);
			setEditingLC('');
		} catch (error) {
			console.error('Error allocating LC:', error);
			if (typeof window !== 'undefined') {
				alert(`Allocate failed: ${'message' in (error as any) ? (error as any).message : JSON.stringify(error)}`);
			}
		} finally {
			setIsManualAllocating(false);
		}
  };

  const handleBulkAllocateLC = async () => {
    if (!bulkAllocateLC || selectedSubmissions.size === 0) return;
    
    setIsBulkAllocating(true);
    try {
      const submissionIds = Array.from(selectedSubmissions);
      
      const { error } = await supabase
        .from('form_submissions')
        .update({ allocated_lc: bulkAllocateLC })
        .in('id', submissionIds);
      
      if (error) throw error;
      
      // Refresh data and reset selection
      await checkUserAndLoadData();
      setSelectedSubmissions(new Set());
      setBulkAllocateLC('');
      alert(`Successfully allocated ${submissionIds.length} submissions to ${bulkAllocateLC}`);
    } catch (error) {
      console.error('Error bulk allocating LC:', error);
      alert('Failed to bulk allocate LC');
    } finally {
      setIsBulkAllocating(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedSubmissions.size === paginatedManualData.length) {
      setSelectedSubmissions(new Set());
    } else {
      setSelectedSubmissions(new Set(paginatedManualData.map(s => s.id)));
    }
  };

  const handleSelectSubmission = (submissionId: string) => {
    const newSelected = new Set(selectedSubmissions);
    if (newSelected.has(submissionId)) {
      newSelected.delete(submissionId);
    } else {
      newSelected.add(submissionId);
    }
    setSelectedSubmissions(newSelected);
  };



  // Function to get cleaned data (deduplicated by phone or email)
  const getCleanedData = () => {
    const phoneEmailMap = new Map<string, FormSubmission>();
    
    submissions.forEach(submission => {
      const key = submission.phone || submission.email;
      if (key) {
        const existing = phoneEmailMap.get(key);
        if (!existing || new Date(submission.timestamp) > new Date(existing.timestamp)) {
          phoneEmailMap.set(key, submission);
        }
      }
    });
    
    return Array.from(phoneEmailMap.values()).sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  };

  const matchesLc = (s: FormSubmission) => {
    if (!lcFilter || lcFilter === 'all') return true;
    const set = new Set(lcFilter.split(',').filter(Boolean).map(v => v.toUpperCase()));
    const matches = set.has(String(s.allocated_lc || '').toUpperCase());
    
    return matches;
  };

  const matchesMonth = (s: FormSubmission) => {
    if (!monthFilter) return true;
    try {
      const d = new Date(s.timestamp);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const code = `${y}-${m}`;
      const set = new Set(monthFilter.split(',').filter(Boolean));
      return set.has(code);
    } catch {
      return true;
    }
  };

  const matchesTerm = (s: FormSubmission) => {
    if (!termFilter) return true;
    try {
      const year = new Date(s.timestamp).getUTCFullYear();
      const set = new Set(termFilter.split(',').filter(Boolean));
      if (set.size === 0) return true;
      return set.has(String(year));
    } catch {
      return true;
    }
  };
 
  const matchesPhase = (s: FormSubmission) => {
    if (!phaseFilter) return true;
    const selected = phaseFilter.split(',').filter(Boolean);
    if (selected.length === 0) return true;
    const t = new Date(s.timestamp).getTime();
    return selected.some(code => {
      const range = phaseRanges.find(p => p.code === code);
      if (!range || !range.start || !range.end) return true;
      const start = new Date(range.start).getTime();
      const end = new Date(range.end).getTime();
      return t >= start && t <= end;
    });
  };

  const matchesUtmTerm = (s: FormSubmission) => {
    if (!utmTermFilter) return true;
    const selected = new Set(utmTermFilter.split(',').filter(Boolean));
    if (selected.size === 0) return true;
    
    // Get UTM Term from form data
    const utmTerm = s.utm_term || '';
    return selected.has(utmTerm);
  };

  const filteredSubmissions = unmappedSubmissions
    .filter(submission => 
      submission.uni.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (submission.university && submission.university.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (submission.other_uni && submission.other_uni.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (submission.other_uni_2 && submission.other_uni_2.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .filter(matchesLc)
    .filter(matchesMonth)
    .filter(matchesTerm)
    .filter(matchesPhase)
    .filter(matchesUtmTerm);

  // Pagination logic for manual allocation
  const totalPagesManual = Math.ceil(filteredSubmissions.length / itemsPerPageManual);
  const startIndexManual = (currentPageManual - 1) * itemsPerPageManual;
  const endIndexManual = startIndexManual + itemsPerPageManual;
  const paginatedManualData = filteredSubmissions.slice(startIndexManual, endIndexManual);

  const filteredRawData = submissions
    .filter(submission => 
      submission.uni.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (submission.university && submission.university.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (submission.other_uni && submission.other_uni.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (submission.other_uni_2 && submission.other_uni_2.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .filter(matchesLc)
    .filter(matchesMonth)
    .filter(matchesTerm)
    .filter(matchesPhase)
    .filter(matchesUtmTerm);

  // Pagination logic for raw data
  const totalPages = Math.ceil(filteredRawData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRawData = filteredRawData.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
    setCurrentPageCleaned(1);
    setCurrentPageManual(1);
  }, [searchTerm, lcFilter, monthFilter, termFilter, phaseFilter, utmTermFilter]);

  const cleanedData = getCleanedData();
  const filteredCleanedData = cleanedData
    .filter(submission => 
      submission.uni.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (submission.university && submission.university.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (submission.other_uni && submission.other_uni.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (submission.other_uni_2 && submission.other_uni_2.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .filter(matchesLc)
    .filter(matchesMonth)
    .filter(matchesTerm)
    .filter(matchesPhase);

  // Pagination logic for cleaned data
  const totalPagesCleaned = Math.ceil(filteredCleanedData.length / itemsPerPageCleaned);
  const startIndexCleaned = (currentPageCleaned - 1) * itemsPerPageCleaned;
  const endIndexCleaned = startIndexCleaned + itemsPerPageCleaned;
  const paginatedCleanedData = filteredCleanedData.slice(startIndexCleaned, endIndexCleaned);



  const copyCellData = (text: string) => {
    navigator.clipboard.writeText(text);
    // Show a small notification instead of alert
    const notification = document.createElement('div');
    notification.textContent = 'Copied!';
    notification.className = 'fixed bg-green-500 text-white px-3 py-1 rounded text-sm z-50';
    notification.style.left = '50%';
    notification.style.top = '20px';
    notification.style.transform = 'translateX(-50%)';
    document.body.appendChild(notification);
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 1000);
  };

  const handleImportFile = async (file: File) => {
    // Check if user is admin
    if (userProfile?.role !== 'admin') {
      alert('Only administrators can import data');
      return;
    }
    
    setImportLoading(true);
    try {
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      let rows: any[] = [];
      if (isExcel) {
        // @ts-ignore dynamic import at runtime
        const XLSX = await import('xlsx');
        const b = await file.arrayBuffer();
        const wb = XLSX.read(b, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      } else if (file.name.endsWith('.csv')) {
        // @ts-ignore dynamic import at runtime
        const Papa = await import('papaparse');
        const text = await file.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        rows = (parsed.data as any[]) || [];
      } else {
        alert('Unsupported file. Please upload .xlsx or .csv');
        return;
      }

      if (!Array.isArray(rows) || rows.length === 0) {
        alert('No rows detected');
        return;
      }

      function parseDate(value: any): Date {
        if (!value) return new Date();
        
        // If it's already a Date object
        if (value instanceof Date) return value;
        
        // If it's a number (Excel serial number)
        if (typeof value === 'number') {
          const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Excel epoch 1899-12-30
          return new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
        }
        
        // If it's a string, try to parse it
        if (typeof value === 'string') {
          // Try different date formats
          const formats = [
            'DD/MM/YYYY HH:mm:ss', // 21/08/2025 00:00:00
            'DD/MM/YYYY',          // 21/08/2025
            'YYYY-MM-DD HH:mm:ss', // 2025-08-21 00:00:00
            'YYYY-MM-DD',          // 2025-08-21
            'MM/DD/YYYY HH:mm:ss', // 08/21/2025 00:00:00
            'MM/DD/YYYY'           // 08/21/2025
          ];
          
          for (const format of formats) {
            try {
              if (format === 'DD/MM/YYYY HH:mm:ss') {
                const [datePart, timePart] = value.split(' ');
                const [day, month, year] = datePart.split('/');
                const [hours, minutes, seconds] = timePart ? timePart.split(':') : ['00', '00', '00'];
                return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes), parseInt(seconds));
              } else if (format === 'DD/MM/YYYY') {
                const [day, month, year] = value.split('/');
                return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
              } else if (format === 'YYYY-MM-DD HH:mm:ss') {
                return new Date(value);
              } else if (format === 'YYYY-MM-DD') {
                return new Date(value + 'T00:00:00');
              } else if (format === 'MM/DD/YYYY HH:mm:ss') {
                const [datePart, timePart] = value.split(' ');
                const [month, day, year] = datePart.split('/');
                const [hours, minutes, seconds] = timePart ? timePart.split(':') : ['00', '00', '00'];
                return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes), parseInt(seconds));
              } else if (format === 'MM/DD/YYYY') {
                const [month, day, year] = value.split('/');
                return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
              }
            } catch (e) {
              continue;
            }
          }
        }
        
        // Fallback: try to create Date from value
        try {
          return new Date(value);
        } catch (e) {
          console.warn('Failed to parse date:', value);
          return new Date();
        }
      }
      
      // Map Excel/CSV columns directly to table columns
      const normalized = rows.map((r: any) => {
        return {
          phone: r.phone || r.Phone || r['Phone'] || null,
          email: r.email || r.Email || r['Email'] || null,
          uni: r.uni || r.University || r['University'] || null,
          allocated_lc: r.allocated_lc || r.allocatedLC || r['allocated lc'] || r['Allocated LC'] || null,
          utm_source: r.utm_source || r['UTM Source'] || r['utm source'] || null,
          utm_medium: r.utm_medium || r['UTM Medium'] || r['utm medium'] || null,
          utm_campaign: r.utm_campaign || r['UTM Campaign'] || r['utm campaign'] || null,
          utm_term: r.utm_term || r['UTM Term'] || r['utm term'] || null,
          utm_content: r.utm_content || r['UTM Content'] || r['utm content'] || null,
          utm_name: r.utm_name || r['UTM Name'] || r['utm name'] || null,
          timestamp: parseDate(r['timestamp']).toISOString(),
          // Additional columns from the provided list
          form_code: r['form-code'] || r.form_code || r['Form Code'] || null,
          name: r.name || r.Name || null,
          birth: r.birth || r.Birth || r['Birth Date'] || null,
          fb: r.fb || r.FB || r.facebook || r.Facebook || null,
          livewhere: r.livewhere || r['live where'] || r['Live Where'] || null,
          other_uni: r['other--uni'] || null,
          university_year: r.UniversityYear || r.university_year || r['University Year'] || null,
          major: r.Major || r.major || null,
          startdate: r.startdate || r.StartDate || r['Start Date'] || null,
          enddate: r.enddate || r.EndDate || r['End Date'] || null,
          channel: r.Channel || r.channel || null,
          promote_leadership: r.promoteLeadership || r.promote_leadership || r['Promote Leadership'] || null,
          receive_information: r.ReceiveInformation || r.receive_information || r['Receive Information'] || null,
          utm_id: r.utm_id || r['UTM ID'] || r['utm id'] || null
        };
      });

      // Deduplicate by phone/email: keep latest record
      const keyMap = new Map<string, any>();
      for (const row of normalized) {
        const phone = row.phone || '';
        const email = row.email || '';
        const key = String(phone || email || Math.random());
        const prev = keyMap.get(key);
        if (!prev) {
          keyMap.set(key, row);
        } else {
          const t1 = new Date(prev.timestamp || Date.now()).getTime();
          const t2 = new Date(row.timestamp || Date.now()).getTime();
          if (t2 >= t1) keyMap.set(key, row);
        }
      }

      const toInsert = Array.from(keyMap.values());
      
      // Insert in chunks to avoid payload limits
      const chunkSize = 500;
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize);
        const payload = chunk.map((c) => ({
          timestamp: c.timestamp,
          phone: c.phone,
          email: c.email,
          uni: c.uni,
          allocated_lc: c.allocated_lc,
          utm_source: c.utm_source,
          utm_medium: c.utm_medium,
          utm_campaign: c.utm_campaign,
          utm_term: c.utm_term,
          utm_content: c.utm_content,
          utm_name: c.utm_name,
          'form-code': c.form_code,
          name: c.name,
          birth: c.birth,
          fb: c.fb,
          livewhere: c.livewhere,
          'other--uni': c.other_uni,
          UniversityYear: c.university_year,
          Major: c.major,
          startdate: c.startdate,
          enddate: c.enddate,
          Channel: c.channel,
          promoteLeadership: c.promote_leadership,
          ReceiveInformation: c.receive_information,
          utm_id: c.utm_id
        }));
        const { error } = await supabase.from('form_submissions').insert(payload);
        if (error) {
          console.error('Insert failed:', error);
          alert('Import failed: ' + (error as any).message);
          return;
        }
      }

      alert('Import completed');
      await loadData();
    } catch (e: any) {
      console.error(e);
      alert('Import error: ' + (e?.message || 'unknown'));
    } finally {
      setImportLoading(false);
    }
  };

     if (loading) {
     return (
       <div className="min-h-screen flex items-center justify-center bg-white">
         <img src="/giphy.gif" alt="Loading..." className="h-50 w-50 object-contain" />
       </div>
     );
   }

     return (
     <div className="min-h-screen bg-gradient-to-bl from-[#f3f4f6] to-[#e5e7eb]">
       {/* Import Loading Overlay */}
       {importLoading && (
         <div className="fixed inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50">
           <div className="bg-white rounded-lg p-8 flex flex-col items-center space-y-6 shadow-xl">
             <img src="/giphy2.gif" alt="Loading..." className="h-50 w-50 object-contain" />
             <div className="flex space-x-1">
               <span className="text-2xl font-bold text-blue-600 animate-bounce" style={{ animationDelay: '0ms' }}>L</span>
               <span className="text-2xl font-bold text-blue-600 animate-bounce" style={{ animationDelay: '100ms' }}>o</span>
               <span className="text-2xl font-bold text-blue-600 animate-bounce" style={{ animationDelay: '200ms' }}>a</span>
               <span className="text-2xl font-bold text-blue-600 animate-bounce" style={{ animationDelay: '300ms' }}>d</span>
               <span className="text-2xl font-bold text-blue-600 animate-bounce" style={{ animationDelay: '400ms' }}>i</span>
               <span className="text-2xl font-bold text-blue-600 animate-bounce" style={{ animationDelay: '500ms' }}>n</span>
               <span className="text-2xl font-bold text-blue-600 animate-bounce" style={{ animationDelay: '600ms' }}>g</span>
               <span className="text-2xl font-bold text-blue-600 animate-bounce" style={{ animationDelay: '700ms' }}>.</span>
               <span className="text-2xl font-bold text-blue-600 animate-bounce" style={{ animationDelay: '800ms' }}>.</span>
               <span className="text-2xl font-bold text-blue-600 animate-bounce" style={{ animationDelay: '900ms' }}>.</span>
             </div>
             <p className="text-sm text-gray-600 text-center">Please wait while we process your file</p>
           </div>
         </div>
       )}


       {/* Header */}
       <header className="bg-white border-b border-gray-200">
         <div className="flex items-center justify-between px-3 sm:px-4 py-3">
           <div className="flex items-center space-x-2 sm:space-x-3">
             <button
               onClick={() => window.dispatchEvent(new Event('sidebar:toggle'))}
               className="p-2 rounded-md hover:bg-gray-100 text-gray-700"
               aria-label="Toggle sidebar"
             >
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                 <path fillRule="evenodd" d="M3.75 5.25a.75.75 0 01.75-.75h15a.75.75 0 010 1.5h-15a.75.75 0 01-.75-.75zm0 6a.75.75 0 01.75-.75h15a.75.75 0 010 1.5h-15a.75.75 0 01-.75-.75zm.75 5.25a.75.75 0 000 1.5h15a.75.75 0 000-1.5h-15z" clipRule="evenodd" />
               </svg>
             </button>
             <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">oGV Data</h1>
           </div>
         </div>
       </header>

      {/* Main content */}
      <main className="p-3 sm:p-4 md:p-6">
        {/* Global Filters */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-4 sm:mb-6 p-3 sm:p-4">
          <div className="flex flex-col xl:flex-row gap-3 sm:gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">LC</label>
              <MultiSelect
                label="LC"
                options={[
                  { label: 'FHN', value: 'FHN' },
                  { label: 'Hanoi', value: 'Hanoi' },
                  { label: 'NEU', value: 'NEU' },
                  { label: 'Danang', value: 'Danang' },
                  { label: 'FHCMC', value: 'FHCMC' },
                  { label: 'HCMC', value: 'HCMC' },
                  { label: 'HCME', value: 'HCME' },
                  { label: 'HCMS', value: 'HCMS' },
                  { label: 'Cantho', value: 'Cantho' },
                ]}
                selected={lcFilter ? lcFilter.split(',') : []}
                onChange={(vals) => {
                  const v = vals.filter(Boolean);
                  if (v.length === 0) setLcFilter('all');
                  else setLcFilter(v.join(','));
                }}
                showOnly
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
              <MultiSelect
                label="Month"
                options={(() => {
                  // Build continuous month range between earliest and latest dates (UTC) to avoid gaps/duplicates
                  const timestamps: number[] = [];
                  for (const s of submissions) {
                    const d = new Date(s.timestamp);
                    if (!Number.isNaN(d.getTime())) timestamps.push(d.getTime());
                  }
                  for (const p of phaseRanges) {
                    if (p.start) {
                      const d = new Date(p.start);
                      if (!Number.isNaN(d.getTime())) timestamps.push(d.getTime());
                    }
                    if (p.end) {
                      const d = new Date(p.end);
                      if (!Number.isNaN(d.getTime())) timestamps.push(d.getTime());
                    }
                  }
                  if (timestamps.length === 0) {
                    // Default to current year months
                    const now = new Date();
                    const y = now.getUTCFullYear();
                    return Array.from({ length: 12 }, (_, i) => {
                      const d = new Date(Date.UTC(y, 11 - i, 1));
                      const yy = d.getUTCFullYear();
                      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
                      return { label: d.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }), value: `${yy}-${mm}` };
                    });
                  }
                  const minTs = Math.min(...timestamps);
                  const maxTs = Math.max(...timestamps);
                  const start = new Date(minTs);
                  const end = new Date(maxTs);
                  let y = start.getUTCFullYear();
                  let m = start.getUTCMonth() + 1; // 1..12
                  const endY = end.getUTCFullYear();
                  const endM = end.getUTCMonth() + 1;
                  const list: { label: string; value: string }[] = [];
                  while (y < endY || (y === endY && m <= endM)) {
                    const d = new Date(Date.UTC(y, m - 1, 1));
                    const code = `${y}-${String(m).padStart(2, '0')}`;
                    list.push({ label: d.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }), value: code });
                    m += 1;
                    if (m > 12) { m = 1; y += 1; }
                  }
                  // Sort descending by value (YYYY-MM)
                  return list.sort((a, b) => (a.value < b.value ? 1 : -1));
                })()}
                selected={monthFilter ? monthFilter.split(',') : []}
                onChange={(vals) => setMonthFilter(vals.filter(Boolean).join(','))}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Term (Year)</label>
              <MultiSelect
                label="Term"
                options={Array.from(new Set([
                  ...submissions.map(s => new Date(s.timestamp).getUTCFullYear()),
                  ...phaseRanges.map(p => {
                    if (p.start) return new Date(p.start).getUTCFullYear();
                    if (p.end) return new Date(p.end).getUTCFullYear();
                    return null;
                  }).filter(y => y !== null)
                ]))
                  .sort((a,b)=> b-a)
                  .map(y => ({ label: String(y), value: String(y) }))}
                selected={termFilter ? termFilter.split(',') : []}
                onChange={(vals) => setTermFilter(vals.join(','))}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Phase</label>
              <MultiSelect
                label="Phase"
                options={phaseRanges.map(p => ({ label: p.code, value: p.code }))}
                selected={phaseFilter ? phaseFilter.split(',') : []}
                onChange={(vals) => setPhaseFilter(vals.join(','))}
              />
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">UTM Term</label>
              <MultiSelect
                label="UTM Term"
                options={(() => {
                  // Get all UTM terms from registered UTM links
                  const allUtmTerms = new Set<string>();
                  
                  if (lcFilter === 'all' || !lcFilter) {
                    // Show all UTM terms from all LCs and national
                    Object.values(utmLinksByLc).forEach(links => {
                      links.forEach(link => allUtmTerms.add(link));
                    });
                    nationalUtmLinks.forEach(link => allUtmTerms.add(link));
                  } else {
                    // Show UTM terms from selected LCs AND national UTM links
                    const selectedLcs = lcFilter.split(',').filter(Boolean);
                    selectedLcs.forEach(lc => {
                      const links = utmLinksByLc[lc] || [];
                      links.forEach(link => allUtmTerms.add(link));
                    });
                    // Always include national UTM links
                    nationalUtmLinks.forEach(link => allUtmTerms.add(link));
                  }
                  
                  return Array.from(allUtmTerms).sort().map(term => ({ 
                    label: term, 
                    value: term 
                  }));
                })()}
                selected={utmTermFilter ? utmTermFilter.split(',') : []}
                onChange={(vals) => setUtmTermFilter(vals.join(','))}
              />
            </div>
            <div>
              <button
                type="button"
                onClick={() => { 
                  setLcFilter('all'); 
                  setMonthFilter(''); 
                  setTermFilter(''); 
                  setPhaseFilter(''); 
                  setUtmTermFilter('');
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        {/* Import Section - Admin Only */}
        {userProfile?.role === 'admin' && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-4 sm:mb-6 p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-700 mb-1">Import Data</h3>
                <p className="text-xs text-gray-500">Upload Excel or CSV files to import new submissions</p>
              </div>
              <div className="flex items-center space-x-2 flex-shrink-0">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImportFile(f);
                  }}
                  className="block text-sm text-gray-700 file:mr-3 file:px-3 file:py-2 file:border file:border-gray-300 file:rounded-md file:bg-white file:text-gray-700 hover:file:bg-gray-50"
                />
              </div>
            </div>
          </div>
        )}
 
                 {/* Tab Navigation */}
         <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-4 sm:mb-6">
           <div className="flex border-b border-gray-200 overflow-x-auto">
             <button
               onClick={() => setActiveTab('raw-data')}
               className={`flex items-center space-x-1 sm:space-x-2 px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                 activeTab === 'raw-data'
                   ? 'text-primary border-b-2 border-primary'
                   : 'text-gray-600 hover:text-gray-900'
               }`}
             >
               <Database className="h-3 w-3 sm:h-4 sm:w-4" />
               <span>Raw Data</span>
             </button>
             <button
               onClick={() => setActiveTab('cleaned-data')}
               className={`flex items-center space-x-1 sm:space-x-2 px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                 activeTab === 'cleaned-data'
                   ? 'text-primary border-b-2 border-primary'
                   : 'text-gray-600 hover:text-gray-900'
               }`}
             >
               <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
               <span>Cleaned Data</span>
             </button>
             <button
               onClick={() => setActiveTab('manual-allocation')}
               className={`flex items-center space-x-1 sm:space-x-2 px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                 activeTab === 'manual-allocation'
                   ? 'text-primary border-b-2 border-primary'
                   : 'text-gray-600 hover:text-gray-900'
               }`}
             >
               <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
               <span>Manual Allocation</span>
             </button>
           </div>
         </div>

        {/* Tab Content */}
                 {activeTab === 'raw-data' && (
           <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 sm:p-4 md:p-6">
             <h2 className="text-lg font-semibold text-gray-900 mb-4 sm:mb-6">Form Submissions Raw Data</h2>
             <p className="text-sm text-gray-600 mb-4">💡 Click on any cell to copy its content to clipboard</p>
             
             {/* Search */}
             <div className="mb-4 sm:mb-6">
               <div className="relative max-w-md">
                 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                 <input
                   type="text"
                   placeholder="Search university..."
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                 />
               </div>
             </div>

                         {/* Raw Data Table */}
             <div className="overflow-x-auto">
               <table className="w-full text-gray-900 min-w-full">
                 <thead>
                   <tr className="border-b border-gray-200">
                     <th className="text-left py-2 px-2">Allocate</th>
                     <th className="text-left py-2 px-2 hidden sm:table-cell">Timestamp</th>
                     <th className="text-left py-2 px-2 hidden lg:table-cell">Form Code</th>
                     <th className="text-left py-2 px-2 min-w-[8rem] sm:min-w-[10rem]">Name</th>
                     <th className="text-left py-2 px-2 hidden md:table-cell">Birth</th>
                     <th className="text-left py-2 px-2 hidden xl:table-cell">FB</th>
                     <th className="text-left py-2 px-2 hidden lg:table-cell">Phone</th>
                     <th className="text-left py-2 px-2 hidden xl:table-cell">Email</th>
                     <th className="text-left py-2 px-2 hidden xl:table-cell">Live Where</th>
                     <th className="text-left py-2 px-2 min-w-[12rem] sm:min-w-[15rem]">University</th>
                     <th className="text-left py-2 px-2 hidden xl:table-cell">Other Uni</th>
                     <th className="text-left py-2 px-2 hidden xl:table-cell">Other Uni 2</th>
                     <th className="text-left py-2 px-2 hidden md:table-cell">Year</th>
                     <th className="text-left py-2 px-2 hidden lg:table-cell min-w-[10rem]">Major</th>
                     <th className="text-left py-2 px-2 hidden xl:table-cell min-w-[10rem]">Start Date</th>
                     <th className="text-left py-2 px-2 hidden xl:table-cell">End Date</th>
                     <th className="text-left py-2 px-2 hidden xl:table-cell min-w-[10rem]">Channel</th>
                     <th className="text-left py-2 px-2 hidden xl:table-cell">URL OGTA</th>
                     <th className="text-left py-2 px-2 hidden xl:table-cell">Form Date</th>
                     <th className="text-left py-2 px-2 hidden xl:table-cell">Promote Leadership</th>
                     <th className="text-left py-2 px-2 hidden xl:table-cell min-w-[10rem]">Receive Info</th>
                     <th className="text-left py-2 px-2 hidden xl:table-cell min-w-[10rem]">Demand</th>
                     <th className="text-left py-2 px-2 hidden xl:table-cell">Categorize</th>
                     <th className="text-left py-2 px-2 hidden lg:table-cell">UTM Source</th>
                     <th className="text-left py-2 px-2 hidden xl:table-cell">UTM Medium</th>
                     <th className="text-left py-2 px-2 hidden xl:table-cell">UTM Campaign</th>
                     <th className="text-left py-2 px-2 hidden xl:table-cell">UTM ID</th>
                     <th className="text-left py-2 px-2 hidden xl:table-cell">UTM Content</th>
                     <th className="text-left py-2 px-2 hidden xl:table-cell">UTM Name</th>
                     <th className="text-left py-2 px-2">UTM Term</th>
                   </tr>
                 </thead>
                                    <tbody>
                     {paginatedRawData.map((submission, index) => (
                       <tr 
                         key={`raw-${submission.id}-${index}`} 
                         className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                       >
                         <td className="py-2 px-2">
                           {submission.allocated_lc ? (
                             <span className={`px-2 py-1 rounded text-sm font-medium ${getLcBadgeClass(submission.allocated_lc)}`}>
                               {submission.allocated_lc}
                             </span>
                           ) : (
                             <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm font-medium">
                               Not Allocated
                             </span>
                           )}
                         </td>
                         <td className="py-2 px-2 hidden sm:table-cell">
                           <div className="text-gray-600">{formatDateTimeUtc(submission.timestamp)}</div>
                         </td>
                         <td className="py-2 px-2 w-32 max-w-80 hidden lg:table-cell">
                           <div className="text-gray-900 truncate" title={submission.form_code}>{submission.form_code}</div>
                         </td>
                         <td className="py-2 px-2 w-32 max-w-80">
                           <div 
                             className="font-medium text-gray-900 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                             title={`${submission.name || 'N/A'} (Click to copy)`}
                             onClick={() => copyCellData(submission.name || 'N/A')}
                           >
                             {submission.name || 'N/A'}
                           </div>
                         </td>
                         <td className="py-2 px-2 w-24 max-w-80 hidden md:table-cell">
                           <div 
                             className="text-gray-600 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                             title={`${submission.birth || 'N/A'} (Click to copy)`}
                             onClick={() => copyCellData(submission.birth || 'N/A')}
                           >
                             {submission.birth || 'N/A'}
                           </div>
                         </td>
                         <td className="py-2 px-2 w-32 max-w-80 hidden xl:table-cell">
                           <div 
                             className="text-gray-600 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                             title={`${submission.fb || 'N/A'} (Click to copy)`}
                             onClick={() => copyCellData(submission.fb || 'N/A')}
                           >
                             {submission.fb || 'N/A'}
                           </div>
                         </td>
                         <td className="py-2 px-2 w-32 max-w-80 hidden lg:table-cell">
                           <div 
                             className="text-gray-600 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                             title={`${submission.phone || 'N/A'} (Click to copy)`}
                             onClick={() => copyCellData(submission.phone || 'N/A')}
                           >
                             {submission.phone || 'N/A'}
                           </div>
                         </td>
                         <td className="py-2 px-2 w-48 max-w-48 hidden xl:table-cell">
                           <div 
                             className="text-gray-600 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                             title={`${submission.email || 'N/A'} (Click to copy)`}
                             onClick={() => copyCellData(submission.email || 'N/A')}
                           >
                             {submission.email || 'N/A'}
                           </div>
                         </td>
                         <td className="py-2 px-2 w-32 max-w-80 hidden xl:table-cell">
                           <div 
                             className="text-gray-600 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                             title={`${submission.livewhere || 'N/A'} (Click to copy)`}
                             onClick={() => copyCellData(submission.livewhere || 'N/A')}
                           >
                             {submission.livewhere || 'N/A'}
                           </div>
                         </td>
                         <td className="py-2 px-2 w-48 max-w-48">
                           <div 
                             className="font-medium text-gray-900 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                             title={`${submission.uni || 'N/A'} (Click to copy)`}
                             onClick={() => copyCellData(submission.uni || 'N/A')}
                           >
                             {submission.uni || 'N/A'}
                           </div>
                         </td>
                         <td className="py-2 px-2 w-32 max-w-80 hidden xl:table-cell">
                           <div 
                             className="text-gray-600 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                             title={`${submission.other_uni || 'N/A'} (Click to copy)`}
                             onClick={() => copyCellData(submission.other_uni || 'N/A')}
                           >
                             {submission.other_uni || 'N/A'}
                           </div>
                         </td>
                         <td className="py-2 px-2 w-32 max-w-80 hidden xl:table-cell">
                           <div 
                             className="text-gray-600 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                             title={`${submission.other_uni_2 || 'N/A'} (Click to copy)`}
                             onClick={() => copyCellData(submission.other_uni_2 || 'N/A')}
                           >
                             {submission.other_uni_2 || 'N/A'}
                           </div>
                         </td>
                         <td className="py-2 px-2 w-20 max-w-50 hidden md:table-cell">
                           <div 
                             className="text-gray-900 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                             title={`${submission.UniversityYear} (Click to copy)`}
                             onClick={() => copyCellData(submission.UniversityYear)}
                           >
                             {submission.UniversityYear}
                           </div>
                         </td>
                         <td className="py-2 px-2 w-32 max-w-80">
                           <div 
                             className="text-gray-600 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                             title={`${submission.Major || 'N/A'} (Click to copy)`}
                             onClick={() => copyCellData(submission.Major || 'N/A')}
                           >
                             {submission.Major || 'N/A'}
                           </div>
                         </td>
                         <td className="py-2 px-2 w-24 max-w-80">
                           <div 
                             className="text-gray-600 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                             title={`${submission.startdate || 'N/A'} (Click to copy)`}
                             onClick={() => copyCellData(submission.startdate || 'N/A')}
                           >
                             {submission.startdate || 'N/A'}
                           </div>
                         </td>
                         <td className="py-2 px-2 w-24 max-w-80">
                           <div 
                             className="text-gray-600 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                             title={`${submission.enddate || 'N/A'} (Click to copy)`}
                             onClick={() => copyCellData(submission.enddate || 'N/A')}
                           >
                             {submission.enddate || 'N/A'}
                           </div>
                         </td>
                         <td className="py-2 px-2 w-32 max-w-80">
                           <div 
                             className="text-gray-900 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                             title={`${submission.Channel} (Click to copy)`}
                             onClick={() => copyCellData(submission.Channel)}
                           >
                             {submission.Channel}
                           </div>
                         </td>
                         <td className="py-2 px-2 w-32 max-w-80">
                           <div 
                             className="text-gray-600 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                             title={`${submission.url_ogta || 'N/A'} (Click to copy)`}
                             onClick={() => copyCellData(submission.url_ogta || 'N/A')}
                           >
                             {submission.url_ogta || 'N/A'}
                           </div>
                         </td>
                         <td className="py-2 px-2 w-24 max-w-80">
                           <div 
                             className="text-gray-600 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                             title={`${submission.formDate || 'N/A'} (Click to copy)`}
                             onClick={() => copyCellData(submission.formDate || 'N/A')}
                           >
                             {submission.formDate || 'N/A'}
                           </div>
                         </td>
                         <td className="py-2 px-2 w-32 max-w-80">
                           <div 
                             className="text-gray-900 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                             title={`${submission.promoteLeadership} (Click to copy)`}
                             onClick={() => copyCellData(submission.promoteLeadership)}
                           >
                             {submission.promoteLeadership}
                           </div>
                         </td>
                         <td className="py-2 px-2 w-64 max-w-64 align-top">
                           <div 
                             className="text-gray-900 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                             title={`${submission.ReceiveInformation} (Click to copy)`}
                             onClick={() => copyCellData(submission.ReceiveInformation)}
                           >
                             {submission.ReceiveInformation}
                           </div>
                         </td>
                         <td className="py-2 px-2 w-32 max-w-80">
                           <div 
                             className="text-gray-900 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                             title={`${submission.Demand} (Click to copy)`}
                             onClick={() => copyCellData(submission.Demand)}
                           >
                             {submission.Demand}
                           </div>
                         </td>
                         <td className="py-2 px-2 w-24 max-w-80">
                           <div 
                             className="text-gray-900 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                             title={`${submission.categorize} (Click to copy)`}
                             onClick={() => copyCellData(submission.categorize)}
                           >
                             {submission.categorize}
                           </div>
                         </td>
                         <td className="py-2 px-2 w-32 max-w-80">
                           <div 
                             className="text-gray-500 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                             title={`${submission.utm_source || 'N/A'} (Click to copy)`}
                             onClick={() => copyCellData(submission.utm_source || 'N/A')}
                           >
                             {submission.utm_source || 'N/A'}
                           </div>
                         </td>
                         <td className="py-2 px-2 w-32 max-w-80">
                           <div 
                             className="text-gray-500 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                             title={`${submission.utm_medium || 'N/A'} (Click to copy)`}
                             onClick={() => copyCellData(submission.utm_medium || 'N/A')}
                           >
                             {submission.utm_medium || 'N/A'}
                           </div>
                         </td>
                         <td className="py-2 px-2 w-32 max-w-80">
                           <div 
                             className="text-gray-500 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                             title={`${submission.utm_campaign || 'N/A'} (Click to copy)`}
                             onClick={() => copyCellData(submission.utm_campaign || 'N/A')}
                           >
                             {submission.utm_campaign || 'N/A'}
                           </div>
                         </td>
                         <td className="py-2 px-2 w-24 max-w-80">
                           <div 
                             className="text-gray-500 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                             title={`${submission.utm_id || 'N/A'} (Click to copy)`}
                             onClick={() => copyCellData(submission.utm_id || 'N/A')}
                           >
                             {submission.utm_id || 'N/A'}
                           </div>
                         </td>
                         <td className="py-2 px-2 w-32 max-w-80">
                           <div 
                             className="text-gray-500 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                             title={`${submission.utm_content || 'N/A'} (Click to copy)`}
                             onClick={() => copyCellData(submission.utm_content || 'N/A')}
                           >
                             {submission.utm_content || 'N/A'}
                           </div>
                         </td>
                         <td className="py-2 px-2 w-32 max-w-80">
                           <div 
                             className="text-gray-500 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                             title={`${submission.utm_name || 'N/A'} (Click to copy)`}
                             onClick={() => copyCellData(submission.utm_name || 'N/A')}
                           >
                             {submission.utm_name || 'N/A'}
                           </div>
                         </td>
                         <td className="py-2 px-2 w-32 max-w-80">
                           <div 
                             className="text-gray-500 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                             title={`${submission.utm_term || 'N/A'} (Click to copy)`}
                             onClick={() => copyCellData(submission.utm_term || 'N/A')}
                           >
                             {submission.utm_term || 'N/A'}
                           </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
               </table>
             </div>

                         {filteredRawData.length === 0 && (
               <div className="text-center py-8">
                 <p className="text-gray-500">No submissions found</p>
               </div>
             )}

             {/* Pagination */}
             {totalPages > 1 && (
               <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                 <div className="flex items-center gap-2">
                   <span className="text-sm text-gray-600">Items per page:</span>
                   <select
                     value={itemsPerPage}
                     onChange={(e) => {
                       setItemsPerPage(Number(e.target.value));
                       setCurrentPage(1);
                     }}
                     className="border border-gray-300 rounded px-2 py-1 text-sm"
                   >
                     <option value={25}>25</option>
                     <option value={50}>50</option>
                     <option value={100}>100</option>
                     <option value={200}>200</option>
                   </select>
                 </div>
                 
                 <div className="flex items-center gap-2">
                   <button
                     onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                     disabled={currentPage === 1}
                     className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     Previous
                   </button>
                   
                   <div className="flex items-center gap-1">
                     {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                       let pageNum;
                       if (totalPages <= 5) {
                         pageNum = i + 1;
                       } else if (currentPage <= 3) {
                         pageNum = i + 1;
                       } else if (currentPage >= totalPages - 2) {
                         pageNum = totalPages - 4 + i;
                       } else {
                         pageNum = currentPage - 2 + i;
                       }
                       
                       return (
                         <button
                           key={pageNum}
                           onClick={() => setCurrentPage(pageNum)}
                           className={`px-3 py-1 text-sm border rounded ${
                             currentPage === pageNum
                               ? 'bg-primary text-white border-primary'
                               : 'border-gray-300 hover:bg-gray-50'
                           }`}
                         >
                           {pageNum}
                         </button>
                       );
                     })}
                   </div>
                   
                   <button
                     onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                     disabled={currentPage === totalPages}
                     className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     Next
                   </button>
                 </div>
                 
                 <div className="text-sm text-gray-600">
                   Page {currentPage} of {totalPages} | Showing {startIndex + 1}-{Math.min(endIndex, filteredRawData.length)} of {filteredRawData.length} items
                 </div>
               </div>
             )}
             
             <div className="mt-4 text-center">
               <p className="text-gray-600 text-sm">
                 Total submissions: {submissions.length} | Filtered: {filteredRawData.length}
               </p>
             </div>
          </div>
        )}

        {activeTab === 'cleaned-data' && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Cleaned Data (Deduplicated by Phone/Email)</h2>
            <p className="text-sm text-gray-600 mb-4">💡 Click on any cell to copy its content to clipboard</p>
            
            {/* Search */}
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search university..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>

            {/* Cleaned Data Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-gray-900 max-w-[80rem]">
                <thead>
                  <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2">Allocate</th>
                     <th className="text-left py-2 px-2">Timestamp</th>
                     <th className="text-left py-2 px-2">Form Code</th>
                     <th className="text-left py-2 px-2 min-w-[10rem]">Name</th>
                     <th className="text-left py-2 px-2">Birth</th>
                     <th className="text-left py-2 px-2">FB</th>
                     <th className="text-left py-2 px-2">Phone</th>
                     <th className="text-left py-2 px-2">Email</th>
                     <th className="text-left py-2 px-2">Live Where</th>
                     <th className="text-left py-2 px-2 min-w-[15rem]">University</th>
                     <th className="text-left py-2 px-2">Other Uni</th>
                     <th className="text-left py-2 px-2">Other Uni 2</th>
                     <th className="text-left py-2 px-2">Year</th>
                     <th className="text-left py-2 px-2 min-w-[10rem]">Major</th>
                     <th className="text-left py-2 px-2 min-w-[10rem]">Start Date</th>
                     <th className="text-left py-2 px-2">End Date</th>
                     <th className="text-left py-2 px-2 min-w-[10rem]">Channel</th>
                     <th className="text-left py-2 px-2">URL OGTA</th>
                     <th className="text-left py-2 px-2">Form Date</th>
                     <th className="text-left py-2 px-2">Promote Leadership</th>
                     <th className="text-left py-2 px-2 min-w-[10rem]">Receive Info</th>
                     <th className="text-left py-2 px-2 min-w-[10rem]">Demand</th>
                     <th className="text-left py-2 px-2">Categorize</th>
                     <th className="text-left py-2 px-2">UTM Source</th>
                     <th className="text-left py-2 px-2">UTM Medium</th>
                     <th className="text-left py-2 px-2">UTM Campaign</th>
                     <th className="text-left py-2 px-2">UTM ID</th>
                     <th className="text-left py-2 px-2">UTM Content</th>
                     <th className="text-left py-2 px-2">UTM Name</th>
                     <th className="text-left py-2 px-2">UTM Term</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCleanedData.map((submission, index) => (
                    <tr 
                      key={`clean-${submission.id}-${index}`} 
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="py-2 px-2">
                        {submission.allocated_lc ? (
                          <span className={`px-2 py-1 rounded text-sm font-medium ${getLcBadgeClass(submission.allocated_lc)}`}>
                            {submission.allocated_lc}
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm font-medium">
                            Not Allocated
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-gray-600">{formatDateUtc(submission.timestamp)}</div>
                      </td>
                      <td className="py-2 px-2 w-32 max-w-80">
                        <div className="text-gray-900 truncate" title={submission.form_code}>{submission.form_code}</div>
                      </td>
                      <td className="py-2 px-2 w-32 max-w-80">
                        <div className="font-medium text-gray-900 truncate" title={submission.name || 'N/A'}>{submission.name || 'N/A'}</div>
                      </td>
                      <td className="py-2 px-2 w-24 max-w-80">
                        <div className="text-gray-600 truncate" title={submission.birth || 'N/A'}>{submission.birth || 'N/A'}</div>
                      </td>
                                             <td className="py-2 px-2 w-32 max-w-80">
                         <div className="text-gray-600 truncate" title={submission.fb || 'N/A'}>{submission.fb || 'N/A'}</div>
                       </td>
                      <td className="py-2 px-2 w-32 max-w-80">
                        <div 
                          className="text-gray-600 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                          title={`${submission.phone || 'N/A'} (Click to copy)`}
                          onClick={() => copyCellData(submission.phone || 'N/A')}
                        >
                          {submission.phone || 'N/A'}
                        </div>
                      </td>
                                             <td className="py-2 px-2 w-48 max-w-48">
                         <div className="text-gray-600 truncate" title={submission.email || 'N/A'}>{submission.email || 'N/A'}</div>
                       </td>
                      <td className="py-2 px-2 w-32 max-w-32">
                        <div 
                          className="text-gray-600 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                          title={`${submission.livewhere || 'N/A'} (Click to copy)`}
                          onClick={() => copyCellData(submission.livewhere || 'N/A')}
                        >
                          {submission.livewhere || 'N/A'}
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="font-medium text-gray-900">{submission.uni || 'N/A'}</div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-gray-600">{submission.other_uni || 'N/A'}</div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-gray-600">{submission.other_uni_2 || 'N/A'}</div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-gray-900">{submission.UniversityYear}</div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-gray-600">{submission.Major || 'N/A'}</div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-gray-600">{submission.startdate || 'N/A'}</div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-gray-600">{submission.enddate || 'N/A'}</div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-gray-900">{submission.Channel}</div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-gray-600">{submission.url_ogta || 'N/A'}</div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-gray-600">{submission.formDate || 'N/A'}</div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-gray-900">{submission.promoteLeadership}</div>
                      </td>
                                             <td className="py-2 px-2 w-64 max-w-64 align-top">
                         <div className="text-gray-900 truncate" title={submission.ReceiveInformation}>{submission.ReceiveInformation}</div>
                       </td>
                      <td className="py-2 px-2 w-48">
                        <div className="text-gray-900">{submission.Demand}</div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-gray-900">{submission.categorize}</div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-gray-500">{submission.utm_source || 'N/A'}</div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-gray-500">{submission.utm_medium || 'N/A'}</div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-gray-500">{submission.utm_campaign || 'N/A'}</div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-gray-500">{submission.utm_id || 'N/A'}</div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-gray-500">{submission.utm_content || 'N/A'}</div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-gray-500">{submission.utm_name || 'N/A'}</div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-gray-500">{submission.utm_term || 'N/A'}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredCleanedData.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No cleaned submissions found</p>
              </div>
            )}

            {/* Pagination for Cleaned Data */}
            {filteredCleanedData.length > 0 && (
              <div className="mt-6 flex flex-col items-center space-y-4">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPageCleaned(Math.max(1, currentPageCleaned - 1))}
                    disabled={currentPageCleaned === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  
                  <div className="flex space-x-1">
                    {Array.from({ length: Math.min(5, totalPagesCleaned) }, (_, i) => {
                      let pageNum;
                      if (totalPagesCleaned <= 5) {
                        pageNum = i + 1;
                      } else if (currentPageCleaned <= 3) {
                        pageNum = i + 1;
                      } else if (currentPageCleaned >= totalPagesCleaned - 2) {
                        pageNum = totalPagesCleaned - 4 + i;
                      } else {
                        pageNum = currentPageCleaned - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPageCleaned(pageNum)}
                          className={`px-3 py-1 text-sm border rounded ${
                            currentPageCleaned === pageNum
                              ? 'bg-primary text-white border-primary'
                              : 'border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => setCurrentPageCleaned(Math.min(totalPagesCleaned, currentPageCleaned + 1))}
                    disabled={currentPageCleaned === totalPagesCleaned}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
                
                <div className="text-sm text-gray-600">
                  Page {currentPageCleaned} of {totalPagesCleaned} | Showing {startIndexCleaned + 1}-{Math.min(endIndexCleaned, filteredCleanedData.length)} of {filteredCleanedData.length} items
                </div>
              </div>
            )}

            <div className="mt-4 text-center">
              <p className="text-gray-600 text-sm">
                Total cleaned submissions: {cleanedData.length} | Filtered: {filteredCleanedData.length} | Original: {submissions.length}
              </p>
            </div>
          </div>
        )}

                 {activeTab === 'manual-allocation' && (
           <>
             {/* Manual Allocation Section */}
             <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-8">
               <h2 className="text-lg font-semibold text-gray-900 mb-6">Manual Allocation</h2>
               
               {/* Search and Filter */}
               <div className="flex flex-col md:flex-row gap-4 mb-6">
                 <div className="flex-1">
                   <div className="relative">
                     <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                     <input
                       type="text"
                       placeholder="Search university, other_uni, other_uni_2..."
                       value={searchTerm}
                       onChange={(e) => setSearchTerm(e.target.value)}
                       className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                     />
                   </div>
                 </div>
                 <div className="flex items-center space-x-2">
                   <Filter className="h-4 w-4 text-gray-400" />
                   <span className="text-gray-700 text-sm">
                     {filteredSubmissions.length} unmapped submissions
                     {selectedSubmissions.size > 0 && (
                       <span className="ml-2 text-blue-600 font-medium">
                         ({selectedSubmissions.size} selected)
                       </span>
                     )}
                   </span>
                 </div>
               </div>

               {/* Bulk Allocation Controls */}
               {selectedSubmissions.size > 0 && (
                 <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                   <div className="flex flex-col md:flex-row items-center gap-4">
                     <div className="flex items-center gap-2">
                       <span className="text-sm font-medium text-blue-900">
                         {selectedSubmissions.size} submission(s) selected
                       </span>
                     </div>
                     <div className="flex items-center gap-2">
                       <select
                         value={bulkAllocateLC}
                         onChange={(e) => setBulkAllocateLC(e.target.value)}
                         disabled={isManualAllocating}
                         className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
                       >
                         <option value="">Select LC for bulk allocation</option>
                         <option value="Hanoi">Hanoi</option>
                         <option value="FHN">FHN</option>
                         <option value="NEU">NEU</option>
                         <option value="HCMC">HCMC</option>
                         <option value="FHCMC">FHCMC</option>
                         <option value="HCME">HCME</option>
                         <option value="HCMS">HCMS</option>
                         <option value="Cantho">Cantho</option>
                         <option value="Danang">Danang</option>
                       </select>
                       <button
                         onClick={handleBulkAllocateLC}
                         disabled={!bulkAllocateLC || isBulkAllocating || isManualAllocating}
                         className="px-4 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                       >
                         {isBulkAllocating ? 'Allocating...' : 'Bulk Allocate'}
                       </button>
                       <button
                         onClick={() => setSelectedSubmissions(new Set())}
                         disabled={isManualAllocating}
                         className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50"
                       >
                         Clear Selection
                       </button>
                     </div>
                   </div>
                 </div>
               )}

               {/* Submissions Table */}
               <div className="overflow-x-auto">
                 <table className="w-full text-gray-900 max-w-[80rem]">
                   <thead>
                     <tr className="border-b border-gray-200">
                       <th className="text-left py-2 px-2 w-8">
                         <input
                           type="checkbox"
                           checked={selectedSubmissions.size === paginatedManualData.length && paginatedManualData.length > 0}
                           onChange={handleSelectAll}
                           disabled={isManualAllocating}
                           className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                         />
                       </th>
                       <th className="text-left py-2 px-2">Timestamp</th>
                       <th className="text-left py-2 px-2">Form Code</th>
                       <th className="text-left py-2 px-2">Name</th>
                       <th className="text-left py-2 px-2">University</th>
                       <th className="text-left py-2 px-2">Contact</th>
                       <th className="text-left py-2 px-2">Major</th>
                       <th className="text-left py-2 px-2">Allocate LC</th>
                     </tr>
                   </thead>
                   <tbody>
                     {paginatedManualData.map((submission, index) => (
                                            <tr key={`unmapped-${submission.id}-${index}`} className="border-b border-gray-100 hover:bg-gray-50">
                       <td className="py-2 px-2 w-8">
                         <input
                           type="checkbox"
                           checked={selectedSubmissions.has(submission.id)}
                           onChange={() => handleSelectSubmission(submission.id)}
                           disabled={isManualAllocating}
                           className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                         />
                       </td>
                       <td className="py-2 px-2 w-32 max-w-80">
                           <div className="text-gray-600 truncate" title={formatDateUtc(submission.timestamp)}>{formatDateUtc(submission.timestamp)}</div>
                        </td>
                       <td className="py-2 px-2 w-24 max-w-80">
                         <div className="text-gray-900 truncate" title={submission.form_code}>{submission.form_code}</div>
                       </td>
                       <td className="py-2 px-2 w-32 max-w-80">
                         <div className="font-medium text-gray-900 truncate" title={submission.name || 'N/A'}>{submission.name || 'N/A'}</div>
                       </td>
                       <td className="py-2 px-2 w-48 max-w-80">
                         <div className="text-gray-600 truncate" title={submission.other_uni || 'N/A'}>{submission.other_uni || 'N/A'}</div>
                       </td>
                       <td className="py-2 px-2 w-48 max-w-80">
                         <div className="text-gray-600">
                           <div className="truncate" title={submission.email || 'N/A'}>{submission.email || 'N/A'}</div>
                           <div className="truncate" title={submission.phone || 'N/A'}>{submission.phone || 'N/A'}</div>
                         </div>
                       </td>
                         <td className="py-2 px-2 w-32 max-w-80">
                           <div className="text-gray-600 truncate" title={submission.Major || 'N/A'}>{submission.Major || 'N/A'}</div>
                         </td>
                         <td className="py-2 px-2 w-32 max-w-80">
                             {editingId === submission.id ? (
                               <div className="flex items-center space-x-1">
                                 <select
                                   value={editingLC}
                                   onChange={(e) => setEditingLC(e.target.value)}
                                   className="bg-white border border-gray-300 rounded px-1 py-1 text-gray-900 text-sm"
                                 >
                                   <option value="">Select LC</option>
                                   <option value="Hanoi">Hanoi</option>
                                   <option value="FHN">FHN</option>
                                   <option value="NEU">NEU</option>
                                   <option value="HCMC">HCMC</option>
                                   <option value="FHCMC">FHCMC</option>
                                   <option value="HCME">HCME</option>
                                   <option value="HCMS">HCMS</option>
                                   <option value="Cantho">Cantho</option>
                                   <option value="Danang">Danang</option>
                                 </select>
                                 <button
                                   onClick={() => handleAllocateLC(submission.id, editingLC)}
                                   disabled={!editingLC || isManualAllocating}
                                   className="p-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                                 >
                                   {isManualAllocating ? (
                                     <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                   ) : (
                                     <Check className="h-3 w-3" />
                                   )}
                                 </button>
                                 <button
                                   onClick={() => {
                                     setEditingId(null);
                                     setEditingLC('');
                                   }}
                                   disabled={isManualAllocating}
                                   className="p-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                                 >
                                   <X className="h-3 w-3" />
                                 </button>
                               </div>
                             ) : (
                               <button
                                 onClick={() => {
                                   setEditingId(submission.id);
                                   setEditingLC('');
                                 }}
                                 disabled={isManualAllocating}
                                 className="px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                               >
                                 Allocate
                               </button>
                             )}
                           </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>

                             {filteredSubmissions.length === 0 && (
                 <div className="text-center py-8">
                   <p className="text-gray-500">No unmapped submissions found</p>
                 </div>
               )}

               {/* Pagination for Manual Allocation */}
               {filteredSubmissions.length > 0 && (
                 <div className="mt-6 flex flex-col items-center space-y-4">
                   <div className="flex items-center space-x-2">
                     <button
                       onClick={() => setCurrentPageManual(Math.max(1, currentPageManual - 1))}
                       disabled={currentPageManual === 1}
                       className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                       Previous
                     </button>
                     
                     <div className="flex space-x-1">
                       {Array.from({ length: Math.min(5, totalPagesManual) }, (_, i) => {
                         let pageNum;
                         if (totalPagesManual <= 5) {
                           pageNum = i + 1;
                         } else if (currentPageManual <= 3) {
                           pageNum = i + 1;
                         } else if (currentPageManual >= totalPagesManual - 2) {
                           pageNum = totalPagesManual - 4 + i;
                         } else {
                           pageNum = currentPageManual - 2 + i;
                         }
                         
                         return (
                           <button
                             key={pageNum}
                             onClick={() => setCurrentPageManual(pageNum)}
                             className={`px-3 py-1 text-sm border rounded ${
                               currentPageManual === pageNum
                                 ? 'bg-primary text-white border-primary'
                                 : 'border-gray-300 hover:bg-gray-50'
                             }`}
                           >
                             {pageNum}
                           </button>
                         );
                       })}
                     </div>
                     
                     <button
                       onClick={() => setCurrentPageManual(Math.min(totalPagesManual, currentPageManual + 1))}
                       disabled={currentPageManual === totalPagesManual}
                       className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                       Next
                     </button>
                   </div>
                   
                   <div className="text-sm text-gray-600">
                     Page {currentPageManual} of {totalPagesManual} | Showing {startIndexManual + 1}-{Math.min(endIndexManual, filteredSubmissions.length)} of {filteredSubmissions.length} items
                   </div>
                 </div>
               )}
             </div>

             {/* University Mappings Section */}
             <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
               <h2 className="text-lg font-semibold text-gray-900 mb-4">University Mappings</h2>
               <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                 <div className="relative max-w-md">
                   <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                   <input
                     type="text"
                     placeholder="Search university or LC..."
                     value={mappingSearch}
                     onChange={(e) => setMappingSearch(e.target.value)}
                     className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                   />
                 </div>
                 <div className="text-sm text-gray-600">
                   Total: {universityMappings.length}
                 </div>
               </div>

               {mappingError ? (
                 <div className="text-red-600 text-sm mb-4">{mappingError}</div>
               ) : null}

               <div className="overflow-x-auto">
                 <table className="w-full text-gray-900 max-w-[80rem]">
                   <thead>
                     <tr className="border-b border-gray-200">
                       <th className="text-left py-2 px-2">ID</th>
                       <th className="text-left py-2 px-2">University Name</th>
                       <th className="text-left py-2 px-2">LC Code</th>
                     </tr>
                   </thead>
                   <tbody>
                     {universityMappings
                       .filter(m =>
                         (m.university_name?.toLowerCase() ?? '')
                           .includes(mappingSearch.toLowerCase()) ||
                         (m.lc_code?.toLowerCase() ?? '')
                           .includes(mappingSearch.toLowerCase())
                       )
                       .map(m => (
                         <tr key={`map-${m.id}`} className="border-b border-gray-100 hover:bg-gray-50">
                           <td className="py-2 px-2"><div className="text-gray-600">{m.id}</div></td>
                           <td className="py-2 px-2"><div className="text-gray-900">{m.university_name}</div></td>
                           <td className="py-2 px-2"><div className="text-gray-900">{m.lc_code}</div></td>
                         </tr>
                       ))}
                   </tbody>
                 </table>
               </div>
             </div>
          </>
        )}
      </main>
    </div>
  );
}
