import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      // ── AgentBanjir brand palette ────────────────────────────────────────
      colors: {
        // Base surfaces (dark ops theme)
        surface: {
          DEFAULT: '#0d1117',   // page bg — near-black
          raised:  '#161b22',   // card/panel bg
          overlay: '#21262d',   // inputs, hover states
          border:  '#30363d',   // subtle dividers
        },
        // Severity system
        severity: {
          high:   {
            DEFAULT: '#f85149',  // red-400 equivalent
            bg:     '#2d1318',   // deep-red card tint
            border: '#b91c1c',
            ring:   '#ef4444',
          },
          medium: {
            DEFAULT: '#d29922',  // amber
            bg:     '#2d2005',
            border: '#b45309',
            ring:   '#f59e0b',
          },
          low:    {
            DEFAULT: '#58a6ff',  // sky-blue
            bg:     '#051d40',
            border: '#1d4ed8',
            ring:   '#3b82f6',
          },
          dispatched: {
            DEFAULT: '#3fb950',  // green
            bg:     '#0c2d1a',
            border: '#15803d',
            ring:   '#22c55e',
          },
        },
        // Status system
        status: {
          pending:    '#d29922',
          dispatched: '#3fb950',
          rejected:   '#6e7681',
        },
        // Brand accent
        brand: {
          DEFAULT: '#1a6dff',
          hover:   '#1558d6',
          muted:   '#0d4fbb33',
        },
      },

      // ── Typography ───────────────────────────────────────────────────────
      fontFamily: {
        // Mono-spaced for data/coordinates — ops terminal feel
        mono:    ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        // Sans for UI labels — IBM Plex for gov/industrial tone
        sans:    ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        // Display / headers
        display: ['IBM Plex Sans Condensed', 'IBM Plex Sans', 'sans-serif'],
      },

      // ── Animations ──────────────────────────────────────────────────────
      animation: {
        // High-severity alert flash on SignalCard
        'severity-pulse': 'severityPulse 1.5s ease-in-out infinite',
        // Live indicator dot
        'live-dot':       'liveDot 1.2s ease-in-out infinite',
        // Slide-in for new card appearing in feed
        'slide-in':       'slideIn 0.25s ease-out',
        // Collapse/expand for SubmissionForm panel
        'panel-open':     'panelOpen 0.2s ease-out',
      },
      keyframes: {
        severityPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(239,68,68,0)' },
          '50%':       { boxShadow: '0 0 0 6px rgba(239,68,68,0.35)' },
        },
        liveDot: {
          '0%, 100%': { opacity: '1',   transform: 'scale(1)' },
          '50%':       { opacity: '0.4', transform: 'scale(0.75)' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        panelOpen: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },

      // ── Grid template areas for DashboardLayout ──────────────────────────
      gridTemplateAreas: {
        dashboard: ['"header header"', '"map feed"', '"stats stats"', '"form form"'],
        'dashboard-md': ['"header"', '"map"', '"feed"', '"stats"', '"form"'],
      },
    },
  },
  plugins: [],
}

export default config