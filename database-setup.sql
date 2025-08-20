-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'pending')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('active', 'inactive', 'pending')),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Allow users to read their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Allow admins to read all profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Allow admins to insert profiles
CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Allow admins to update profiles
CREATE POLICY "Admins can update profiles" ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'user',
    'pending'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create form_submissions table
CREATE TABLE IF NOT EXISTS public.form_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  university TEXT NOT NULL,
  allocated_lc TEXT,
  form_data JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for form_submissions
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

-- Form submissions policies
CREATE POLICY "Users can view own submissions" ON public.form_submissions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all submissions" ON public.form_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Anyone can insert submissions" ON public.form_submissions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update submissions" ON public.form_submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create university mapping table
CREATE TABLE IF NOT EXISTS public.university_mapping (
  id SERIAL PRIMARY KEY,
  university_name TEXT UNIQUE NOT NULL,
  lc_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);



-- Insert university mappings
INSERT INTO public.university_mapping (university_name, lc_code) VALUES
-- Hanoi
('Hanoi - Đại học Quốc gia Hà Nội (Vietnam National University)', 'Hanoi'),
('Hanoi - Trường Đại học Khoa học Tự nhiên - Đại học Quốc gia Hà Nội (VNU University of Science)', 'Hanoi'),
('Hanoi - Trường Đại học Khoa học Xã hội và Nhân văn - Đại học Quốc gia Hà Nội (VNU University of Social Sciences and Humanities)', 'Hanoi'),
('Hanoi - Trường Đại học Ngoại ngữ - Đại học Quốc gia Hà Nội (VNU University of Languages and International Studies)', 'Hanoi'),
('Hanoi - Trường Đại học Công nghệ - Đại học Quốc gia Hà Nội (VNU University of Engineering and Technology)', 'Hanoi'),
('Hanoi - Trường Đại học Kinh tế - Đại học Quốc gia Hà Nội (VNU University of Economics)', 'Hanoi'),
('Hanoi - Trường Đại học Giáo dục - Đại học Quốc gia Hà Nội (VNU University of Education)', 'Hanoi'),
('Hanoi - Trường Đại học Việt - Nhật - Đại học Quốc gia Hà Nội (VNU Vietnam Japan University)', 'Hanoi'),
('Hanoi - Trường Đại học Y Dược - Đại học Quốc gia Hà Nội (VNU University of Medicine and Pharmacy)', 'Hanoi'),
('Hanoi - Trường Đại học Luật - Đại học Quốc gia Hà Nội (VNU University of Law)', 'Hanoi'),
('Hanoi - Trường Quốc tế - Đại học Quốc gia Hà Nội (VNU International School)', 'Hanoi'),
('Hanoi - Trường Quản trị và Kinh doanh - Đại học Quốc gia Hà Nội (VNU Hanoi School of Business and Management)', 'Hanoi'),
('Hanoi - Trường Khoa học liên ngành và Nghệ thuật - Đại học Quốc gia Hà Nội (VNU School of Interdisciplinary Sciences and Arts)', 'Hanoi'),
('Hanoi - Khoa Quốc tế Pháp ngữ - Đại học Quốc gia Hà Nội (International Francophone Institute)', 'Hanoi'),
('Hanoi - Đại học Hà Nội + LaTrobe (Hanoi University + LaTrobe)', 'Hanoi'),
('Hanoi - Học viện Ngân hàng (Banking Academy)','Hanoi'),
('Hanoi - Đại học Bách khoa Hà Nội (Hanoi University of Science and Technology)', 'Hanoi'),
('Hanoi - Đại học Thương mại (Vietnam University of Commerce)', 'Hanoi'),
('Hanoi - Đại học Khoa học và Công nghệ Hà Nội (University of Science and Technology of Hanoi)', 'Hanoi'),
('Hanoi - Truyền thông đa phương tiện ARENA (ARENA Multimedia)', 'Hanoi'),
('Hanoi - Đại học Kinh doanh và Công nghệ (Hanoi University of Business and Technology (HUBT))', 'Hanoi'),
('Hanoi - Đại học Quốc tế RMIT (RMIT University (Hanoi))', 'Hanoi'),
('Hanoi - Đại học Kiến trúc Hà Nội (Hanoi Architectural University)', 'Hanoi'),
('Hanoi - Đại học Lao động Xã hội (University of Labour and Social Affairs)', 'Hanoi'),
('Hanoi - Đại học Kinh tế Kỹ thuật Công nghiệp (University of Economic and Technical Industries)', 'Hanoi'),
('Hanoi - Đại học Thủy lợi (Water Resources University)', 'Hanoi'),
('Hanoi - Đại học Công đoàn (Vietnam Trade Union University)', 'Hanoi'),
('Hanoi - Học viện Quân y (Vietnam Military Medical University)', 'Hanoi'),
('Hanoi - Đại học Đại Nam (Dai Nam University)', 'Hanoi'),
('Hanoi - Học viện Thanh Thiếu niên Việt Nam (Vietnam Youth Academy)', 'Hanoi'),
('Hanoi - Đại học Công nghiệp Việt Hung (Viet Hung Industrial University)', 'Hanoi'),
('Hanoi - Đại học Sư phạm Nghệ thuật Trung ương Hà Nội (National University of Art Education)', 'Hanoi'),


