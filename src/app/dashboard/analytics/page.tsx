'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  BarChart3, 
  TrendingUp, 
  PieChart,
  Users
} from 'lucide-react';
import { getCurrentUser, supabase } from '@/lib/supabase';
import MultiSelect from '@/components/MultiSelect';

interface FormSubmission {
  id: string;
  allocated_lc: string;
  uni: string;
  university?: string;
  other_uni?: string;
  other_uni_2?: string;
  timestamp: string;
  form_data: any;
  Demand: string;
  UniversityYear?: string;
  utm_source?: string;
  utm_term?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_id?: string;
  utm_content?: string;
  utm_name?: string;
}

interface UniversityStats {
  university: string;
  count: number;
  percentage: number;
}

interface YearOfStudyStats {
  yearOfStudy: string;
  count: number;
  percentage: number;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [allSubmissions, setAllSubmissions] = useState<FormSubmission[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<FormSubmission[]>([]);
  const [selectedLC, setSelectedLC] = useState<string>('FHN');
  const [chartType, setChartType] = useState<'market' | 'yearOfStudy'>('market');
  const [selectedUniversity, setSelectedUniversity] = useState<string>('all');
  
  // Filters
  const [monthFilter, setMonthFilter] = useState<string>('');
  const [termFilter, setTermFilter] = useState<string>('');
  const [phaseFilter, setPhaseFilter] = useState<string>('');
  const [phaseRanges, setPhaseRanges] = useState<Array<{ code: string; start: string | null; end: string | null }>>([]);
  const [phasesMeta, setPhasesMeta] = useState<Array<{ code: string; term: number; half: number; start: string | null; end: string | null }>>([]);

  // Available LCs
  const availableLCs = ['FHN', 'Hanoi', 'NEU', 'Danang', 'FHCMC', 'HCMC', 'HCME', 'HCMS', 'Cantho'];

  // Year of study columns mapping
  const yearColumns = [
    'Năm 1',
    'Năm 2',
    'Năm 3',
    'Năm 4/Năm 5/Năm 6/Khác',
    'Mới tốt nghiệp dưới 6 tháng',
    'Tốt nghiệp trên 1 năm',
    'Tốt nghiệp từ 6 tháng đến 1 năm',
    'Gap year',
    'Đang học Cao học (Thạc sĩ)'
  ];


  const buildYearOfStudyMatrix = () => {
    // Row labels: all LCs + special allocated_lc labels that appear (e.g., EMT, Organic, EST)
    const rowsSet = new Set<string>(availableLCs);
    filteredSubmissions.forEach(s => { if (s.allocated_lc) rowsSet.add(String(s.allocated_lc)); });
    const rows = Array.from(rowsSet);

    // Init matrix
    const data: Record<string, Record<string, number>> = {};
    rows.forEach(r => { data[r] = {}; yearColumns.forEach(c => data[r][c] = 0); });

    filteredSubmissions.forEach(sub => {
      const lc = sub.allocated_lc || 'Unknown';
      const form = sub.form_data || {};
      const yos = form.year_of_study ?? form.yearOfStudy ?? form.UniversityYear ?? sub.UniversityYear ?? form['University Year'] ?? form.university_year;
      if (!data[lc]) { data[lc] = {}; yearColumns.forEach(c => data[lc][c] = 0); }
      if (!yearColumns.includes(yos)) return;
      data[lc][yos] = (data[lc][yos] || 0) + 1;
    });

    // Totals and max for heat
    let maxCell = 0;
    rows.forEach(r => yearColumns.forEach(c => { maxCell = Math.max(maxCell, data[r]?.[c] || 0); }));

    const colTotals: Record<string, number> = {};
    yearColumns.forEach(c => { colTotals[c] = rows.reduce((s, r) => s + (data[r]?.[c] || 0), 0); });
    const rowTotals: Record<string, number> = {};
    rows.forEach(r => { rowTotals[r] = yearColumns.reduce((s, c) => s + (data[r]?.[c] || 0), 0); });
    const grandTotal = Object.values(colTotals).reduce((a,b)=>a+b,0);

    return { rows, columns: yearColumns, data, colTotals, rowTotals, maxCell, grandTotal };
  };

  const heatColor = (value: number, max: number): string => {
    if (max <= 0) return '#ffffff';
    const t = Math.min(1, value / max);
    // Interpolate from very light green to saturated green
    const start = { r: 232, g: 245, b: 232 }; // #e8f5e8
    const end = { r: 0, g: 193, b: 110 };     // #00c16e
    const r = Math.round(start.r + (end.r - start.r) * t);
    const g = Math.round(start.g + (end.g - start.g) * t);
    const b = Math.round(start.b + (end.b - start.b) * t);
    return `rgb(${r}, ${g}, ${b})`;
  };

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.push('/auth/login');
        return;
      }

