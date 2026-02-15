/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Healthcare-focused color palette
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        healthcare: {
          blue: '#0077b6',
          teal: '#00a896',
          green: '#2a9d8f',
          warning: '#f77f00',
          error: '#d62828',
          success: '#06d6a0',
        },
        // Status colors for assessments
        status: {
          draft: '#6b7280',
          'in-progress': '#3b82f6',
          'pending-review': '#f59e0b',
          approved: '#10b981',
          'needs-correction': '#ef4444',
          submitted: '#8b5cf6',
          locked: '#374151',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      minHeight: {
        'touch': '44px', // WCAG minimum touch target
      },
      minWidth: {
        'touch': '44px',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-bottom': 'slideInBottom 0.3s ease-out',
        'pulse-subtle': 'pulseSubtle 2s infinite',
        'glow': 'glow 1.5s ease-in-out infinite',
        'collapse': 'collapse 0.3s ease-out',
        'expand': 'expand 0.3s ease-out',
        'success-pop': 'successPop 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInBottom: {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(34, 197, 94, 0.4)' },
          '50%': { boxShadow: '0 0 20px 5px rgba(34, 197, 94, 0.4)' },
        },
        collapse: {
          '0%': { opacity: '1', maxHeight: '500px' },
          '100%': { opacity: '0.8', maxHeight: '80px' },
        },
        expand: {
          '0%': { opacity: '0.8', maxHeight: '80px' },
          '100%': { opacity: '1', maxHeight: '500px' },
        },
        successPop: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '50%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