-- Dựa vào cụm này, hãy tạo tiếp sql ở trên

-- Example: 
-- ('<university_name>', '<lc_code>'),

-- Hanoi
('Hanoi - Đại học Tài chính Ngân hàng Hà Nội (Financial and Banking University)', 'Hanoi'),
('Hanoi - Đại học Công nghệ và Quản lý Hữu nghị (Huu Nghi University of Technology and Management)', 'Hanoi'),
('Hanoi - Đại học Tài nguyên và Môi trường Hà Nội (Hanoi University of Natural Resources and Environment)', 'Hanoi'),
('Hanoi - Đại học Y Hà Nội (Hanoi Medical University)', 'Hanoi'),
('Hanoi - Đại học Mỹ thuật Việt Nam (Vietnam University of Fine Arts)', 'Hanoi'),
('Hanoi - Học viện Nông nghiệp Việt Nam (VNUA) (Vietnam University of Agriculture)', 'Hanoi'),
('Hanoi - University College London (UCL) (University College London (UCL))', 'Hanoi'),
('Hanoi - Trường cao đẳng du lịch Hà Nội (Hanoi tourism college)', 'Hanoi'),
('Hanoi - Cao đẳng Y Hà Nội (Hanoi Medical College)', 'Hanoi'),
('Hanoi - Đại học Ngoại thương (Foreign Trade University)', 'FHN'),
('Hanoi - Học viện Ngoại giao (Diplomatic Academy of Vietnam)', 'FHN'),
('Hanoi - Học viện Báo chí Tuyên truyền (Academy of Journalism and Communication)', 'FHN'),
('Hanoi - Đại học Sư phạm Hà Nội (Hanoi National University of Education)', 'FHN'),
('Hanoi - Đại học Luật Hà Nội (Hanoi Law University)', 'FHN'),
('Hanoi - Đại học FPT (FPT University)', 'FHN'),
('Hanoi - Học viện Tài chính (Academy of Finance)', 'FHN'),
('Hanoi - British University Vietnam (British University Vietnam)', 'FHN'),
('Hanoi - Đại học Mỹ thuật Công nghiệp (Industrial Fine Art University)', 'FHN'),
('Hanoi - Học viện Công nghệ Bưu chính Viễn thông (Posts and Telecommunications Institute of Technology)', 'FHN'),
('Hanoi - Đại học Công nghệ Giao thông vận tải (University of Transport Technology)', 'FHN'),
('Hanoi - Đại học Dược Hà Nội (Hanoi University of Pharmacy)', 'FHN'),
('Hanoi - Đại học Điện lực (Electric Power University)', 'FHN'),
('Hanoi - Đại học Lâm nghiệp (Vietnam Forestry University)', 'FHN'),
('Hanoi - Học viện An ninh Nhân dân (People''s Police Academy)', 'FHN'),
('Hanoi - Học viện Hành chính Quốc gia (National Academy of Public Administration)', 'FHN'),
('Hanoi - Học viện Y Dược học cổ truyền Việt Nam (Vietnam University of Traditional Medicine)', 'FHN'),
('Hanoi - Đại học Giao thông vận tải (University of Communications and Transport)', 'FHN'),
('Hanoi - Đại học Nội vụ Hà Nội (University of Home Affairs)', 'FHN'),
('Hanoi - Đại học Y tế Công cộng (Hanoi School Of Public Health)', 'FHN'),
('Hanoi - Đại học Nguyễn Trãi', 'FHN'),
('Hanoi - Đại học Phenikaa', 'FHN'),
('Hanoi - Cao đẳng nghề Bách Khoa Hà Nội (Hanoi Vocational College of Technology)', 'FHN'),
('Hanoi - Cao đẳng y tế Hà Đông (Hadong Medical College)', 'FHN'),
('Hanoi - Cao đẳng y tế Bạch Mai', 'FHN'),
('Hanoi - Học viện Tòa Án (Vietnam Court Academy)', 'FHN'),
('Hanoi - Swinburne Vietnam', 'FHN'),
('Hanoi - Greenwich Vietnam', 'FHN'),
('Hanoi - Cao đẳng Y tế Hà Nội (Hanoi Medical College)', 'FHN'),
('Hanoi - Đại học Kinh tế Quốc dân (National Economics University)', 'NEU'),
('Hanoi - Đại học Thăng Long (Thang Long University)', 'NEU'),
('Hanoi - Đại học Văn hóa Hà Nội (Hanoi University Of Culture)', 'NEU'),
('Hanoi - Học viện Âm nhạc Quốc gia Việt Nam (Vietnam National Academy of Music)', 'NEU'),
('Hanoi - Đại học Sư phạm Thể dục thể thao Hà nội', 'NEU'),
('Hanoi - Đại học Hòa Bình (Hoa Binh University)', 'NEU'),
('Hanoi - Viện Đại học Mở Hà Nội (Hanoi Open University)', 'NEU'),
('Hanoi - Học viện Chính sách và Phát triển (Academy of Policy and Development)', 'NEU'),
('Hanoi - Học viện Quản lý Giáo dục (National Institute of Education Management)', 'NEU'),
('Hanoi - Đại học Mỏ Địa chất Hà Nội (Hanoi University of Mining and Geology)', 'NEU'),
('Hanoi - Học viện Khoa học Quân sự (Military Science Academy)', 'NEU'),
('Hanoi - Đại học Xây dựng (National University of Civil Engineering)', 'NEU'),
('Hanoi - Học viện Kỹ thuật Mật mã (Academy of Crytography Techniques)', 'NEU'),
('Hanoi - Đại học Công nghiệp Hà Nội (Hanoi University of Industry)', 'NEU'),
('Hanoi - Đại học Sân khấu Điện ảnh', 'NEU'),
('Hanoi - Đại học Đông Đô (Dong Do University of Science and Technology)', 'NEU'),
('Hanoi - Đại học Quốc tế Bắc Hà', 'NEU'),
('Hanoi - Đại học Thành Đô', 'NEU'),
('Hanoi - Đại học Hàng Hải (Vietnam Maritime University)', 'NEU'),
('Hanoi - Cao đẳng Y dược Thanh Hóa (Thanh Hoa Medical college)', 'NEU'),
('Hanoi - Cao đẳng Cộng đồng Hà Nội (Hanoi Community College)', 'NEU'),
('Hanoi - Đại học Y Dược Hải Phòng (Hai Phong Medical University)', 'NEU'),
('Hanoi - Đại học Khoa học Thái Nguyên (Thai Nguyen University of Sciences (TNUS))', 'NEU'),
('Hanoi - Đại học Phương Đông (Phuong Dong University)', 'NEU'),
('Hanoi - Cao Đẳng Sư Phạm Hà Nội (Hanoi College of Education)', 'NEU'),
('Hanoi - Học viện Phụ nữ Việt Nam (Vietnam Woman''s Academy)', 'NEU'),
('Hanoi - Vin University', 'NEU'),
('Hanoi - Đại học Kiểm sát Hà Nội (Hanoi Procuratorate University)', 'NEU'),

