export type CustomerRole = 'PATIENT' | 'STUDENT';

export interface Profile {
  id: string;
  role: CustomerRole | 'ADMIN' | 'SUPER_ADMIN' | 'STAFF';
  status: 'PENDING' | 'VERIFIED' | 'SUSPENDED';
  full_name: string;
  phone: string;
  whatsapp: string | null;
  gender: string | null;
  birth_date: string | null;
  province_id: string | null;
  area_id: string | null;
  university_id: string | null;
  stage: string | null;
  workplace: string | null;
  preferred_university_ids?: string[];
  created_at: string;
  updated_at: string;
}

export const isProfileComplete = (profile: Profile | null): boolean =>
  Boolean(
    profile &&
      (profile.role === 'PATIENT' || profile.role === 'STUDENT') &&
      profile.phone &&
      profile.province_id &&
      profile.preferred_university_ids?.length &&
      (profile.role !== 'STUDENT' || (profile.university_id && profile.stage)),
  );
