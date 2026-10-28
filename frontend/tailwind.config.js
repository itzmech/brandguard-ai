/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'main-navy': '#102B50',
        'sidebar-navy': '#08264D',
        'primary-navy': '#102B50',
        'primary-blue': '#145BE8',
        'blue-hover': '#0E4FCC',
        'light-blue-surface': '#EFF6FF',
        'bg-main': '#F6F8FC',
        'bg-card': '#FFFFFF',
        'text-primary': '#17243A',
        'text-secondary': '#64748B',
        'text-muted': '#94A3B8',
        'border-default': '#E2E8F0',
        'severity-high': '#DC2626',
        'severity-medium': '#D97706',
        'severity-low': '#2563EB',
        'status-approved': '#059669',
        'status-pending': '#D97706',
        'status-changes': '#DC2626',
        'status-success': '#059669',
        'status-warning': '#D97706',
        'status-error': '#DC2626',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