-- HCMC
('HCMC - Đại học Kinh tế (University of Economics)', 'HCMC'),
('HCMC - Đại học Khoa học Xã hội và Nhân văn (University of Social Sciences and Humanities)', 'HCMC'),
('HCMC - Đại học Quốc tế (International University)', 'HCMC'),
('HCMC - Đại học Hoa Sen (Hoa Sen University)', 'HCMC'),
('HCMC - Đại học Y Dược (Ho Chi Minh University of Medicine and Pharmacy)', 'HCMC'),
('HCMC - Đại học Công nghệ (HUTECH University HCM)', 'HCMC'),
('HCMC - Đại học Kiến trúc (Ho Chi Minh City University of Architecture)', 'HCMC'),
('HCMC - Đại học Y Pham Ngoc Thach (Pham Ngoc Thach University of Medicine)', 'HCMC'),
('HCMC - Đại học Thủy lợi (Thuyloi University)', 'HCMC'),
('HCMC - Đại học Lạc Hồng (Lac Hong University)', 'HCMC'),
('HCMC - Đại học Sài Gòn (Saigon University)', 'HCMC'),
('HCMC - Cao đẳng kinh tế đối ngoại (College of Foreign Economic Relations)', 'HCMC'),
('HCMC - Đại học Pháp (French University - VietNam national university (HCM))', 'HCMC'),
('HCMC - Đại học Hồng Đức (Hong Duc Medical School)', 'HCMC'),
('HCMC - Đại học Troy (Troy University (HCM))', 'HCMC'),
('HCMC - Đại học Tân Tạo (Tan Tao University)', 'HCMC'),
('HCMC - Học viện hàng không (Vietnam Aviation Academy)', 'HCMC'),
('HCMC - Nhạc viện (Conservatory of Ho Chi Minh City)', 'HCMC'),
('HCMC - Đại học Mỹ Thuật (University of arts)', 'HCMC'),
('HCMC - Trường trung cấp du lịch & khách sạn Saigontourist - Saigontourist Hospitality College', 'HCMC'),
('HCMC - Khoa Y - Đại học Quốc gia', 'HCMC'),
('HCMC - Đại học Tài chính - Kế Toán', 'HCMC'),
('HCMC - Đại học Gia Định', 'HCMC'),
('HCMC - Cao đẳng Kinh tế - Kỹ thuật Vinatex TP.HCM', 'HCMC'),
('HCMC - Cao đẳng Kinh tế TP.HCM', 'HCMC'),
('HCMC - Cao đẳng Kỹ thuật Cao Thắng', 'HCMC'),
('HCMC - Cao đẳng Tài chính Hải quan', 'HCMC'),
('HCMC - Cao đẳng Bách Việt', 'HCMC'),
('HCMC - Cao đẳng Đại Việt Sài Gòn', 'HCMC'),
('HCMC - Đại học Du lịch Sài Gòn', 'HCMC'),
('HCMC - Học viện doanh nhân LP Việt Nam', 'HCMC'),
('HCMC - Trường Quản Trị Khách Sạn và Du lịch Vatel', 'HCMC'),
('HCMC - Cao đẳng Du lịch Sài Gòn', 'HCMC'),
('HCMC - Đại học Quản lý và Công nghệ TP. Hồ Chí Minh (University of Management and Technology)', 'HCMC'),
('HCMC - Đại học Western Sydney - Việt Nam (Western Sydney University)', 'HCMC'),

