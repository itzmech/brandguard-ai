// Design tokens for BrandGuard AI matching the official design specification
export const colors = {
  primary: {
    mainNavy: '#102B50',
    sidebarNavy: '#08264D',
    blue: '#145BE8',
    blueHover: '#0E4FCC',
    lightBlueSurface: '#EFF6FF',
  },
  background: {
    main: '#F6F8FC',
    card: '#FFFFFF',
  },
  text: {
    primary: '#17243A',
    secondary: '#64748B',
    muted: '#94A3B8',
  },
  border: {
    default: '#E2E8F0',
  },
  status: {
    approved: '#059669',
    pending: '#D97706',
    changesRequested: '#DC2626',
    draft: '#64748B',
    success: '#059669',
    warning: '#D97706',
    error: '#DC2626',
  },
  severity: {
    high: {
      bg: '#FEF2F2',
      text: '#DC2626',
      border: '#FECACA',
    },
    medium: {
      bg: '#FFFBEB',
      text: '#D97706',
      border: '#FDE68A',
    },
    low: {
      bg: '#EFF6FF',
      text: '#2563EB',
      border: '#BFDBFE',
    },
  },
};

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '48px',
};

export const borderRadius = {
  sm: '6px',
  md: '8px',
  lg: '12px',
  full: '9999px',
};

export const typography = {
  pageTitle: '30px',
  sectionTitle: '18px',
  body: '14px',
  label: '12px',
};
