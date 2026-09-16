# StudyFlow — Smart Study Planner

A fully functional, offline-first study planner built with plain HTML, CSS and JavaScript — no frameworks, no build step. Everything is saved to `localStorage`, so all data survives page refreshes and browser restarts.

## Features

**Login / account**
- First visit shows a "Create account" form (name, email, password); after that, returning visits show a "Log in" form instead
- Client-side validation with inline errors, a show/hide password toggle, and "Remember me" (skips the login screen on your next visit)
- A "Log out" button in the sidebar returns you to the login screen without touching your study data
- ⚠️ This is a local, demo-only account gate — the password is stored in plain text in `localStorage` on your own device. It's meant to demonstrate a login flow, not to secure real accounts; wire it up to a real backend before using it for anything beyond a portfolio piece.

**Dashboard**
- Today's study tasks pulled straight from the weekly planner
- Current study streak (consecutive days with logged focus time)
- Tasks completed today, hours studied today, and weekly target progress
- A quick-start Pomodoro widget
- The nearest upcoming exam, with an urgency badge

**Subjects**
- Add, edit and delete subjects with a color, exam date and weekly study target
- Automatic exam countdown and urgency indicator (urgent / soon / on track)
- Weekly progress bar and a suggested hours/day figure to hit the target

**Weekly Planner**
- Monday–Sunday grid with week navigation
- Add study blocks to any day, assign them to a subject, mark them complete
- Drag and drop a block onto another day to reschedule it
- Overdue, unfinished blocks are highlighted automatically

**Focus Timer**
- Classic 25/5 Pomodoro with start / pause / reset / skip
- Work and break modes with an animated ring
- Pick a subject before starting — completed sessions are logged automatically and feed the dashboard, streak and statistics

**Statistics**
- Weekly target vs. actual hours, per subject
- Subject-wise progress bars
- Completed focus sessions and current streak
- Daily productivity for the last 7 days

**Habits (Habitub)**
- A minimalist, activity-grid based habit tracker sitting right below Statistics
- Add, edit and delete habits, each with its own color
- A "Today" checklist to mark habits done, with a live streak badge per habit
- A GitHub-style activity grid per habit — click any past or present square to toggle that day done/undone
- Current streak and longest streak per habit, plus overall stats: habits tracked, done today, best streak, check-ins this week

**Diary (Goals Diary — Diary 3)**
- Three tabs — Today Goal, Week Goal, Future Goal — each its own scoped goal list
- Add a goal, check it off, or delete it; a live "X/Y done" count per tab
- Today's list resets each new day, the week list resets each Monday, and Future goals persist indefinitely

**Clock**
- A live digital clock (updates every second) with the full date and your detected timezone
- A small icon that shifts with the time of day

**Calculator**
- A clean four-column calculator: digits, +, −, ×, ÷, %, backspace, clear
- Full keyboard support while the Calculator tab is open (digits, operators, Enter, Backspace, Escape)

**Smart features**
- Subjects are automatically ranked by how soon their exam is
- Overdue planner blocks are visually flagged
- Remaining study days and a suggested daily study load are calculated per subject
- A light/dark theme toggle, remembered across visits

## Files

```
smart-study-planner/
├── index.html     — structure for every view + the two modals
├── style.css       — design tokens, light/dark theme, all component styles
├── script.js       — state, localStorage persistence, rendering, timer logic
├── assets/icons/    — reserved for any custom icon assets
└── README.md
```

## Running it

No build tools needed. Either:

- Open `index.html` directly in a browser, or
- Serve the folder locally, e.g. `python3 -m http.server`, then visit `http://localhost:8000`

The first time it runs, StudyFlow seeds a few example subjects and blocks so the UI isn't empty — feel free to edit or delete them; everything from then on is driven entirely by what you add.

## Data model

Everything lives under a single `localStorage` key, `studyflow_state_v1`:

```js
{
  theme: "dark" | "light",
  subjects: [{ id, name, color, examDate, weeklyTarget }],
  blocks:   [{ id, subjectId, date, start, end, note, completed }],
  sessions: [{ id, subjectId, date, minutes, type, time }],
  habits:    [{ id, name, color }],
  habitLogs: [{ id, habitId, date }],
  diaryGoals: [{ id, scope: "today" | "week" | "future", text, done, date }]
}
```

The account itself lives under separate keys: `studyflow_user_v1` (name/email/password), `studyflow_remember_v1` (persists login across browser restarts when "Remember me" is checked), and a session-only `studyflow_logged_in_v1` flag.

`sessions` is populated both by completed Pomodoro rounds and by marking a planner block as done — both feed the same streak, hours-studied and statistics calculations.

## Design system

The whole UI is driven by CSS custom properties at the top of `style.css`, so the look can be retuned from one place:

- **Color** — a cool "indigo & sage" palette (a periwinkle-indigo primary against ink-navy/charcoal in dark mode, or cool paper in light mode), plus a sage-green secondary and a rose-coral for urgency/danger states. Every accent-on-background text pairing (buttons, active tabs) is checked against WCAG AA contrast (4.5:1+).
- **Type scale** — `--text-xs` through `--text-3xl`, anchored at a 15px base, so every heading, label, and stat number pulls from one consistent scale instead of one-off sizes. Fraunces (serif) carries display numerals and headings; Manrope (sans) carries interface text.
- **Motion** — `--ease-out` (snappy) for hovers and `--ease-spring` (slight overshoot) for press/selection moments, plus a `prefers-reduced-motion` fallback that disables animation for anyone who's asked their OS for that.
- **Elevation** — layered shadow tokens (`--shadow-card`, `--shadow-raised`, `--shadow-glow`) instead of one flat shadow reused everywhere.

Every interactive element — buttons, nav items, tabs, cards you can click, the calculator keys — has its own hover/press feedback; static, non-interactive cards (stat tiles, panels) intentionally don't, to keep the motion meaningful rather than decorative.

## Notes for extending it

- Colors are drawn from a small shared palette in `script.js` (`PALETTE`) — add more hex values there to offer more subject colors.
- The Pomodoro durations are constants (`WORK_SECONDS`, `BREAK_SECONDS`) near the top of `script.js` if you want configurable lengths later.
- The planner stores blocks against real calendar dates (not just weekdays), so the week-navigation arrows work correctly across months.