('HCMC - Đại học Ngoại thương (Foreign Trade University - HCMC)', 'FHCMC'),
('HCMC - Đại học Ngân hàng (Banking University)', 'FHCMC'),
('HCMC - Đại học Ngoại ngữ - Tin học TP. Hồ Chí Minh (University of Foreign Languages & Information Technology)', 'FHCMC'),
('HCMC - Đại học Tài Chính Marketing (University of Finance and Marketing)', 'FHCMC'),
('HCMC - Đại học Sư phạm (University of Education)', 'FHCMC'),
('HCMC - Đại học FPT (FPT University)', 'FHCMC'),
('HCMC - Greenwich Việt Nam - Cơ sở TP.HCM (University of Greenwich Vietnam - HCMC Campus)', 'FHCMC'),
('HCMC - Swinburne Việt Nam - Cơ sở TP.HCM (Swinburne Vietnam - HCMC Campus)', 'FHCMC'),
('HCMC - Đại học Công nghiệp (Industry University - HCMC)', 'FHCMC'),
('HCMC - Đại học Hồng Bàng (Hong Bang University)', 'FHCMC'),
('HCMC - Đại học Công Thương (HCMC University of Industry and Trade)', 'FHCMC'),
('HCMC - Đại học Tài nguyên và Môi trường (HCMC University of Natural Resources and Environment)', 'FHCMC'),
('HCMC - Đại học Giao thông vận tải (University of Transport and Communication - Campus II)', 'FHCMC'),
('HCMC - Học viện công nghệ bưu chính viễn thông (Posts and Telecommunications Institute of Technology)', 'FHCMC'),
('HCMC - ERC International', 'FHCMC'),
('HCMC - THPT Quốc tế Việt Úc (Saigon International College)', 'FHCMC'),
('HCMC - Đại học Vinh (Vinh University)', 'FHCMC'),
('HCMC - Học viện kĩ thuật mật mã (Academy of Crytography Techniques)', 'FHCMC'),
('HCMC - Đại học Hùng Vương (Hung Vuong university)', 'FHCMC'),
('HCMC - Trường Đại học kinh doanh quốc tế - University of Business International Studies (UBIS)', 'FHCMC'),
('HCMC - Trường đại học Dầu khí Việt Nam (PetroVietnam University - PVU)', 'FHCMC'),
('HCMC - Broward College', 'FHCMC'),
('HCMC - Đại học Văn Hiến (Văn Hiến University)', 'FHCMC'),
('HCMC - Học viện Cảnh sát Nhân dân', 'FHCMC'),
('HCMC - Đại học Lao động - Xã hội', 'FHCMC'),
('HCMC - ĐH Sư phạm Thể dục Thể thao', 'FHCMC'),
('HCMC - Cao đẳng Giao thông Vận tải', 'FHCMC'),
('HCMC - Cao đẳng Công thương', 'FHCMC'),
('HCMC - Cao đẳng Sư phạm Trung ương TP.HCM', 'FHCMC'),
('HCMC - Cao đẳng Văn hóa Nghệ thuật TP.HCM', 'FHCMC'),
('HCMC - Cao đẳng Kỹ thuật Công nghệ Vạn Xuân', 'FHCMC'),
('HCMC - Cao đẳng Kinh tế - Công nghệ TP.HCM', 'FHCMC'),
('HCMC - Cao đẳng Kinh tế Kỹ thuật Miền Nam', 'FHCMC'),
('HCMC - Cao đẳng Y tế Pasteur', 'FHCMC'),
('HCMC - Cao đẳng Viễn Đông', 'FHCMC'),
('HCMC - Học viện Cán bộ TP. Hồ Chí Minh (Ho Chi Minh Cadre Academy)', 'FHCMC'),

