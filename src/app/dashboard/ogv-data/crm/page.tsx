'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft,
  Search,
  Filter,
  Edit,
  Save,
  X,
  Check,
  Database,
  Users
} from 'lucide-react';
import { getCurrentUser, supabase } from '@/lib/supabase';
import MultiSelect from '@/components/MultiSelect';
import SingleSelect from '@/components/SingleSelect';
import { LocalCache, CACHE_KEYS, CACHE_TTL } from '@/lib/cache';

interface FormSubmission {
  id: string;
  timestamp: string;
  'form-code': string;
  name: string;
  birth: string;
  fb: string;
  phone: string;
  email: string;
  livewhere: string;
  uni: string;
  university?: string;
  'other--uni': string;
  'other--uni-2': string;
  UniversityYear: string;
  Major: string;
  startdate: string;
  enddate: string;
  Channel: string;
  'url--ogta': string;
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

interface CRMSalesTracker {
  id: string;
  submission_id: string;
  contact_assign_date: string | null;
  contact_ddl: string | null;
  contact_done: boolean;
  contact_time_done: string | null;
  contact_process_days: number | null;
  contact_status: string;
  cm_ddl: string | null;
  cm_done: boolean;
  cm_time_done: string | null;
  cm_process_days: number | null;
  cm_status: string;
  apl_ddl: string | null;
  apl_done: boolean;
  apl_time_done: string | null;
  apl_process_days: number | null;
  apl_status: string;
  total_contact_apl_days: number | null;
  updated_at: string;
}

export default function CRMPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [crmData, setCrmData] = useState<CRMSalesTracker[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Partial<CRMSalesTracker>>({});
  const [rowEditingData, setRowEditingData] = useState<Record<string, Partial<CRMSalesTracker>>>({});
  const [availableLCs, setAvailableLCs] = useState<string[]>([]);
  const [selectedLC, setSelectedLC] = useState<string>('');
  const [cache] = useState(() => new LocalCache());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  
  // Filter states
  const [selectedMajors, setSelectedMajors] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedStartDates, setSelectedStartDates] = useState<string[]>([]);
  const [selectedReceiveInfo, setSelectedReceiveInfo] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  
  // Copy notification state
  const [copyNotification, setCopyNotification] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (userProfile) {
      loadData();
    }
  }, [userProfile, selectedLC]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedLC, searchTerm, selectedMajors, selectedYears, selectedStartDates, selectedReceiveInfo, selectedChannels]);

  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.push('/auth/login');
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, role, full_name, email, status, lc_code')
        .eq('id', currentUser.id)
        .single();

      if (error) throw error;

      setUser(currentUser);
      setUserProfile(profile);
      
      // If user is not admin, set their LC as the selected LC
      if (profile.role !== 'admin' && profile.lc_code) {
        setSelectedLC(profile.lc_code);
      }
    } catch (error) {
      console.error('Error checking user:', error);
      router.push('/auth/login');
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      // Load available LCs for admin users
      if (userProfile?.role === 'admin') {
        const { data: lcData, error: lcError } = await supabase
          .from('form_submissions')
          .select('allocated_lc')
          .not('allocated_lc', 'is', null);

        if (!lcError && lcData) {
          const lcs = [...new Set(lcData.map(item => item.allocated_lc).filter(Boolean))];
          setAvailableLCs(lcs);
        }
      }

      // Build query for form submissions
      let query = supabase
        .from('form_submissions')
        .select('*')
        .order('timestamp', { ascending: false });

      // Apply LC filter based on user role
      if (userProfile?.role === 'admin') {
        if (selectedLC) {
          query = query.eq('allocated_lc', selectedLC);
        }
      } else {
        // Regular users can only see their LC data
        if (userProfile?.lc_code) {
          query = query.eq('allocated_lc', userProfile.lc_code);
        }
      }

      const { data: submissionsData, error: submissionsError } = await query;

      if (submissionsError) throw submissionsError;

      setSubmissions(submissionsData || []);

      // Load CRM data for the filtered submissions
      if (submissionsData && submissionsData.length > 0) {
        const submissionIds = submissionsData.map(sub => sub.id);
        
        // First, get existing CRM data
        const { data: existingCrmData, error: crmError } = await supabase
          .from('crm_sales_tracker')
          .select('*')
          .in('submission_id', submissionIds)
          .order('updated_at', { ascending: false });

        if (crmError) throw crmError;

        // Create CRM records for submissions that don't have them
        const existingSubmissionIds = existingCrmData?.map(crm => crm.submission_id) || [];
        const missingSubmissionIds = submissionIds.filter(id => !existingSubmissionIds.includes(id));


        if (missingSubmissionIds.length > 0) {
          // Get the submissions data to access their timestamps
          const missingSubmissions = submissionsData.filter(sub => missingSubmissionIds.includes(sub.id));
          
          const newCrmRecords = missingSubmissionIds.map(submissionId => {
            const submission = missingSubmissions.find(sub => sub.id === submissionId);
            
            return {
              submission_id: submissionId,
              contact_assign_date: submission?.timestamp || null,
              contact_ddl: null,
              contact_done: false,
              contact_time_done: null,
              cm_ddl: null,
              cm_done: false,
              cm_time_done: null,
              apl_ddl: null,
              apl_done: false,
              apl_time_done: null,
              updated_at: new Date().toISOString()
            };
          });


          const { error: insertError } = await supabase
            .from('crm_sales_tracker')
            .insert(newCrmRecords);

        }

        // Reload CRM data after creating missing records
        const { data: finalCrmData, error: finalCrmError } = await supabase
          .from('crm_sales_tracker')
          .select('*')
          .in('submission_id', submissionIds)
          .order('updated_at', { ascending: false });

        if (finalCrmError) throw finalCrmError;
        setCrmData(finalCrmData || []);
      } else {
        setCrmData([]);
      }

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditCrm = (crmItem: CRMSalesTracker) => {
    setEditingId(crmItem.id);
    setEditingData(crmItem);
  };

           const handleSaveCrm = async (newData?: Partial<CRMSalesTracker>, itemId?: string) => {
      const idToUpdate = itemId || editingId;
      if (!idToUpdate) return;
      
      const dataToUpdate = newData || editingData;

      try {
        // Prepare update data without generated columns
        const updateData: any = {
          updated_at: new Date().toISOString()
        };

        // Only add fields that are explicitly provided in dataToUpdate
        if (dataToUpdate.hasOwnProperty('contact_assign_date')) {
          updateData.contact_assign_date = dataToUpdate.contact_assign_date;
        }
        if (dataToUpdate.hasOwnProperty('contact_ddl')) {
          updateData.contact_ddl = dataToUpdate.contact_ddl;
        }
        if (dataToUpdate.hasOwnProperty('contact_done')) {
          updateData.contact_done = dataToUpdate.contact_done;
        }
        if (dataToUpdate.hasOwnProperty('cm_ddl')) {
          updateData.cm_ddl = dataToUpdate.cm_ddl;
        }
        if (dataToUpdate.hasOwnProperty('cm_done')) {
          updateData.cm_done = dataToUpdate.cm_done;
        }
        if (dataToUpdate.hasOwnProperty('apl_ddl')) {
          updateData.apl_ddl = dataToUpdate.apl_ddl;
        }
        if (dataToUpdate.hasOwnProperty('apl_done')) {
          updateData.apl_done = dataToUpdate.apl_done;
        }

                         // Only update fields that are actually being changed
        const existingItem = crmData.find(item => item.id === idToUpdate);
        
        // Contact fields - only update if explicitly provided
        if (dataToUpdate.hasOwnProperty('contact_done')) {
          if (dataToUpdate.contact_done) {
            const existingContactTimeDone = existingItem?.contact_time_done;
            updateData.contact_time_done = dataToUpdate.contact_time_done || existingContactTimeDone || new Date().toISOString();
          } else {
            updateData.contact_time_done = null;
          }
        }

        // CM fields - only update if explicitly provided
        if (dataToUpdate.hasOwnProperty('cm_done')) {
          if (dataToUpdate.cm_done) {
            const existingCmTimeDone = existingItem?.cm_time_done;
            updateData.cm_time_done = dataToUpdate.cm_time_done || existingCmTimeDone || new Date().toISOString();
          } else {
            updateData.cm_time_done = null;
          }
        }

        // APL fields - only update if explicitly provided
        if (dataToUpdate.hasOwnProperty('apl_done')) {
          if (dataToUpdate.apl_done) {
            const existingAplTimeDone = existingItem?.apl_time_done;
            updateData.apl_time_done = dataToUpdate.apl_time_done || existingAplTimeDone || new Date().toISOString();
          } else {
            updateData.apl_time_done = null;
          }
        }

        // Note: contact_process_days is a generated column, so we don't update it directly
        // The database will automatically calculate it based on contact_time_done and contact_assign_date

        const { error } = await supabase
          .from('crm_sales_tracker')
          .update(updateData)
          .eq('id', idToUpdate);

        if (error) throw error;

        if (!newData) {
          setEditingId(null);
          setEditingData({});
        }
        await loadData();
      } catch (error) {
        console.error('Error updating CRM data:', error);
      }
    };

  const handleCancelCrm = () => {
    setEditingId(null);
    setEditingData({});
  };

  const copyCellData = async (data: string) => {
    try {
      await navigator.clipboard.writeText(data);
      setCopyNotification({ show: true, message: 'Copied to clipboard!' });
      
      // Hide notification after 2 seconds
      setTimeout(() => {
        setCopyNotification({ show: false, message: '' });
      }, 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      setCopyNotification({ show: true, message: 'Failed to copy to clipboard' });
      
      // Hide notification after 2 seconds
      setTimeout(() => {
        setCopyNotification({ show: false, message: '' });
      }, 2000);
    }
  };

  const getSubmissionById = (id: string) => {
    return submissions.find(sub => sub.id === id);
  };

  // Helper function to calculate days between two dates (returns decimal for partial days)
  const calculateDays = (startDate: string | null, endDate: string | null): number | null => {

    
    if (!startDate || !endDate) {
      return null;
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Calculate difference without Math.abs to see the actual direction
    const rawDiffTime = end.getTime() - start.getTime();
    
    // Use Math.abs for final calculation but log the raw difference
    const diffTime = Math.abs(rawDiffTime);
    
    const days = Math.round((diffTime / (1000 * 60 * 60 * 24)) * 100) / 100;
    return days;
  };

  // Helper function to calculate Contact process days (from assign date to contact time done)
  const calculateContactProcessDays = (assignDate: string | null, contactTimeDone: string | null, submissionTimestamp: string | null): number | null => {

    
    if (!contactTimeDone) {
      return null;
    }
    
    // Use assign_date if available, otherwise use submission timestamp
    const startTime = assignDate || submissionTimestamp;
    if (!startTime) {
      return null;
    }
    
    const result = calculateDays(startTime, contactTimeDone);
    return result;
  };



  // Helper function to calculate CM process days (from contact time done to CM time done)
  const calculateCmProcessDays = (contactTimeDone: string | null, cmTimeDone: string | null): number | null => {

    
    if (!cmTimeDone) {
      return null;
    }
    
    if (!contactTimeDone) {
      return null;
    }
    
    const result = calculateDays(contactTimeDone, cmTimeDone);
    return result;
  };

  // Helper function to calculate APL process days (from CM time done to APL time done)
  const calculateAplProcessDays = (cmTimeDone: string | null, aplTimeDone: string | null): number | null => {

    if (!cmTimeDone || !aplTimeDone) {
      return null;
    }
    
    const result = calculateDays(cmTimeDone, aplTimeDone);
    return result;
  };

  // Helper function to determine status based on completion and deadlines
  const getStatus = (done: boolean, ddl: string | null, timeDone: string | null): string => {
    if (done) {
      // If done, check if it was completed late
      if (timeDone && ddl) {
        const timeDoneDate = new Date(timeDone);
        const deadline = new Date(ddl);
        // Compare only the date part for deadline comparison
        const timeDoneDateOnly = new Date(timeDoneDate.getFullYear(), timeDoneDate.getMonth(), timeDoneDate.getDate());
        const deadlineDateOnly = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
        if (timeDoneDateOnly > deadlineDateOnly) return 'late';
      }
      return 'done';
    }
    
    if (!ddl) return 'not_started';
    
    // If not done, check if current time is past deadline
    const deadline = new Date(ddl);
    const now = new Date();
    const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const deadlineDateOnly = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
    if (nowDateOnly > deadlineDateOnly) return 'late';
    
    return 'in_progress';
  };

  // Helper function to get status display text and styling
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'done':
        return { text: 'Done', className: 'bg-green-100 text-green-800' };
      case 'late':
        return { text: 'Late', className: 'bg-red-100 text-red-800' };
      case 'in_progress':
        return { text: 'In Progress', className: 'bg-yellow-100 text-yellow-800' };
      default:
        return { text: 'Not Started', className: 'bg-gray-100 text-gray-800' };
    }
  };

  const filteredCrmData = crmData.filter(item => {
    const submission = getSubmissionById(item.submission_id);
    if (!submission) {
      return false;
    }

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      
      const matchesSearch = (
        submission.name?.toLowerCase().includes(searchLower) ||
        submission.email?.toLowerCase().includes(searchLower) ||
        submission.phone?.toLowerCase().includes(searchLower) ||
        submission['form-code']?.toLowerCase().includes(searchLower) ||
        submission.university?.toLowerCase().includes(searchLower) ||
        item.contact_status?.toLowerCase().includes(searchLower) ||
        item.cm_status?.toLowerCase().includes(searchLower) ||
        item.apl_status?.toLowerCase().includes(searchLower)
      );
      if (!matchesSearch) return false;
    }

    // Major filter
    if (selectedMajors.length > 0 && !selectedMajors.includes(submission.Major)) {
      return false;
    }

    // Year filter
    if (selectedYears.length > 0 && !selectedYears.includes(submission.UniversityYear)) {
      return false;
    }

    // Start Date filter
    if (selectedStartDates.length > 0 && !selectedStartDates.includes(submission.startdate)) {
      return false;
    }

         // Receive Info filter
     if (selectedReceiveInfo.length > 0) {
       const receiveInfo = submission.ReceiveInformation || '';
       const hasMatchingReceiveInfo = selectedReceiveInfo.some(selected => 
         receiveInfo.toLowerCase().includes(selected.toLowerCase())
       );
       if (!hasMatchingReceiveInfo) {
         return false;
       }
     }

    // Channel filter
    if (selectedChannels.length > 0 && !selectedChannels.includes(submission.Channel)) {
      return false;
    }

    return true;
  });

  // Sort filtered data by timestamp (newest first)
  const sortedCrmData = filteredCrmData.sort((a, b) => {
    const submissionA = getSubmissionById(a.submission_id);
    const submissionB = getSubmissionById(b.submission_id);
    
    if (!submissionA || !submissionB) return 0;
    
    const timestampA = new Date(submissionA.timestamp).getTime();
    const timestampB = new Date(submissionB.timestamp).getTime();
    
    return timestampB - timestampA; // Newest first
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedCrmData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCrmData = sortedCrmData.slice(startIndex, endIndex);


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-bl from-[#f3f4f6] to-[#e5e7eb]">
        <img src="/giphy.gif" alt="Loading..." className="h-32 w-32 object-contain" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-bl from-[#f3f4f6] to-[#e5e7eb]">
      {/* Copy Notification */}
      {copyNotification.show && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg flex items-center space-x-2">
          <Check className="h-4 w-4" />
          <span>{copyNotification.message}</span>
        </div>
      )}
      
      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard/ogv-data')}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Back to oGV Data</span>
              </button>
              <h1 className="text-3xl font-bold text-gray-900">CRM Management</h1>
              <button
                onClick={loadData}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                Refresh Data
              </button>
            </div>
          </div>
          <p className="mt-2 text-gray-600">
            Manage contact, CM, and APL processes for form submissions
            {userProfile?.role !== 'admin' && userProfile?.lc_code && (
              <span className="ml-2 text-blue-600">
                (Viewing data for LC: {userProfile.lc_code})
              </span>
            )}
                         <span className="ml-4 text-sm text-gray-500">
               (Submissions: {submissions.length}, CRM Records: {crmData.length}, Filtered: {filteredCrmData.length}, Page: {currentPage}/{totalPages})
             </span>
          </p>
        </div>

                 {/* Filters */}
         <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
           <div className="space-y-4">
             {/* Search and LC Filter Row */}
             <div className="flex flex-col sm:flex-row gap-4">
               {/* Search */}
               <div className="flex-1">
                 <div className="relative">
                   <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                   <input
                     type="text"
                     placeholder="Search by name, email, phone, form code, university, or status..."
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                   />
                 </div>
               </div>

               {/* LC Filter (Admin only) */}
               {userProfile?.role === 'admin' && (
                 <div className="w-full sm:w-64">
                   <SingleSelect
                     label="Filter by LC"
                     options={availableLCs.map(lc => ({ value: lc, label: lc }))}
                     selected={selectedLC}
                     onChange={setSelectedLC}
                     placeholder="Select LC"
                   />
                 </div>
               )}
             </div>

             {/* Filter Options Row */}
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                               {/* Major Filter */}
                <MultiSelect
                  label="Major"
                  options={[
                    { value: 'Khác', label: 'Khác' },
                    { value: 'Khoa học Máy tính/ Công nghệ thông tin', label: 'Khoa học Máy tính/ Công nghệ thông tin' },
                    { value: 'Kinh tế và Kinh doanh', label: 'Kinh tế và Kinh doanh' },
                    { value: 'Kỹ sư', label: 'Kỹ sư' },
                    { value: 'Ngôn ngữ', label: 'Ngôn ngữ' },
                    { value: 'Tài chính, Kế toán và Kiểm toán', label: 'Tài chính, Kế toán và Kiểm toán' },
                    { value: 'Tiếp thị & Truyền thông', label: 'Tiếp thị & Truyền thông' }
                  ]}
                  selected={selectedMajors}
                  onChange={setSelectedMajors}
                />

                {/* Year Filter */}
                <MultiSelect
                  label="Year"
                  options={[
                    { value: 'Đang học Cao học (Thạc sĩ)', label: 'Đang học Cao học (Thạc sĩ)' },
                    { value: 'Gap year', label: 'Gap year' },
                    { value: 'Mới tốt nghiệp dưới 6 tháng', label: 'Mới tốt nghiệp dưới 6 tháng' },
                    { value: 'Năm 1', label: 'Năm 1' },
                    { value: 'Năm 2', label: 'Năm 2' },
                    { value: 'Năm 3', label: 'Năm 3' },
                    { value: 'Năm 4/Năm 5/Năm 6/Khác', label: 'Năm 4/Năm 5/Năm 6/Khác' },
                    { value: 'Tốt nghiệp trên 1 năm', label: 'Tốt nghiệp trên 1 năm' },
                    { value: 'Tốt nghiệp từ 6 tháng đến 1 năm', label: 'Tốt nghiệp từ 6 tháng đến 1 năm' }
                  ]}
                  selected={selectedYears}
                  onChange={setSelectedYears}
                />

                {/* Start Date Filter */}
                <MultiSelect
                  label="Start Date"
                  options={[
                    { value: 'Càng sớm càng tốt', label: 'Càng sớm càng tốt' },
                    { value: 'Khác', label: 'Khác' },
                    { value: 'Mình tìm hiểu trước để năm sau đi', label: 'Mình tìm hiểu trước để năm sau đi' },
                    { value: 'Trong vòng 2 - 3 tháng nữa', label: 'Trong vòng 2 - 3 tháng nữa' },
                    { value: 'Trong vòng 3 - 4 tháng nữa', label: 'Trong vòng 3 - 4 tháng nữa' },
                    { value: 'Trong vòng 4 - 5 tháng nữa', label: 'Trong vòng 4 - 5 tháng nữa' }
                  ]}
                  selected={selectedStartDates}
                  onChange={setSelectedStartDates}
                />

                                 {/* Receive Info Filter */}
                 <MultiSelect
                   label="Receive Info"
                   options={[
                     { value: 'Có, hãy gửi mình tất cả những thông tin về chương trình của AIESEC cũng như cơ hội từ Đối tác quốc gia', label: 'Chương trình AIESEC & Đối tác quốc gia' },
                     { value: 'Có, hãy gửi mình thông tin cơ hội nghề nghiệp từ Đối tác quốc gia của AIESEC', label: 'Cơ hội nghề nghiệp từ Đối tác quốc gia' },
                     { value: 'Có, hãy gửi mình thông tin những chương trình khác của AIESEC', label: 'Chương trình khác của AIESEC' },
                     { value: 'Không, mình không muốn nhận thông tin nào', label: 'Không muốn nhận thông tin' }
                   ]}
                   selected={selectedReceiveInfo}
                   onChange={setSelectedReceiveInfo}
                 />

                {/* Channel Filter */}
                <MultiSelect
                  label="Channel"
                  options={[
                    { value: 'Bài đăng trên các Pages Facebook khác', label: 'Bài đăng trên các Pages Facebook khác' },
                    { value: 'Các dự án xã hội của AIESEC (YouthSpeak, Leadership Heading for the Future,....)', label: 'Các dự án xã hội của AIESEC' },
                    { value: 'Các sự kiện hội thảo giới thiệu về chương trình Global Volunteer', label: 'Các sự kiện hội thảo giới thiệu về chương trình Global Volunteer' },
                    { value: 'Email marketing', label: 'Email marketing' },
                    { value: 'Fanpage AIESEC-Global Volunteer: 6 Tuần Tình Nguyện Quốc Tế', label: 'Fanpage AIESEC-Global Volunteer' },
                    { value: 'Fanpage, Instagram, Tiktok của AIESEC in Vietnam', label: 'Fanpage, Instagram, Tiktok của AIESEC in Vietnam' },
                    { value: 'Mình từng là thành viên của AIESEC', label: 'Mình từng là thành viên của AIESEC' },
                    { value: 'Nhóm cộng đồng "Mình đi tình nguyên quốc tế cùng AIESEC"', label: 'Nhóm cộng đồng AIESEC' },
                    { value: 'Thành viên của AIESEC giới thiệu', label: 'Thành viên của AIESEC giới thiệu' },
                    { value: 'Tình nguyện viên từng tham gia Global Volunteer giới thiệu', label: 'Tình nguyện viên từng tham gia Global Volunteer giới thiệu' }
                  ]}
                  selected={selectedChannels}
                  onChange={setSelectedChannels}
                />

               {/* Clear Filters Button */}
               <div className="flex items-end">
                 <button
                   onClick={() => {
                     setSearchTerm('');
                     setSelectedMajors([]);
                     setSelectedYears([]);
                     setSelectedStartDates([]);
                     setSelectedReceiveInfo([]);
                     setSelectedChannels([]);
                   }}
                   className="w-full px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 text-sm"
                 >
                   Clear Filters
                 </button>
               </div>
             </div>
           </div>
         </div>

        {/* CRM Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                             <thead className="bg-gray-50">
                 <tr>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     LEAD INFORMATION
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Contact Process
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     CM Process
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     APL Process
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Total Time
                   </th>
                 </tr>
               </thead>
                             <tbody className="bg-white divide-y divide-gray-200">
                 {paginatedCrmData.map((crmItem) => {
                  const submission = getSubmissionById(crmItem.submission_id);
                  if (!submission) return null;

                  return (
                    <tr key={crmItem.id} className="hover:bg-gray-50">
                                             {/* LEAD INFORMATION */}
                       <td className="px-6 py-4">
                         <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                           {/* Header */}
                           <div className="border-b border-gray-200 pb-2">
                             <h4 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
                               Lead Information
                             </h4>
                           </div>

                           {/* Personal Information Section */}
                           <div className="space-y-3">
                             <div className="bg-white rounded-md p-3 border border-gray-200">
                               <h5 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                                 Personal Details
                               </h5>
                               <div className="grid grid-cols-2 gap-3 text-xs">
                                 <div>
                                   <span className="font-medium text-gray-700 block mb-1">Name:</span>
                                   <div 
                                     className="text-gray-900 font-medium truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                                     title={`${submission.name || 'N/A'} (Click to copy)`}
                                     onClick={() => copyCellData(submission.name || 'N/A')}
                                   >
                                     {submission.name || 'N/A'}
                                   </div>
                                 </div>
                                 <div>
                                   <span className="font-medium text-gray-700 block mb-1">Birth Year:</span>
                                   <div 
                                     className="text-gray-900 cursor-pointer hover:bg-gray-100 p-1 rounded" 
                                     title={`${submission.birth || 'N/A'} (Click to copy)`}
                                     onClick={() => copyCellData(submission.birth || 'N/A')}
                                   >
                                     {submission.birth || 'N/A'}
                                   </div>
                                 </div>
                                 <div>
                                   <span className="font-medium text-gray-700 block mb-1">Phone:</span>
                                   <div 
                                     className="text-gray-900 font-mono text-xs truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                                     title={`${submission.phone || 'N/A'} (Click to copy)`}
                                     onClick={() => copyCellData(submission.phone || 'N/A')}
                                   >
                                     {submission.phone || 'N/A'}
                                   </div>
                                 </div>
                                 <div>
                                   <span className="font-medium text-gray-700 block mb-1">Email:</span>
                                   <div 
                                     className="text-gray-900 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                                     title={`${submission.email || 'N/A'} (Click to copy)`}
                                     onClick={() => copyCellData(submission.email || 'N/A')}
                                   >
                                     {submission.email || 'N/A'}
                                   </div>
                                 </div>
                               </div>
                             </div>

                             {/* Social Media */}
                             <div className="bg-white rounded-md p-3 border border-gray-200">
                               <h5 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                                 Social Media
                               </h5>
                               <div className="text-xs">
                                 <span className="font-medium text-gray-700 block mb-1">Facebook:</span>
                                 <div className="text-blue-600 truncate hover:text-blue-800 cursor-pointer hover:bg-gray-100 p-1 rounded" title={`${submission.fb || 'N/A'} (Click to copy)`}>
                                   {submission.fb ? (
                                     <a 
                                       href={submission.fb} 
                                       target="_blank" 
                                       rel="noopener noreferrer" 
                                       className="hover:underline"
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         copyCellData(submission.fb || 'N/A');
                                       }}
                                     >
                                       {submission.fb}
                                     </a>
                                   ) : (
                                     <span onClick={() => copyCellData('N/A')}>N/A</span>
                                   )}
                                 </div>
                               </div>
                             </div>

                             {/* Location & Education */}
                             <div className="bg-white rounded-md p-3 border border-gray-200">
                               <h5 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                                 Location & Education
                               </h5>
                               <div className="space-y-2 text-xs">
                                 <div>
                                   <span className="font-medium text-gray-700 block mb-1">Location:</span>
                                   <div 
                                     className="text-gray-900 cursor-pointer hover:bg-gray-100 p-1 rounded" 
                                     title={`${submission.livewhere || 'N/A'} (Click to copy)`}
                                     onClick={() => copyCellData(submission.livewhere || 'N/A')}
                                   >
                                     {submission.livewhere || 'N/A'}
                                   </div>
                                 </div>
                                 <div>
                                   <span className="font-medium text-gray-700 block mb-1">University:</span>
                                   <div 
                                     className="text-gray-900 cursor-pointer hover:bg-gray-100 p-1 rounded" 
                                     title={`${submission.uni || submission['other--uni-2'] || 'N/A'} (Click to copy)`}
                                     onClick={() => copyCellData(submission.uni || submission['other--uni-2'] || 'N/A')}
                                   >
                                     {submission.uni || submission['other--uni-2'] || 'N/A'}
                                   </div>
                                 </div>
                                 <div>
                                   <span className="font-medium text-gray-700 block mb-1">Major:</span>
                                   <div 
                                     className="text-gray-900 cursor-pointer hover:bg-gray-100 p-1 rounded" 
                                     title={`${submission.Major || 'N/A'} (Click to copy)`}
                                     onClick={() => copyCellData(submission.Major || 'N/A')}
                                   >
                                     {submission.Major || 'N/A'}
                                   </div>
                                 </div>
                               </div>
                             </div>

                             {/* Timeline & Marketing */}
                             <div className="bg-white rounded-md p-3 border border-gray-200">
                               <h5 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                                 Timeline & Marketing
                               </h5>
                               <div className="space-y-2 text-xs">
                                 <div>
                                   <span className="font-medium text-gray-700 block mb-1">Timeline:</span>
                                   <div 
                                     className="text-gray-900 cursor-pointer hover:bg-gray-100 p-1 rounded" 
                                     title={`${submission.startdate || 'N/A'} (Click to copy)`}
                                     onClick={() => copyCellData(submission.startdate || 'N/A')}
                                   >
                                     {submission.startdate || 'N/A'}
                                   </div>
                                 </div>
                                 <div>
                                   <span className="font-medium text-gray-700 block mb-1">Marketing Channel:</span>
                                   <div 
                                     className="text-gray-900 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                                     title={`${submission.Channel || 'N/A'} (Click to copy)`}
                                     onClick={() => copyCellData(submission.Channel || 'N/A')}
                                   >
                                     {submission.Channel || 'N/A'}
                                   </div>
                                 </div>
                                 <div>
                                   <span className="font-medium text-gray-700 block mb-1">Marketing Tactic:</span>
                                   <div 
                                     className="text-gray-900 truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                                     title={`${submission.utm_medium || 'N/A'} (Click to copy)`}
                                     onClick={() => copyCellData(submission.utm_medium || 'N/A')}
                                   >
                                     {submission.utm_medium || 'N/A'}
                                   </div>
                                 </div>
                               </div>
                             </div>

                             {/* Registration Details */}
                             <div className="bg-white rounded-md p-3 border border-gray-200">
                               <h5 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                                 Registration Details
                               </h5>
                               <div className="grid grid-cols-2 gap-3 text-xs">
                                 <div>
                                   <span className="font-medium text-gray-700 block mb-1">Sign-up Date:</span>
                                   <div 
                                     className="text-gray-900 font-medium cursor-pointer hover:bg-gray-100 p-1 rounded" 
                                     title={`${new Date(submission.timestamp).toLocaleDateString()} (Click to copy)`}
                                     onClick={() => copyCellData(new Date(submission.timestamp).toLocaleDateString())}
                                   >
                                     {new Date(submission.timestamp).toLocaleDateString()}
                                   </div>
                                 </div>
                                 <div>
                                   <span className="font-medium text-gray-700 block mb-1">Form Code:</span>
                                   <div 
                                     className="text-gray-900 font-mono text-xs truncate cursor-pointer hover:bg-gray-100 p-1 rounded" 
                                     title={`${submission['form-code'] || 'N/A'} (Click to copy)`}
                                     onClick={() => copyCellData(submission['form-code'] || 'N/A')}
                                   >
                                     {submission['form-code'] || 'N/A'}
                                   </div>
                                 </div>
                                 <div className="col-span-2">
                                   <span className="font-medium text-gray-700 block mb-1">Local Committee:</span>
                                   <div 
                                     className="text-gray-900 font-medium cursor-pointer hover:bg-gray-100 p-1 rounded" 
                                     title={`${submission.allocated_lc || 'N/A'} (Click to copy)`}
                                     onClick={() => copyCellData(submission.allocated_lc || 'N/A')}
                                   >
                                     {submission.allocated_lc || 'N/A'}
                                   </div>
                                 </div>
                               </div>
                             </div>
                           </div>
                         </div>
                       </td>

                                             {/* Contact Process */}
                       <td className="px-6 py-4">
                         <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                           {/* Header */}
                           <div className="border-b border-blue-200 pb-2">
                             <h4 className="text-sm font-semibold text-blue-800 uppercase tracking-wide">
                               Contact Process
                             </h4>
                           </div>

                                                       {/* Assign Date */}
                            <div className="bg-white rounded-md p-3 border border-blue-200">
                              <h5 className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
                                Assign Date & Time
                              </h5>
                              <input
                                type="datetime-local"
                                step="1"
                                value={rowEditingData[crmItem.id]?.contact_assign_date ? rowEditingData[crmItem.id].contact_assign_date!.slice(0, 19) : (crmItem.contact_assign_date ? crmItem.contact_assign_date.slice(0, 19) : (submission?.timestamp ? submission.timestamp.slice(0, 19) : ''))}
                                onChange={(e) => {
                                  const newData = { ...rowEditingData[crmItem.id] || {}, contact_assign_date: e.target.value };
                                  setRowEditingData(prev => ({
                                    ...prev,
                                    [crmItem.id]: newData
                                  }));
                                }}
                                onBlur={(e) => {
                                  const newData = { ...rowEditingData[crmItem.id] || {}, contact_assign_date: e.target.value };
                                  handleSaveCrm(newData, crmItem.id);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const newData = { ...rowEditingData[crmItem.id] || {}, contact_assign_date: e.currentTarget.value };
                                    handleSaveCrm(newData, crmItem.id);
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                className="w-full px-3 py-2 text-sm border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>

                           {/* DDL */}
                           <div className="bg-white rounded-md p-3 border border-blue-200">
                             <h5 className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
                               Deadline
                             </h5>
                                                           <input
                                type="date"
                                value={rowEditingData[crmItem.id]?.contact_ddl ? rowEditingData[crmItem.id].contact_ddl!.split('T')[0] : (crmItem.contact_ddl ? crmItem.contact_ddl.split('T')[0] : '')}
                                onChange={(e) => {
                                  const newData = { ...rowEditingData[crmItem.id] || {}, contact_ddl: e.target.value };
                                  setRowEditingData(prev => ({
                                    ...prev,
                                    [crmItem.id]: newData
                                  }));
                                }}
                                onBlur={(e) => {
                                  const newData = { ...rowEditingData[crmItem.id] || {}, contact_ddl: e.target.value };
                                  handleSaveCrm(newData, crmItem.id);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const newData = { ...rowEditingData[crmItem.id] || {}, contact_ddl: e.currentTarget.value };
                                    handleSaveCrm(newData, crmItem.id);
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                className="w-full px-3 py-2 text-sm border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                           </div>

                                                       {/* Time Done - Only show when done */}
                            {crmItem.contact_done && (
                              <div className="bg-white rounded-md p-3 border border-blue-200">
                                <h5 className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
                                  Time Done
                                </h5>
                                                                 <div className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-900">
                                   {crmItem.contact_time_done ? new Date(crmItem.contact_time_done).toLocaleString() : 'N/A'}
                                 </div>
                              </div>
                            )}

                           {/* Done Checkbox */}
                           <div className="bg-white rounded-md p-3 border border-blue-200">
                             <div className="flex items-center space-x-3">
                               <input
                                 type="checkbox"
                                 checked={crmItem.contact_done || false}
                                                                   onChange={(e) => {
                                    const newData = { 
                                      ...rowEditingData[crmItem.id] || {}, 
                                      contact_done: e.target.checked,
                                      contact_time_done: e.target.checked ? (rowEditingData[crmItem.id]?.contact_time_done || new Date().toISOString()) : null
                                    };
                                    setRowEditingData(prev => ({
                                      ...prev,
                                      [crmItem.id]: newData
                                    }));
                                    handleSaveCrm(newData, crmItem.id);
                                  }}
                                 className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                               />
                               <span className="text-sm font-medium text-blue-800">Mark as Done</span>
                             </div>
                           </div>

                           {/* Process Time & Status */}
                           <div className="bg-white rounded-md p-3 border border-blue-200">
                             <div className="space-y-2">
                               <div className="text-xs">
                                 <span className="font-medium text-blue-700">Process Time:</span>
                                 <div className="text-gray-900 font-medium">
                                   {(() => {
                                     // Check if Contact is completed
                                     if (!crmItem.contact_time_done) {
                                       return 'Contact not completed';
                                     }
                                     
                                     const contactProcessDays = calculateContactProcessDays(crmItem.contact_assign_date, crmItem.contact_time_done, submission?.timestamp);
             
                                     
                                     // Note: contact_process_days is automatically calculated by the database
                                     
                                     return contactProcessDays ? `${contactProcessDays} days` : '0 day';
                                   })()}
                                 </div>
                               </div>
                               <div className="text-xs">
                                 <span className="font-medium text-blue-700">Status:</span>
                                 {(() => {
                                   const status = getStatus(crmItem.contact_done, crmItem.contact_ddl, crmItem.contact_time_done);
                                   const display = getStatusDisplay(status);
                                   return (
                                     <span className={`ml-2 px-2 py-1 text-xs rounded-full ${display.className}`}>
                                       {display.text}
                                     </span>
                                   );
                                 })()}
                               </div>
                             </div>
                           </div>
                         </div>
                       </td>

                                             {/* CM Process */}
                       <td className="px-6 py-4">
                         <div className="bg-green-50 rounded-lg p-4 space-y-3">
                           {/* Header */}
                           <div className="border-b border-green-200 pb-2">
                             <h4 className="text-sm font-semibold text-green-800 uppercase tracking-wide">
                               CM Process
                             </h4>
                           </div>

                           {/* DDL */}
                           <div className="bg-white rounded-md p-3 border border-green-200">
                             <h5 className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">
                               Deadline
                             </h5>
                                                           <input
                                type="date"
                                value={rowEditingData[crmItem.id]?.cm_ddl ? rowEditingData[crmItem.id].cm_ddl!.split('T')[0] : (crmItem.cm_ddl ? crmItem.cm_ddl.split('T')[0] : '')}
                                onChange={(e) => {
                                  const newData = { ...rowEditingData[crmItem.id] || {}, cm_ddl: e.target.value };
                                  setRowEditingData(prev => ({
                                    ...prev,
                                    [crmItem.id]: newData
                                  }));
                                }}
                                onBlur={(e) => {
                                  const newData = { ...rowEditingData[crmItem.id] || {}, cm_ddl: e.target.value };
                                  handleSaveCrm(newData, crmItem.id);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const newData = { ...rowEditingData[crmItem.id] || {}, cm_ddl: e.currentTarget.value };
                                    handleSaveCrm(newData, crmItem.id);
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                className="w-full px-3 py-2 text-sm border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              />
                           </div>

                                                       {/* Time Done - Only show when done */}
                            {crmItem.cm_done && (
                              <div className="bg-white rounded-md p-3 border border-green-200">
                                <h5 className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">
                                  Time Done
                                </h5>
                                                                 <div className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-900">
                                   {crmItem.cm_time_done ? new Date(crmItem.cm_time_done).toLocaleString() : 'N/A'}
                                 </div>
                              </div>
                            )}

                           {/* Done Checkbox */}
                           <div className="bg-white rounded-md p-3 border border-green-200">
                             <div className="flex items-center space-x-3">
                               <input
                                 type="checkbox"
                                 checked={crmItem.cm_done || false}
                                                                   onChange={(e) => {
                                    const newData = { 
                                      ...rowEditingData[crmItem.id] || {}, 
                                      cm_done: e.target.checked,
                                      cm_time_done: e.target.checked ? (rowEditingData[crmItem.id]?.cm_time_done || new Date().toISOString()) : null
                                    };
                                    setRowEditingData(prev => ({
                                      ...prev,
                                      [crmItem.id]: newData
                                    }));
                                    handleSaveCrm(newData, crmItem.id);
                                  }}
                                 className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                               />
                               <span className="text-sm font-medium text-green-800">Mark as Done</span>
                             </div>
                           </div>

                           {/* Process Time & Status */}
                           <div className="bg-white rounded-md p-3 border border-green-200">
                             <div className="space-y-2">
                               <div className="text-xs">
                                 <span className="font-medium text-green-700">Process Time:</span>
                                 <div className="text-gray-900 font-medium">
                                   {(() => {
                                     
                                     // Check if CM is completed
                                     if (!crmItem.cm_time_done) {
                                       return 'CM not completed';
                                     }
                                     
                                     const cmProcessDays = calculateCmProcessDays(crmItem.contact_time_done, crmItem.cm_time_done);
                   
                                     
                                     return cmProcessDays ? `${cmProcessDays} days` : '0 day';
                                   })()}
                                 </div>
                               </div>
                               <div className="text-xs">
                                 <span className="font-medium text-green-700">Status:</span>
                                 {(() => {
                                   const status = getStatus(crmItem.cm_done, crmItem.cm_ddl, crmItem.cm_time_done);
                                   const display = getStatusDisplay(status);
                                   return (
                                     <span className={`ml-2 px-2 py-1 text-xs rounded-full ${display.className}`}>
                                       {display.text}
                                     </span>
                                   );
                                 })()}
                               </div>
                             </div>
                           </div>
                         </div>
                       </td>

                                             {/* APL Process */}
                       <td className="px-6 py-4">
                         <div className="bg-purple-50 rounded-lg p-4 space-y-3">
                           {/* Header */}
                           <div className="border-b border-purple-200 pb-2">
                             <h4 className="text-sm font-semibold text-purple-800 uppercase tracking-wide">
                               APL Process
                             </h4>
                           </div>

                           {/* DDL */}
                           <div className="bg-white rounded-md p-3 border border-purple-200">
                             <h5 className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2">
                               Deadline
                             </h5>
                                                           <input
                                type="date"
                                value={rowEditingData[crmItem.id]?.apl_ddl ? rowEditingData[crmItem.id].apl_ddl!.split('T')[0] : (crmItem.apl_ddl ? crmItem.apl_ddl.split('T')[0] : '')}
                                onChange={(e) => {
                                  const newData = { ...rowEditingData[crmItem.id] || {}, apl_ddl: e.target.value };
                                  setRowEditingData(prev => ({
                                    ...prev,
                                    [crmItem.id]: newData
                                  }));
                                }}
                                onBlur={(e) => {
                                  const newData = { ...rowEditingData[crmItem.id] || {}, apl_ddl: e.target.value };
                                  handleSaveCrm(newData, crmItem.id);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const newData = { ...rowEditingData[crmItem.id] || {}, apl_ddl: e.currentTarget.value };
                                    handleSaveCrm(newData, crmItem.id);
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                className="w-full px-3 py-2 text-sm border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              />
                           </div>

                                                       {/* Time Done - Only show when done */}
                            {crmItem.apl_done && (
                              <div className="bg-white rounded-md p-3 border border-purple-200">
                                <h5 className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2">
                                  Time Done
                                </h5>
                                                                 <div className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-900">
                                   {crmItem.apl_time_done ? new Date(crmItem.apl_time_done).toLocaleString() : 'N/A'}
                                 </div>
                              </div>
                            )}

                           {/* Done Checkbox */}
                           <div className="bg-white rounded-md p-3 border border-purple-200">
                             <div className="flex items-center space-x-3">
                               <input
                                 type="checkbox"
                                 checked={crmItem.apl_done || false}
                                                                   onChange={(e) => {
                                    const newData = { 
                                      ...rowEditingData[crmItem.id] || {}, 
                                      apl_done: e.target.checked,
                                      apl_time_done: e.target.checked ? (rowEditingData[crmItem.id]?.apl_time_done || new Date().toISOString()) : null
                                    };
                                    setRowEditingData(prev => ({
                                      ...prev,
                                      [crmItem.id]: newData
                                    }));
                                    handleSaveCrm(newData, crmItem.id);
                                  }}
                                 className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                               />
                               <span className="text-sm font-medium text-purple-800">Mark as Done</span>
                             </div>
                           </div>

                           {/* Process Time & Status */}
                           <div className="bg-white rounded-md p-3 border border-purple-200">
                             <div className="space-y-2">
                               <div className="text-xs">
                                 <span className="font-medium text-purple-700">Process Time:</span>
                                 <div className="text-gray-900 font-medium">
                                   {(() => {
                                     
                                     // Check if APL is completed
                                     if (!crmItem.apl_time_done) {
                                       return 'APL not completed';
                                     }
                                     
                                     // Use generated column value
                                     return crmItem.apl_process_days ? `${crmItem.apl_process_days} days` : '0 days';
                                   })()}
                                 </div>
                               </div>
                               <div className="text-xs">
                                 <span className="font-medium text-purple-700">Status:</span>
                                 {(() => {
                                   const status = getStatus(crmItem.apl_done, crmItem.apl_ddl, crmItem.apl_time_done);
                                   const display = getStatusDisplay(status);
                                   return (
                                     <span className={`ml-2 px-2 py-1 text-xs rounded-full ${display.className}`}>
                                       {display.text}
                                     </span>
                                   );
                                 })()}
                               </div>
                             </div>
                           </div>
                         </div>
                       </td>

                                                                                           {/* Total Time */}
                        <td className="px-6 py-4">
                          <div className="bg-orange-50 rounded-lg p-4 space-y-3">
                            {/* Header */}
                            <div className="border-b border-orange-200 pb-2">
                              <h4 className="text-sm font-semibold text-orange-800 uppercase tracking-wide">
                                Total Time
                              </h4>
                            </div>

                            {/* Total Contact-APL Time */}
                            <div className="bg-white rounded-md p-3 border border-orange-200">
                              <h5 className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-2">
                                Total Contact-APL
                              </h5>
                              <div className="text-sm">
                                <div className="text-gray-900 font-bold text-lg">
                                  {(() => {
                                    
                                    // Check if APL is completed
                                    if (!crmItem.apl_time_done) {
                                      return 'APL not completed';
                                    }
                                    
                                    // Use contact_assign_date if available, otherwise use submission timestamp
                                    const startTime = crmItem.contact_assign_date || submission?.timestamp;
                                    if (!startTime) {
                                      return 'No start time available';
                                    }
                                    
                                    const totalDays = calculateDays(startTime, crmItem.apl_time_done);
                                    
                                    return totalDays ? `${totalDays} days` : '0 day';
                                  })()}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  From Contact Assign to APL Complete
                                </div>
                              </div>
                            </div>

                            {/* Progress Summary */}
                            <div className="bg-white rounded-md p-3 border border-orange-200">
                              <h5 className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-2">
                                Progress Summary
                              </h5>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Contact:</span>
                                  <span className={`font-medium ${crmItem.contact_done ? 'text-green-600' : 'text-gray-400'}`}>
                                    {crmItem.contact_done ? '✓ Done' : 'Pending'}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">CM:</span>
                                  <span className={`font-medium ${crmItem.cm_done ? 'text-green-600' : 'text-gray-400'}`}>
                                    {crmItem.cm_done ? '✓ Done' : 'Pending'}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">APL:</span>
                                  <span className={`font-medium ${crmItem.apl_done ? 'text-green-600' : 'text-gray-400'}`}>
                                    {crmItem.apl_done ? '✓ Done' : 'Pending'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

                     {filteredCrmData.length === 0 && (
             <div className="text-center py-12">
               <Database className="mx-auto h-12 w-12 text-gray-400" />
               <h3 className="mt-2 text-sm font-medium text-gray-900">No CRM data found</h3>
               <p className="mt-1 text-sm text-gray-500">
                 {searchTerm ? 'Try adjusting your search terms.' : 'No CRM records available for the selected criteria.'}
               </p>
             </div>
           )}

           {/* Pagination Controls */}
           {filteredCrmData.length > 0 && (
             <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
               <div className="flex-1 flex justify-between sm:hidden">
                 <button
                   onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                   disabled={currentPage === 1}
                   className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   Previous
                 </button>
                 <button
                   onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                   disabled={currentPage === totalPages}
                   className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   Next
                 </button>
               </div>
               <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                 <div>
                   <p className="text-sm text-gray-700">
                     Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                     <span className="font-medium">{Math.min(endIndex, filteredCrmData.length)}</span> of{' '}
                     <span className="font-medium">{filteredCrmData.length}</span> results
                   </p>
                 </div>
                 <div>
                   <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                     <button
                       onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                       disabled={currentPage === 1}
                       className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                       <span className="sr-only">Previous</span>
                       <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                         <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                       </svg>
                     </button>
                     
                     {/* Page numbers */}
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
                           className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                             currentPage === pageNum
                               ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                               : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                           }`}
                         >
                           {pageNum}
                         </button>
                       );
                     })}
                     
                     <button
                       onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                       disabled={currentPage === totalPages}
                       className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                       <span className="sr-only">Next</span>
                       <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                         <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                       </svg>
                     </button>
                   </nav>
                 </div>
               </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