      setUser(currentUser);
      await loadData();
      
      try {
        const { data: phases } = await supabase
          .from('phases')
          .select('term, half, code, start_date, end_date')
          .order('term', { ascending: false })
          .order('half', { ascending: false });
        setPhaseRanges((phases as any[] || []).map(p => ({ code: String(p.code), start: p.start_date ?? null, end: p.end_date ?? null })));
        setPhasesMeta((phases as any[] || []).map(p => ({ code: String(p.code), term: Number(p.term), half: Number(p.half), start: p.start_date ?? null, end: p.end_date ?? null })));
      } catch {}
    } catch (error) {
      console.error('Error checking user:', error);
      router.push('/auth/login');
    } finally {
      setLoading(false);
		}
	};

	const loadData = async () => {
		try {
      // Get all form submissions with pagination
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

      setAllSubmissions(allSubmissions);
		} catch (error) {
			console.error('Error loading data:', error);
		}
	};

  // Apply filters
  useEffect(() => {
    if (!allSubmissions || allSubmissions.length === 0) return;

    const getVal = (obj: any, keys: string[]): any => {
      for (const k of keys) {
        const v = obj?.[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') return v;
      }
      return '';
    };

    const matchesMonth = (s: any) => {
    if (!monthFilter) return true;
    try {
        const date = new Date(s.timestamp);
        const month = date.getUTCMonth() + 1;
        const year = date.getUTCFullYear();
        const set = new Set(monthFilter.split(',').filter(Boolean));
        return set.has(`${month}/${year}`);
      } catch { return true; }
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

    const filtered = allSubmissions.filter((s: any) => 
      matchesMonth(s) && matchesTerm(s) && matchesPhase(s)
    );

    setFilteredSubmissions(filtered);
  }, [allSubmissions, monthFilter, termFilter, phaseFilter, phaseRanges]);

  // Get university statistics for selected LC
  const getUniversityStats = (): UniversityStats[] => {
    const lcSubmissions = filteredSubmissions.filter(s => s.allocated_lc === selectedLC);
    const universityMap = new Map<string, number>();

    lcSubmissions.forEach(submission => {
      const university = submission.university || submission.uni || 'Unknown';
      universityMap.set(university, (universityMap.get(university) || 0) + 1);
    });

    const total = lcSubmissions.length;
    return Array.from(universityMap.entries())
      .map(([university, count]) => ({
        university,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);
  };

  // Get year of study statistics
  const getYearOfStudyStats = (): YearOfStudyStats[] => {
    let submissions = filteredSubmissions.filter(s => s.allocated_lc === selectedLC);
    
    // Filter by selected university if not 'all'
    if (selectedUniversity !== 'all') {
      submissions = submissions.filter(s => 
        (s.university || s.uni) === selectedUniversity
      );
    }

    const yearMap = new Map<string, number>();

    submissions.forEach(submission => {
      // Extract year of study from multiple possible sources
      const formData = submission.form_data || {};
      const yearOfStudy = 
        formData.year_of_study || 
        formData.yearOfStudy || 
        formData.UniversityYear ||
        submission.UniversityYear ||
        formData['University Year'] ||
        formData.university_year ||
        'Unknown';
      
      // Clean up the year value
      const cleanYear = String(yearOfStudy).trim();
      const finalYear = cleanYear || 'Unknown';
      
      yearMap.set(finalYear, (yearMap.get(finalYear) || 0) + 1);
    });

    const total = submissions.length;
    return Array.from(yearMap.entries())
      .map(([yearOfStudy, count]) => ({
        yearOfStudy,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);
  };

  // Get available universities for the selected LC
  const getAvailableUniversities = (): string[] => {
    const lcSubmissions = filteredSubmissions.filter(s => s.allocated_lc === selectedLC);
    const universities = new Set<string>();
    
    lcSubmissions.forEach(submission => {
      const university = submission.university || submission.uni;
      if (university) universities.add(university);
    });

    return Array.from(universities).sort();
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

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
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">Analytics</h1>
           </div>
         </div>
       </header>

      <div className="flex">
        <main className="flex-1 p-3 sm:p-4 md:p-6">
          {/* Filters */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 sm:p-4 mb-4 sm:mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                <MultiSelect
                  label="Month"
                  options={Array.from(new Set(filteredSubmissions.map(s => {
                    const date = new Date(s.timestamp);
                    return `${date.getUTCMonth() + 1}/${date.getUTCFullYear()}`;
                  }))).sort().map(m => ({ label: m, value: m }))}
                  selected={monthFilter ? monthFilter.split(',') : []}
                  onChange={(vals) => setMonthFilter(vals.join(','))}
              />
            </div>
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
              <div className="md:col-span-1 flex items-center">
              <button
                  onClick={() => { setMonthFilter(''); setTermFilter(''); setPhaseFilter(''); }} 
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                  Reset
              </button>
            </div>
          </div>
        </div>

          {/* LC Tabs */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 sm:p-4 mb-4 sm:mb-6">
            <div className="flex flex-wrap gap-1 sm:gap-2">
              {availableLCs.map((lc) => (
             <button
                  key={lc}
                  onClick={() => setSelectedLC(lc)}
                  className={`px-2 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                    selectedLC === lc
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {lc}
             </button>
              ))}
             </div>
               </div>

          {/* Chart Type Selection */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 sm:p-4 mb-4 sm:mb-6">
            <div className="flex items-center space-x-2 sm:space-x-4">
             <button
                onClick={() => setChartType('market')}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  chartType === 'market'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <PieChart className="mr-2 h-4 w-4" />
                Market Allocation
             </button>
             <button
                onClick={() => setChartType('yearOfStudy')}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  chartType === 'yearOfStudy'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Users className="mr-2 h-4 w-4" />
                Year of Study
             </button>
           </div>

            {/* University filter for Year of Study */}
            {chartType === 'yearOfStudy' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select University</label>
                <select
                  value={selectedUniversity}
                  onChange={(e) => setSelectedUniversity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">All Universities</option>
                  {getAvailableUniversities().map((uni) => (
                    <option key={uni} value={uni}>{uni}</option>
                  ))}
                </select>
               </div>
             )}
         </div>

                    {/* Chart Display */}
           <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 sm:p-4 md:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {chartType === 'market' 
                ? `Market Allocation in ${monthFilter || termFilter || phaseFilter || 'All Time'} of forms (${selectedLC})`
                : `Year of Study ${selectedUniversity !== 'all' ? selectedUniversity : selectedLC}`
              }
            </h2>

            {/* Bar Chart */}
            {chartType === 'market' ? (
              <div className="space-y-4 mb-8">
                {getUniversityStats().map((stat, index) => (
                  <div key={stat.university} className="flex items-center space-x-2 sm:space-x-4">
                    <div className="w-32 sm:w-48 lg:w-64 text-sm font-medium text-gray-900 truncate">
                      {stat.university}
               </div>
                 <div className="flex-1">
                      <div className="bg-gray-100 rounded-full h-6 relative">
                        <div 
                          className="bg-primary rounded-full h-6 transition-all duration-500"
                          style={{ width: `${stat.percentage}%` }}
                        ></div>
                           </div>
                           </div>
                    <div className="w-20 sm:w-24 text-sm font-medium text-gray-900 text-right">
                      {formatNumber(stat.count)} ({stat.percentage.toFixed(1)}%)
                           </div>
                           </div>
                ))}
                           </div>
            ) : (
              <div className="space-y-4 mb-8">
                {getYearOfStudyStats().map((stat, index) => (
                  <div key={stat.yearOfStudy} className="flex items-center space-x-2 sm:space-x-4">
                    <div className="w-32 sm:w-48 text-sm font-medium text-gray-900">
                      {stat.yearOfStudy}
                    </div>
                    <div className="flex-1">
                      <div className="bg-gray-100 rounded-full h-6 relative">
                        <div 
                          className="bg-primary rounded-full h-6 transition-all duration-500"
                          style={{ width: `${stat.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="w-20 sm:w-24 text-sm font-medium text-gray-900 text-right">
                      {formatNumber(stat.count)} ({stat.percentage.toFixed(1)}%)
                    </div>
                  </div>
                ))}

                {/* Heatmap table */}
                <div className="overflow-x-auto mt-6">
                  {(() => {
                    const { rows, columns, data, colTotals, rowTotals, maxCell, grandTotal } = buildYearOfStudyMatrix();
                    return (
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr>
                            <th className="text-left py-2 px-3" style={{ backgroundColor: '#037EF3', color: 'white' }}>LC</th>
                            {columns.map(col => (
                              <th key={col} className="text-center py-2 px-3" style={{ backgroundColor: '#037EF3', color: 'white' }}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((lc, idx) => (
                            <tr key={lc} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                              <td className="py-2 px-3 font-medium" style={{ backgroundColor: '#f0f0f0' }}>{lc}</td>
                              {columns.map(col => {
                                const val = data[lc]?.[col] || 0;
                                return (
                                  <td key={`${lc}-${col}`} className="py-2 px-3 text-center" style={{ backgroundColor: heatColor(val, maxCell), color: val > maxCell * 0.6 ? '#ffffff' : '#000000' }}>
                                    {formatNumber(val)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                          {/* Row totals */}
                          <tr>
                            <td className="py-2 px-3 font-bold text-gray-900 text-center" style={{ backgroundColor: '#ffc845' }}>TOTAL</td>
                            {columns.map(col => (
                              <td key={`total-${col}`} className="py-2 px-3 font-bold text-center" style={{ backgroundColor: '#ffc845', color: '#000000' }}>{formatNumber(colTotals[col] || 0)}</td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Pie Chart */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                {chartType === 'market' 
                  ? `MARKET ALLOCATION IN ${monthFilter || termFilter || phaseFilter || 'ALL TIME'} OF FORMS (${selectedLC})`
                  : `YEAR OF STUDY ${selectedUniversity !== 'all' ? selectedUniversity : selectedLC}`
                }
              </h3>
              
              <div className="flex flex-col lg:flex-row gap-8">
                                {/* Pie Chart */}
                <div className="flex-1 flex justify-center">
                  <div className="relative w-80 h-80">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                      {(() => {
                        const stats = chartType === 'market' ? getUniversityStats() : getYearOfStudyStats();
                        const colors = [
                          '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
                          '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
                          '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2',
                          '#F9E79F', '#ABEBC6', '#FAD7A0', '#D5A6BD', '#A9CCE3'
                        ];
                        
                        let currentAngle = 0;
                        const total = stats.reduce((sum, stat) => sum + stat.count, 0);
                        
                        return stats.map((stat, index) => {
                          const percentage = total > 0 ? (stat.count / total) * 100 : 0;
                          const angle = (percentage / 100) * 360;
                          const startAngle = currentAngle;
                          const endAngle = currentAngle + angle;
                          
                          // Calculate SVG path for pie slice
                          const startRad = (startAngle - 90) * Math.PI / 180;
                          const endRad = (endAngle - 90) * Math.PI / 180;
                          const radius = 40;
                          const centerX = 50;
                          const centerY = 50;
                          
                          const x1 = centerX + radius * Math.cos(startRad);
                          const y1 = centerY + radius * Math.sin(startRad);
                          const x2 = centerX + radius * Math.cos(endRad);
                          const y2 = centerY + radius * Math.sin(endRad);
                          
                          const largeArcFlag = angle > 180 ? 1 : 0;
                          
                          const path = [
                            `M ${centerX} ${centerY}`,
                            `L ${x1} ${y1}`,
                            `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                            'Z'
                          ].join(' ');
                          
                          currentAngle += angle;
                          
                          const label = chartType === 'market' ? (stat as UniversityStats).university : (stat as YearOfStudyStats).yearOfStudy;
                      
                      return (
                            <g key={label}>
                              <path
                                d={path}
                                fill={colors[index % colors.length]}
                                stroke="#fff"
                                strokeWidth="0.5"
                                className="cursor-pointer hover:opacity-80 transition-opacity"
                                onMouseEnter={(e) => {
                                  const tooltip = document.createElement('div');
                                  tooltip.className = 'fixed bg-black text-white px-3 py-2 rounded text-sm z-50 pointer-events-none';
                                  tooltip.textContent = `${label}: ${stat.count} (${stat.percentage.toFixed(1)}%)`;
                                  tooltip.style.left = e.clientX + 10 + 'px';
                                  tooltip.style.top = e.clientY - 10 + 'px';
                                  tooltip.id = 'pie-tooltip';
                                  document.body.appendChild(tooltip);
                                }}
                                onMouseMove={(e) => {
                                  const tooltip = document.getElementById('pie-tooltip');
                                  if (tooltip) {
                                    tooltip.style.left = e.clientX + 10 + 'px';
                                    tooltip.style.top = e.clientY - 10 + 'px';
                                  }
                                }}
                                onMouseLeave={() => {
                                  const tooltip = document.getElementById('pie-tooltip');
                                  if (tooltip) {
                                    document.body.removeChild(tooltip);
                                  }
                                }}
                              />
                            </g>
                          );
                        });
                      })()}
                    </svg>
                  </div>
                </div>
                
                {/* Legend */}
                 <div className="flex-1">
                  <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto">
                    {(chartType === 'market' ? getUniversityStats() : getYearOfStudyStats()).map((stat, index) => {
                      const colors = [
                        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
                        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
                        '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2',
                        '#F9E79F', '#ABEBC6', '#FAD7A0', '#D5A6BD', '#A9CCE3'
                      ];
                      
                      return (
                        <div key={chartType === 'market' ? (stat as UniversityStats).university : (stat as YearOfStudyStats).yearOfStudy} className="flex items-center space-x-3 text-sm">
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: colors[index % colors.length] }}
                          ></div>
                          <div className="flex-1 min-w-0">
                            <div className="truncate font-medium text-gray-900">
                              {chartType === 'market' ? (stat as UniversityStats).university : (stat as YearOfStudyStats).yearOfStudy}
                         </div>
                               </div>
                          <div className="text-gray-600 font-medium">
                            {stat.percentage.toFixed(1)}%
               </div>
                 </div>
                         );
                       })}
                     </div>
                   </div>
                   </div>
                 </div>
             </div>
      </main>
      </div>
    </div>
  );
}