('HCMC - Đại học Kinh tế- Luật (University of Economics And Law)', 'HCME'),
('HCMC - Đại học Luật (University of Law)', 'HCME'),
('HCMC - Đại học Sư phạm Kỹ thuật (University of Technology and Education HCM)', 'HCME'),
('HCMC - Đại học Khoa học Tự nhiên (University of Science)', 'HCME'),
('HCMC - Đại học Mở (Open University)', 'HCME'),
('HCMC - Đại học Công nghệ Thông tin (HCMC University of Information Technology)', 'HCME'),
('HCMC - Đại học Đồng Nai (Dong Nai University)', 'HCME'),
('HCMC - Đại học Nông Lâm (HCMC University of Agriculture and Forestry)', 'HCME'),
('HCMC - Đại học Thủ Dầu Một (Thu Dau Mot University)', 'HCME'),
('HCMC - Đại học Quốc tế Miền Đông (Eastern International University)', 'HCME'),
('HCMC - Đại học Việt Đức (Vietnam - Germany University)', 'HCME'),
('HCMC - Đại học Công nghệ Đồng Nai', 'HCME'),
('HCMC - Đại học Kinh tế Kỹ thuật Bình Dương', 'HCME'),
('HCMC - Đại học Bình Dương', 'HCME'),
('HCMC - Đại học Lạc Hồng Đồng Nai', 'HCME'),
('HCMC - Đại học Công nghệ Miền Đông', 'HCME'),
('HCMC - Đại học Lâm Nghiệp', 'HCME'),
('HCMC - Cao đẳng Công Nghệ Thủ Đức TP.HCM (HCMC College of Technology Thu Duc)', 'HCME'),
('HCMC - Đại học Sunderland (Sunderland University)', 'HCME'),

