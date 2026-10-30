export type UniversityLike = {
  id?: string;
  name_ar?: string | null;
  name_en?: string | null;
  image_url?: string | null;
};

export type CategoryLike = {
  id?: string;
  code?: string | null;
  name_ar?: string | null;
  name_en?: string | null;
  image_url?: string | null;
};

export const getUniversityPlaceholder = (item?: UniversityLike | null): string => {
  const text = `${item?.name_ar || ''} ${item?.name_en || ''}`.toLowerCase();
  if (text.includes('كوفة') || text.includes('kufa')) {
    return '/images/universities/kufa.svg';
  }
  if (text.includes('كفيل') || text.includes('kafeel')) {
    return '/images/universities/kafeel.svg';
  }
  return '/images/universities/default-university.svg';
};

export const getUniversityImage = (item?: UniversityLike | null): string => {
  if (item?.image_url && item.image_url.trim() && !item.image_url.includes('test')) {
    return item.image_url;
  }
  return getUniversityPlaceholder(item);
};

export const getCategoryPlaceholder = (item?: CategoryLike | null): string => {
  const code = (item?.code || '').toUpperCase().trim();
  const ar = (item?.name_ar || '').trim();
  const en = (item?.name_en || '').trim();
  const combined = `${code} ${ar} ${en}`.toLowerCase();

  // Specific clinical classes
  if (code === 'CLASS_I' || combined.includes('class i') || combined.includes('class 1') || combined.includes('صنف أول') || combined.includes('الصنف الأول')) {
    return '/images/categories/class-1.svg';
  }
  if (code === 'CLASS_II' || combined.includes('class ii') || combined.includes('class 2') || combined.includes('صنف ثان') || combined.includes('الصنف الثاني')) {
    return '/images/categories/class-2.svg';
  }
  if (code === 'CLASS_III' || combined.includes('class iii') || combined.includes('class 3') || combined.includes('صنف ثالث') || combined.includes('الصنف الثالث')) {
    return '/images/categories/class-3.svg';
  }
  if (code === 'CLASS_IV' || combined.includes('class iv') || combined.includes('class 4') || combined.includes('صنف رابع') || combined.includes('الصنف الرابع')) {
    return '/images/categories/class-4.svg';
  }
  if (code === 'CLASS_V' || combined.includes('class v') || combined.includes('class 5') || combined.includes('صنف خامس') || combined.includes('الصنف الخامس')) {
    return '/images/categories/class-5.svg';
  }

  // Endodontics & Root canal
  if (code === 'ROOT_CANAL' || combined.includes('حشو الجذر') || combined.includes('حشو جذر') || combined.includes('root canal')) {
    return '/images/categories/root-canal.svg';
  }
  if (code === 'ENDO' || combined.includes('جذور') || combined.includes('عصب') || combined.includes('endodontic')) {
    return '/images/categories/endo.svg';
  }

  // Fillings & Restoration
  if (code === 'FILLING' || combined.includes('حشو') || combined.includes('filling') || combined.includes('restoration')) {
    return '/images/categories/filling.svg';
  }

  // Scaling & Hygiene
  if (code === 'SCALING' || combined.includes('تنظيف') || combined.includes('تقليح') || combined.includes('scaling') || combined.includes('prophylaxis')) {
    return '/images/categories/scaling.svg';
  }

  // Extraction & Surgery
  if (code === 'EXTRACTION' || combined.includes('قلع') || combined.includes('جراحة') || combined.includes('extraction') || combined.includes('surgery')) {
    return '/images/categories/extraction.svg';
  }

  // Pediatric
  if (code === 'PEDIATRIC' || combined.includes('أطفال') || combined.includes('اطفال') || combined.includes('pediatric')) {
    return '/images/categories/pediatric.svg';
  }

  // Periodontal & Gums
  if (code === 'PERIODONTAL' || combined.includes('لثة') || combined.includes('periodontal')) {
    return '/images/categories/periodontal.svg';
  }

  // Crown & Bridge
  if (code === 'CROWN' || combined.includes('تاج') || combined.includes('تيجان') || combined.includes('crown')) {
    return '/images/categories/crown.svg';
  }
  if (code === 'BRIDGE' || combined.includes('جسر') || combined.includes('جسور') || combined.includes('bridge')) {
    return '/images/categories/bridge.svg';
  }

  // Dentures
  if (code === 'COMPLETE_DENTURE' || combined.includes('طقم كامل') || combined.includes('complete denture')) {
    return '/images/categories/complete-denture.svg';
  }
  if (code === 'PARTIAL_DENTURE' || combined.includes('طقم جزئي') || combined.includes('partial denture')) {
    return '/images/categories/partial-denture.svg';
  }

  return '/images/categories/default-category.svg';
};

export const getCategoryImage = (item?: CategoryLike | null): string => {
  if (item?.image_url && item.image_url.trim() && !item.image_url.includes('category-test') && !item.image_url.includes('test')) {
    return item.image_url;
  }
  return getCategoryPlaceholder(item);
};
