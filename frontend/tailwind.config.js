/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Severity colors kept in the design system rather than inlined per
        // component, so a SEV1 badge always means the same red everywhere.
        sev1: '#dc2626',
        sev2: '#ea580c',
        sev3: '#ca8a04',
        sev4: '#65a30d',
      },
    },
  },
  plugins: [],
};