('HCMC - Đại học Văn Lang (Van Lang University)', 'HCMS'),
('HCMC - Đại học RMIT Hồ Chí Minh (RMIT Ho Chi Minh University)', 'HCMS'),
('HCMC - Đại học Tôn Đức Thắng (Ton Duc Thang University)', 'HCMS'),
('HCMC - Đại học Bách Khoa (University of Technology)', 'HCMS'),
('HCMC - Đại học Kinh tế Tài chính (University of Economics and Finance)', 'HCMS'),
('HCMC - Đại học Nguyễn Tất Thành (Nguyen Tat Thanh University)', 'HCMS'),
('HCMC - Đại học công nghệ Sài Gòn (Saigontech)', 'HCMS'),
('HCMC - Đại học Văn hóa (Ho Chi Minh City University of Culture)', 'HCMS'),
('HCMC - Đại học Cảnh Sát Nhân Dân (People''s Police University)', 'HCMS'),
('HCMC - Cao đẳng Việt Mỹ (American Polytechnic College)', 'HCMS'),
('HCMC - Học viện hành chính quốc gia (Ho Chi Minh National Academy of Politics and Public Administration)', 'HCMS'),
('HCMC - Đại học An Ninh nhân dân', 'HCMS'),
('HCMC - ĐH Sân khấu Điện ảnh', 'HCMS'),
('HCMC - Đại học Trần Đại Nghĩa (Tran Dai Nghia University)', 'HCMS'),
('HCMC - Cao đẳng BC Công nghệ và Quản trị doanh nghiệp', 'HCMS'),
('HCMC - Cao đẳng Điện lực TP.HCM', 'HCMS'),
('HCMC - Cao đẳng Kinh tế Kỹ thuật TP. Hồ Chí Minh', 'HCMS'),
('HCMC - Cao đẳng Phát thanh Truyền hình 2', 'HCMS'),
('HCMC - Cao đẳng Xây dựng số 2', 'HCMS'),
('HCMC - Cao đẳng Công nghệ thông tin TP.HCM', 'HCMS'),
('HCMC - Cao đẳng Phương Nam', 'HCMS'),
('HCMC - Đại học Kinh Tế - Kỹ Thuật Công nghiệp University of Economic and Technical Industries.', 'HCMS'),
('HCMC - Đại học Fulbright (Fulbright University)', 'HCMS'),
('HCMC - Cao đẳng Y Dược Sài Gòn (Sai Gon Medical College)', 'HCMS'),
('HCMC - Đại học Tư thục Quốc tế Sài Gòn (Saigon International University)', 'HCMS'),

-- Cantho
('Cantho - Đại Học Cần Thơ (Can Tho University)', 'Cantho'),
('Cantho - Đại học Y Dược Cần Thơ (Can Tho University of Medicine and Phamacy)', 'Cantho'),
('Cantho - Đại học FPT (FPT University)', 'Cantho'),
('Cantho - Đại Học Nam Cần Thơ (Nam Can Tho University)', 'Cantho'),
('Cantho - Đại học Võ Trường Toản (Vo Truong Toan University)', 'Cantho'),
('Cantho - Đại học Kỹ thuật công nghệ Cần Thơ (Can Tho University of Technology)', 'Cantho'),
('Cantho - Đại học Tây Đô (Tay Do University)', 'Cantho'),
('Cantho - Đại học Greenwich (Greenwich University)', 'Cantho'),
('Cantho - Cao đẳng Cần Thơ (Can Tho College)', 'Cantho'),
('Cantho - Cao đẳng Cơ điện tử vầ Nông nghiệp Nam Bộ (Southern College for Engineering and Agriculture)', 'Cantho'),
('Cantho - Cao đẳng Kinh tế Kỹ thuật Cần Thơ (Can Tho Technical Economic College)', 'Cantho'),
('Cantho - Cao đẳng Nghề Cần Thơ (Can Tho Vocational College)', 'Cantho'),
('Cantho - Cao đẳng Nghề CNTT Ispace (Ispace College)', 'Cantho'),
('Cantho - Cao đẳng Nghề Việt Mỹ (American Polytechnic College)', 'Cantho'),
('Cantho - Cao đẳng Y tế Cần Thơ (Can Tho Medical College)', 'Cantho'),
('Cantho - Cao đẳng nghề Du lịch Cần Thơ (Can Tho Tourism College)', 'Cantho'),

