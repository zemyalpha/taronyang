/**
 * Shared Tailwind CSS configuration for Taronyang.
 * Must be loaded immediately AFTER the Tailwind CDN script:
 *   <script src="https://cdn.tailwindcss.com"></script>
 *   <script src="/static/js/tailwind.config.js"></script>
 */
tailwind.config = {
    theme: {
        extend: {
            colors: {
                navy: '#0a0a2e',
                'dark-purple': '#1a1a3e',
                lavender: '#a78bfa',
                gold: '#fbbf24',
                softgreen: '#86efac',
                softred: '#fca5a5',
            },
            fontFamily: {
                serif: ['Noto Serif KR', 'serif'],
                sans: ['Noto Sans KR', 'sans-serif'],
            },
        },
    },
};