-- Danang
('Danang - Đại học Kinh tế Đà Nẵng (Da Nang University of Economics)', 'Danang'),
('Danang - Đại học Ngoại ngữ Đà Nẵng (Da Nang College of Foreign Languages)', 'Danang'),
('Danang - Đại học Bách khoa Đà Nẵng (Da Nang University of Technology)', 'Danang'),
('Danang - Viện Nghiên Cứu & Đào Tạo Việt - Anh Đà Nẵng', 'Danang'),
('Danang - Đại học Duy Tân (Duy Tan University)', 'Danang'),
('Danang - Đại học Ngoại Ngữ - ĐH Huế (Hue University of Foreign Languages)', 'Danang'),
('Danang - Đại học Sư phạm Đà Nẵng (Da Nang College of Education)', 'Danang'),
('Danang - Đại học Đà Nẵng Phân hiệu tại Kontum (Da Nang University Branch at Kontum)', 'Danang'),
('Danang - Đại học Kỹ Thuật Y Dược Đà Nẵng (Danang University of Medical Technique)', 'Danang'),
('Danang - Đại học FPT Đà Nẵng (Danang FPT University)', 'Danang'),
('Danang - Đại học Đông Á (Danang Dong A University)', 'Danang'),
('Danang - Đại học Kiến trúc Đà Nẵng (Danang Architecture University)', 'Danang'),
('Danang - Đại học Kỹ Thuật Y Dược (Danang University of Medical Technique)', 'Danang'),
('Danang - Cao đẳng Công Nghệ - ĐH Đà Nẵng (Danang College of Industry)', 'Danang'),
('Danang - Cao đẳng Công Nghệ Thông Tin - ĐH Đà Nẵng (Danang College of Information & Technology)', 'Danang'),
('Danang - Cao đẳng Công Nghệ Thông Tin Hữu Nghị Việt Hàn (Danang College of Information & Technology Vietnam-Korean)', 'Danang'),
('Danang - Cao đẳng Công Nghệ Và Kinh Doanh Việt Tiến (Danang College of Industry & Business Viet Tien)', 'Danang'),
('Danang - Cao đẳng Dân Lập Kinh Tế Kỹ Thuật Đông Du Đà Nẵng (Danang College of Economic & Technology Dong Du)', 'Danang'),
('Danang - Cao đẳng Giao Thông Vận Tải II (Danang College of Transport)', 'Danang'),
('Danang - Cao đẳng Kinh Tế - Kế Hoạch Đà Nẵng (Danang College of Economic)', 'Danang'),
('Danang - Cao đẳng Lạc Việt (Danang Lac Viet College)', 'Danang'),
('Danang - Cao đẳng Lương Thực Thực Phẩm (Danang College of Food)', 'Danang'),
('Danang - Cao đẳng Phương Đông - Đà Nẵng (Danang Phuong Dong College)', 'Danang'),
('Danang - Cao đẳng Thương Mại Đà Nẵng (Danang College of Commerce)', 'Danang'),
('Danang - Cao đẳng Tư Thục Đức Trí - Đà Nẵng (Danang Duc Tri College)', 'Danang'),
('Danang - Cao đẳng Công Nghiệp Huế (Hue College of Industry)', 'Danang'),
('Danang - Cao đẳng Sư Phạm Thừa Thiên Huế (Hue College of Education)', 'Danang'),
('Danang - Cao đẳng Xây Dựng Công Trình Đô Thị - Cơ Sở Huế (Hue College of Urban Construction Engineering)', 'Danang'),
('Danang - Cao đẳng Y Tế Huế (Hue College of Medicine)', 'Danang'),
('Danang - Đại học Khoa Học - ĐH Huế (Hue University of Science)', 'Danang'),
('Danang - Đại học Kinh Tế - ĐH Huế (Hue University of Economic)', 'Danang'),
('Danang - Đại học Nghệ Thuật - ĐH Huế (Hue University of Arts)', 'Danang'),
('Danang - Đại học Nông Lâm - ĐH Huế (Hue University of Agriculture and Forestry)', 'Danang'),
('Danang - Đại học Phú Xuân - Huế (Hue Phu Xuan University)', 'Danang'),
('Danang - Đại học Sư Phạm - ĐH Huế (Hue University of Education)', 'Danang'),
('Danang - Đại học Y Dược - ĐH Huế (Hue University of Medical)', 'Danang'),
('Danang - Học viện Âm Nhạc Huế (Hue Academy of Music)', 'Danang'),
('Danang - Đại học Huế - Khoa Du Lịch (Hue University - Faculty of Tourism)', 'Danang'),
('Danang - Đại học Huế - Khoa Giáo Dục Thể Chất (Hue University - Faculty of Physical Education)', 'Danang'),
('Danang - Đại học Huế - Khoa Luật (Hue University - Faculty of Law)', 'Danang')
ON CONFLICT (university_name) DO NOTHING;


-- Create analytics table for tracking
CREATE TABLE IF NOT EXISTS public.analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  page_url TEXT,
  session_id TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_agent TEXT,
  ip_address INET
);

-- Enable RLS for analytics
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;

-- Dropped global goals in favor of per-phase goals only
  
-- Per-phase goals
CREATE TABLE IF NOT EXISTS public.lc_goals_phase (
  lc_code TEXT NOT NULL,
  phase_code TEXT NOT NULL,
  goal INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (lc_code, phase_code)
);
ALTER TABLE public.lc_goals_phase ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read phase goals" ON public.lc_goals_phase
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins upsert phase goals" ON public.lc_goals_phase
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins update phase goals" ON public.lc_goals_phase
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- LC UTM links and national goals (EMT/Organic/EST)
CREATE TABLE IF NOT EXISTS public.lc_utm (
  lc_code TEXT PRIMARY KEY,
  national_emt_goal INTEGER NOT NULL DEFAULT 0,
  national_organic_goal INTEGER NOT NULL DEFAULT 0,
  national_est_goal INTEGER NOT NULL DEFAULT 0,
  utm_emt TEXT DEFAULT '',
  utm_organic TEXT DEFAULT '',
  utm_est TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.lc_utm ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read lc_utm" ON public.lc_utm
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins upsert lc_utm" ON public.lc_utm
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins update lc_utm" ON public.lc_utm
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- National UTM links (per department)
CREATE TABLE IF NOT EXISTS public.national_utm (
  dept TEXT PRIMARY KEY CHECK (dept IN ('EMT','Organic','EST')),
  utm TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.national_utm ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read national_utm" ON public.national_utm
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins upsert national_utm" ON public.national_utm
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins update national_utm" ON public.national_utm
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- National goals per phase (per department)
CREATE TABLE IF NOT EXISTS public.national_goals_phase (
  dept TEXT NOT NULL CHECK (dept IN ('EMT','Organic','EST')),
  phase_code TEXT NOT NULL,
  goal INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (dept, phase_code)
);
ALTER TABLE public.national_goals_phase ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read national_goals_phase" ON public.national_goals_phase
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins upsert national_goals_phase" ON public.national_goals_phase
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins update national_goals_phase" ON public.national_goals_phase
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Generic UTM links per entity (LC or NATIONAL dept)
CREATE TABLE IF NOT EXISTS public.utm_links (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('LC','NATIONAL')),
  entity_code TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.utm_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read utm_links" ON public.utm_links
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins insert utm_links" ON public.utm_links
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins update utm_links" ON public.utm_links
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins delete utm_links" ON public.utm_links
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
  
-- Analytics policies
CREATE POLICY "Users can view own analytics" ON public.analytics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all analytics" ON public.analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Anyone can insert analytics" ON public.analytics
  FOR INSERT WITH CHECK (true);
