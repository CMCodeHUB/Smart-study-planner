'use strict';

/* =========================================================
   StudyFlow — Smart Study Planner
   Vanilla JS, persisted entirely to localStorage.
   ========================================================= */

const STORAGE_KEY = 'studyflow_state_v1';
const PALETTE = ['#E3A63E', '#3D8C82', '#D1495B', '#5FA777', '#7C93C9', '#C97CC0'];
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WORK_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;
const RING_CIRCUMFERENCE = 2 * Math.PI * 100;
const HABIT_GRID_WEEKS = 12;

/* ---------------------------------------------------------
   Date helpers (local time, no UTC shifting)
   --------------------------------------------------------- */
function pad(n) { return n.toString().padStart(2, '0'); }
function toISODate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function fromISODate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function todayISO() { return toISODate(new Date()); }
function addDays(d, n) { const c = new Date(d.getFullYear(), d.getMonth(), d.getDate()); c.setDate(c.getDate() + n); return c; }
function getMonday(d) {
  const c = new Date(d);
  const day = c.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(c, diff);
}
function getWeekDates(offset) {
  const monday = addDays(getMonday(new Date()), offset * 7);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
function dayLabel(d) { return d.toLocaleDateString(undefined, { day: 'numeric' }); }
function monthDay(d) { return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
function timeToMinutes(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function durationMinutes(start, end) {
  const diff = timeToMinutes(end) - timeToMinutes(start);
  return diff > 0 ? diff : 30;
}
function formatHM(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return `${h}h ${m}m`;
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/* ---------------------------------------------------------
   State + persistence
   --------------------------------------------------------- */
function seedState() {
  const today = new Date();
  const iso = (offset) => toISODate(addDays(today, offset));
  const s1 = uid(), s2 = uid(), s3 = uid();
  const h1 = uid(), h2 = uid(), h3 = uid();

  const habitLogs = [];
  for (let i = 0; i < 21; i++) {
    const d = iso(-i);
    if (i % 7 !== 3) habitLogs.push({ id: uid(), habitId: h1, date: d });
    if (i % 2 === 0) habitLogs.push({ id: uid(), habitId: h2, date: d });
    if (i % 4 === 0) habitLogs.push({ id: uid(), habitId: h3, date: d });
  }

  return {
    theme: 'dark',
    subjects: [
      { id: s1, name: 'Mathematics', color: PALETTE[0], examDate: iso(12), weeklyTarget: 6 },
      { id: s2, name: 'Data Structures', color: PALETTE[1], examDate: iso(21), weeklyTarget: 5 },
      { id: s3, name: 'JavaScript', color: PALETTE[4], examDate: '', weeklyTarget: 4 },
    ],
    blocks: [
      { id: uid(), subjectId: s1, date: iso(0), start: '17:00', end: '18:00', note: 'Integration', completed: false },
      { id: uid(), subjectId: s2, date: iso(0), start: '19:00', end: '20:00', note: 'Trees', completed: false },
      { id: uid(), subjectId: s3, date: iso(0), start: '20:15', end: '21:00', note: 'Async/Await', completed: false },
      { id: uid(), subjectId: s1, date: iso(-1), start: '17:00', end: '18:30', note: 'Limits', completed: true },
      { id: uid(), subjectId: s2, date: iso(-2), start: '18:00', end: '19:00', note: 'Graphs', completed: true },
    ],
    sessions: [
      { id: uid(), subjectId: s1, date: iso(-1), minutes: 25, type: 'work', time: '17:10' },
      { id: uid(), subjectId: s1, date: iso(-1), minutes: 25, type: 'work', time: '17:40' },
      { id: uid(), subjectId: s2, date: iso(-2), minutes: 60, type: 'work', time: '18:05' },
      { id: uid(), subjectId: s1, date: iso(-3), minutes: 50, type: 'work', time: '16:30' },
      { id: uid(), subjectId: s3, date: iso(-4), minutes: 25, type: 'work', time: '20:00' },
    ],
    habits: [
      { id: h1, name: 'Read 20 minutes', color: PALETTE[2] },
      { id: h2, name: 'Exercise', color: PALETTE[3] },
      { id: h3, name: 'No sugar', color: PALETTE[5] },
    ],
    habitLogs,
    diaryGoals: [
      { id: uid(), scope: 'today', text: 'Finish the integration practice set', description: 'Chapters 6–7, at least 15 problems. Focus on substitution method first.', done: false, date: iso(0) },
      { id: uid(), scope: 'week', text: 'Complete 3 mock tests', description: 'One per subject — Math, Data Structures, JavaScript. Review mistakes after each.', done: false, date: iso(0) },
      { id: uid(), scope: 'future', text: 'Get into a strong engineering program', description: '', done: false, date: iso(0) },
    ],
  };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Backfill fields for state saved before these features existed
      parsed.habits = parsed.habits || [];
      parsed.habitLogs = parsed.habitLogs || [];
      parsed.diaryGoals = parsed.diaryGoals || [];
      return parsed;
    }
  } catch (e) { /* fall through to seed */ }
  const seeded = seedState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

/* ---------------------------------------------------------
   Derived data helpers
   --------------------------------------------------------- */
function getSubject(id) { return state.subjects.find(s => s.id === id); }

function weekBoundsFor(date) {
  const monday = getMonday(date);
  return { start: monday, end: addDays(monday, 6) };
}

function sessionsInRange(subjectId, start, end, type) {
  return state.sessions.filter(sess => {
    if (subjectId && sess.subjectId !== subjectId) return false;
    if (type && sess.type !== type) return false;
    const d = fromISODate(sess.date);
    return d >= start && d <= end;
  });
}

function hoursLoggedThisWeek(subjectId) {
  const { start, end } = weekBoundsFor(new Date());
  const mins = sessionsInRange(subjectId, start, end, 'work').reduce((a, s) => a + s.minutes, 0);
  return mins / 60;
}

function daysUntil(dateISO) {
  if (!dateISO) return null;
  const today = fromISODate(todayISO());
  const target = fromISODate(dateISO);
  return Math.round((target - today) / 86400000);
}

function urgencyLevel(days) {
  if (days === null) return 'none';
  if (days < 0) return 'urgent';
  if (days <= 3) return 'urgent';
  if (days <= 7) return 'soon';
  return 'normal';
}

function suggestedHoursPerDay(subject) {
  const today = new Date();
  const dow = (today.getDay() + 6) % 7; // Mon=0..Sun=6
  const daysLeftInWeek = 7 - dow;
  const logged = hoursLoggedThisWeek(subject.id);
  const remaining = subject.weeklyTarget - logged;
  if (remaining <= 0) return 0;
  return remaining / daysLeftInWeek;
}

function computeStreak() {
  const activeDates = new Set();
  state.sessions.filter(s => s.type === 'work').forEach(s => activeDates.add(s.date));
  state.blocks.filter(b => b.completed).forEach(b => activeDates.add(b.date));

  let streak = 0;
  let cursor = fromISODate(todayISO());
  if (activeDates.has(toISODate(cursor))) {
    streak = 1;
    cursor = addDays(cursor, -1);
  } else {
    cursor = addDays(cursor, -1);
  }
  while (activeDates.has(toISODate(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/* ---------------------------------------------------------
   Habits — generic streak helpers + grid range
   --------------------------------------------------------- */
function getHabit(id) { return state.habits.find(h => h.id === id); }
function habitDatesSet(habitId) {
  return new Set(state.habitLogs.filter(l => l.habitId === habitId).map(l => l.date));
}
function currentStreakFromSet(datesSet) {
  let streak = 0;
  let cursor = fromISODate(todayISO());
  if (datesSet.has(toISODate(cursor))) { streak = 1; cursor = addDays(cursor, -1); }
  else { cursor = addDays(cursor, -1); }
  while (datesSet.has(toISODate(cursor))) { streak++; cursor = addDays(cursor, -1); }
  return streak;
}
function longestStreakFromSet(datesSet) {
  if (datesSet.size === 0) return 0;
  const sorted = [...datesSet].map(fromISODate).sort((a, b) => a - b);
  let longest = 1, run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diffDays = Math.round((sorted[i] - sorted[i - 1]) / 86400000);
    if (diffDays === 1) run++;
    else if (diffDays > 1) run = 1;
    longest = Math.max(longest, run);
  }
  return longest;
}
function habitCurrentStreak(habitId) { return currentStreakFromSet(habitDatesSet(habitId)); }
function habitLongestStreak(habitId) { return longestStreakFromSet(habitDatesSet(habitId)); }

function habitGridRange(weeks) {
  const monday = getMonday(new Date());
  const start = addDays(monday, -(weeks - 1) * 7);
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
}

function toggleHabitDate(habitId, iso) {
  const existing = state.habitLogs.find(l => l.habitId === habitId && l.date === iso);
  if (existing) state.habitLogs = state.habitLogs.filter(l => l !== existing);
  else state.habitLogs.push({ id: uid(), habitId, date: iso });
  save();
  renderHabits();
  if (currentViewName() === 'dashboard') renderDashboard();
}

/* ---------------------------------------------------------
   DOM refs
   --------------------------------------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const els = {
  html: document.documentElement,
  nav: $('#mainNav'),
  views: $$('.view'),
  themeToggle: $('#themeToggle'),
  themeToggleLabel: $('#themeToggleLabel'),
  mobileThemeBtn: $('#mobileThemeBtn'),
  mobileNavBtn: $('#mobileNavBtn'),
  mobileNavOverlay: $('#mobileNavOverlay'),
  sidebar: $('.sidebar'),

  greeting: $('#greeting'),
  greetingSub: $('#greetingSub'),
  todayDateLabel: $('#todayDateLabel'),
  statHoursToday: $('#statHoursToday'),
  statWeekTarget: $('#statWeekTarget'),
  statStreak: $('#statStreak'),
  statCompleted: $('#statCompleted'),
  todayTaskList: $('#todayTaskList'),
  upcomingExam: $('#upcomingExam'),
  quickSubjectSelect: $('#quickSubjectSelect'),
  quickStartBtn: $('#quickStartBtn'),

  addSubjectBtn: $('#addSubjectBtn'),
  subjectGrid: $('#subjectGrid'),
  subjectsEmpty: $('#subjectsEmpty'),
  subjectModalOverlay: $('#subjectModalOverlay'),
  subjectModalTitle: $('#subjectModalTitle'),
  subjectModalClose: $('#subjectModalClose'),
  subjectForm: $('#subjectForm'),
  subjectId: $('#subjectId'),
  subjectName: $('#subjectName'),
  subjectExamDate: $('#subjectExamDate'),
  subjectWeeklyTarget: $('#subjectWeeklyTarget'),
  colorPicker: $('#colorPicker'),
  deleteSubjectBtn: $('#deleteSubjectBtn'),

  weekLabel: $('#weekLabel'),
  weekPrevBtn: $('#weekPrevBtn'),
  weekNextBtn: $('#weekNextBtn'),
  plannerGrid: $('#plannerGrid'),
  blockModalOverlay: $('#blockModalOverlay'),
  blockModalClose: $('#blockModalClose'),
  blockForm: $('#blockForm'),
  blockDay: $('#blockDay'),
  blockSubject: $('#blockSubject'),
  blockStart: $('#blockStart'),
  blockEnd: $('#blockEnd'),
  blockNote: $('#blockNote'),

  modeBtns: $$('.mode-btn'),
  ringProgress: $('#ringProgress'),
  timerTime: $('#timerTime'),
  timerSessionLabel: $('#timerSessionLabel'),
  timerSubjectSelect: $('#timerSubjectSelect'),
  startPauseBtn: $('#startPauseBtn'),
  resetBtn: $('#resetBtn'),
  skipBtn: $('#skipBtn'),
  sessionLog: $('#sessionLog'),

  weeklyBarChart: $('#weeklyBarChart'),
  miniStats: $('#miniStats'),
  subjectProgressList: $('#subjectProgressList'),
  dailyBarChart: $('#dailyBarChart'),

  addHabitBtn: $('#addHabitBtn'),
  statHabitsTracked: $('#statHabitsTracked'),
  statHabitsToday: $('#statHabitsToday'),
  statBestStreak: $('#statBestStreak'),
  statCheckinsWeek: $('#statCheckinsWeek'),
  todayHabitList: $('#todayHabitList'),
  habitGrids: $('#habitGrids'),
  habitModalOverlay: $('#habitModalOverlay'),
  habitModalTitle: $('#habitModalTitle'),
  habitModalClose: $('#habitModalClose'),
  habitForm: $('#habitForm'),
  habitId: $('#habitId'),
  habitName: $('#habitName'),
  habitColorPicker: $('#habitColorPicker'),
  deleteHabitBtn: $('#deleteHabitBtn'),

  diaryTabs: $('#diaryTabs'),
  diaryPaneTitle: $('#diaryPaneTitle'),
  diaryPaneCount: $('#diaryPaneCount'),
  diaryGoalForm: $('#diaryGoalForm'),
  diaryGoalInput: $('#diaryGoalInput'),
  diaryGoalDescInput: $('#diaryGoalDescInput'),
  diaryGoalList: $('#diaryGoalList'),

  clockIcon: $('#clockIcon'),
  clockTime: $('#clockTime'),
  clockDate: $('#clockDate'),
  clockTZ: $('#clockTZ'),

  calcExpression: $('#calcExpression'),
  calcResult: $('#calcResult'),
  calcGrid: $('#calcGrid'),
};

/* ===========================================================
   Auth — local, demo-only account gate
   A single account is stored in localStorage. This is NOT
   secure (the password sits in plain text on the device) and
   is meant purely to demonstrate a login/signup flow client-side.
   =========================================================== */
const USER_KEY = 'studyflow_user_v1';
const REMEMBER_KEY = 'studyflow_remember_v1';
const SESSION_KEY = 'studyflow_logged_in_v1';

const auth = {
  screen: $('#authScreen'),
  appRoot: $('#appRoot'),
  form: $('#authForm'),
  title: $('#authTitle'),
  subtitle: $('#authSubtitle'),
  nameField: $('#authNameField'),
  name: $('#authName'),
  nameError: $('#authNameError'),
  email: $('#authEmail'),
  emailError: $('#authEmailError'),
  password: $('#authPassword'),
  passwordError: $('#authPasswordError'),
  toggleBtn: $('#authTogglePassword'),
  confirmField: $('#authConfirmField'),
  confirm: $('#authConfirm'),
  confirmError: $('#authConfirmError'),
  remember: $('#authRemember'),
  submitBtn: $('#authSubmitBtn'),
  message: $('#authMessage'),
  switchLine: $('#authSwitchLine'),
  switchLink: $('#authSwitchLink'),
  accountName: $('#accountName'),
  logoutBtn: $('#logoutBtn'),
  mode: 'signup',
};

function isValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function getStoredUser() { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch (e) { return null; } }
function setFieldError(input, errorEl, msg) { input.classList.add('input-error'); errorEl.textContent = msg; }
function clearFieldError(input, errorEl) { input.classList.remove('input-error'); errorEl.textContent = ''; }

function renderAuthMode(mode) {
  auth.mode = mode;
  auth.form.reset();
  [auth.email, auth.password, auth.name, auth.confirm].forEach(i => i.classList.remove('input-error'));
  [auth.emailError, auth.passwordError, auth.nameError, auth.confirmError, auth.message].forEach(e => { e.textContent = ''; e.className = e.className.replace(/\bis-(success|error)\b/g, '').trim(); });

  const user = getStoredUser();
  if (mode === 'signup') {
    auth.title.textContent = 'Create your account';
    auth.subtitle.textContent = 'Set up StudyFlow to start planning your study time.';
    auth.nameField.style.display = 'block';
    auth.confirmField.style.display = 'block';
    auth.submitBtn.textContent = 'Create account';
    auth.switchLine.style.display = 'none';
  } else {
    auth.title.textContent = 'Welcome back';
    auth.subtitle.textContent = 'Log in to continue to your study plan.';
    auth.nameField.style.display = 'none';
    auth.confirmField.style.display = 'none';
    auth.submitBtn.textContent = 'Log in';
    auth.switchLine.style.display = 'block';
    auth.switchLink.textContent = 'Not you? Reset local account';
    if (user) auth.email.value = user.email;
  }
}

function showAuthScreen(mode) {
  auth.screen.classList.add('is-active');
  auth.appRoot.style.display = 'none';
  renderAuthMode(mode || (getStoredUser() ? 'login' : 'signup'));
  auth.email.focus();
}

function showApp() {
  const user = getStoredUser();
  auth.screen.classList.remove('is-active');
  auth.appRoot.style.display = '';
  auth.accountName.textContent = (user && user.name) ? user.name : 'Student';
  initApp();
}

function isLoggedIn() {
  return sessionStorage.getItem(SESSION_KEY) === '1' || localStorage.getItem(REMEMBER_KEY) === '1';
}
function logIn(remember) {
  sessionStorage.setItem(SESSION_KEY, '1');
  if (remember) localStorage.setItem(REMEMBER_KEY, '1');
  else localStorage.removeItem(REMEMBER_KEY);
}
function logOut() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(REMEMBER_KEY);
  showAuthScreen('login');
}

auth.toggleBtn.addEventListener('click', () => {
  const hidden = auth.password.type === 'password';
  auth.password.type = hidden ? 'text' : 'password';
  auth.toggleBtn.textContent = hidden ? 'Hide' : 'Show';
});

auth.switchLink.addEventListener('click', (e) => {
  e.preventDefault();
  if (auth.mode === 'login') {
    if (!confirm('This clears the locally stored account (and keeps your study data). Continue?')) return;
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(REMEMBER_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    renderAuthMode('signup');
  }
});

auth.logoutBtn.addEventListener('click', logOut);

auth.form.addEventListener('submit', (e) => {
  e.preventDefault();
  let valid = true;

  const email = auth.email.value.trim();
  if (!email) { setFieldError(auth.email, auth.emailError, 'Email is required.'); valid = false; }
  else if (!isValidEmail(email)) { setFieldError(auth.email, auth.emailError, 'Enter a valid email address.'); valid = false; }
  else clearFieldError(auth.email, auth.emailError);

  const password = auth.password.value;
  if (!password) { setFieldError(auth.password, auth.passwordError, 'Password is required.'); valid = false; }
  else if (password.length < 6) { setFieldError(auth.password, auth.passwordError, 'At least 6 characters.'); valid = false; }
  else clearFieldError(auth.password, auth.passwordError);

  if (auth.mode === 'signup') {
    const name = auth.name.value.trim();
    if (!name) { setFieldError(auth.name, auth.nameError, 'Name is required.'); valid = false; }
    else clearFieldError(auth.name, auth.nameError);

    const confirmPassword = auth.confirm.value;
    if (confirmPassword !== password) { setFieldError(auth.confirm, auth.confirmError, 'Passwords do not match.'); valid = false; }
    else clearFieldError(auth.confirm, auth.confirmError);

    if (!valid) return;

    localStorage.setItem(USER_KEY, JSON.stringify({ name, email, password }));
    logIn(auth.remember.checked);
    auth.message.textContent = 'Account created!';
    auth.message.classList.add('is-success');
    showApp();
    return;
  }

  // login mode
  if (!valid) return;
  const user = getStoredUser();
  if (!user || user.email !== email || user.password !== password) {
    auth.message.textContent = 'Incorrect email or password.';
    auth.message.className = 'form-message is-error';
    return;
  }
  logIn(auth.remember.checked);
  showApp();
});

/* ---------------------------------------------------------
   Navigation
   --------------------------------------------------------- */
function setView(name) {
  els.views.forEach(v => v.classList.toggle('is-active', v.id === `view-${name}`));
  $$('.nav-item', els.nav).forEach(b => b.classList.toggle('is-active', b.dataset.view === name));
  closeMobileNav();
  renderAll(name);
}

els.nav.addEventListener('click', (e) => {
  const btn = e.target.closest('.nav-item');
  if (btn) setView(btn.dataset.view);
});

function openMobileNav() { els.sidebar.classList.add('is-open'); els.mobileNavOverlay.classList.add('is-open'); }
function closeMobileNav() { els.sidebar.classList.remove('is-open'); els.mobileNavOverlay.classList.remove('is-open'); }
els.mobileNavBtn.addEventListener('click', openMobileNav);
els.mobileNavOverlay.addEventListener('click', closeMobileNav);

/* ---------------------------------------------------------
   Theme
   --------------------------------------------------------- */
function applyTheme() {
  els.html.setAttribute('data-theme', state.theme);
  els.themeToggleLabel.textContent = state.theme === 'dark' ? 'Dark mode' : 'Light mode';
}
function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  save();
  applyTheme();
}
els.themeToggle.addEventListener('click', toggleTheme);
els.mobileThemeBtn.addEventListener('click', toggleTheme);

/* ---------------------------------------------------------
   Subject selects (shared across dashboard/timer/block modal)
   --------------------------------------------------------- */
function populateSubjectSelects() {
  const targets = [els.quickSubjectSelect, els.timerSubjectSelect, els.blockSubject];
  targets.forEach(sel => {
    const prev = sel.value;
    const isBlockSelect = sel === els.blockSubject;
    sel.innerHTML = isBlockSelect ? '' : '<option value="">No subject</option>';
    state.subjects.forEach(sub => {
      const opt = document.createElement('option');
      opt.value = sub.id;
      opt.textContent = sub.name;
      sel.appendChild(opt);
    });
    if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
  });
}

/* ---------------------------------------------------------
   Render: Dashboard
   --------------------------------------------------------- */
function renderDashboard() {
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  els.greeting.textContent = `${greet} 👋`;
  els.todayDateLabel.textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  const todayMins = state.sessions.filter(s => s.date === todayISO() && s.type === 'work').reduce((a, s) => a + s.minutes, 0);
  els.statHoursToday.textContent = formatHM(todayMins);

  const totalTarget = state.subjects.reduce((a, s) => a + Number(s.weeklyTarget || 0), 0);
  const { start, end } = weekBoundsFor(new Date());
  const totalLogged = sessionsInRange(null, start, end, 'work').reduce((a, s) => a + s.minutes, 0) / 60;
  const pct = totalTarget > 0 ? Math.round((totalLogged / totalTarget) * 100) : 0;
  els.statWeekTarget.textContent = `${pct}%`;

  els.statStreak.textContent = `${computeStreak()} 🔥`;

  const todaysBlocks = state.blocks.filter(b => b.date === todayISO()).sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  els.statCompleted.textContent = todaysBlocks.filter(b => b.completed).length;

  els.todayTaskList.innerHTML = '';
  if (todaysBlocks.length === 0) {
    els.todayTaskList.innerHTML = '<p class="empty-note">No study blocks scheduled for today. Add one from the Planner.</p>';
  } else {
    todaysBlocks.forEach(block => els.todayTaskList.appendChild(taskItemEl(block)));
  }

  renderUpcomingExam();
}

function taskItemEl(block) {
  const subject = getSubject(block.subjectId);
  const el = document.createElement('div');
  el.className = 'task-item' + (block.completed ? ' is-done' : '');
  el.innerHTML = `
    <span class="task-check">${checkIconSVG()}</span>
    <span class="task-dot" style="background:${subject ? subject.color : '#888'}"></span>
    <div style="flex:1">
      <div class="task-title">${escapeHTML(subject ? subject.name : 'General')}${block.note ? ' — ' + escapeHTML(block.note) : ''}</div>
      <div class="task-meta">${block.start} – ${block.end}</div>
    </div>
  `;
  el.querySelector('.task-check').addEventListener('click', () => toggleBlockCompleted(block.id));
  return el;
}
function checkIconSVG() { return '<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>'; }
function escapeHTML(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function toggleBlockCompleted(blockId) {
  const block = state.blocks.find(b => b.id === blockId);
  if (!block) return;
  block.completed = !block.completed;
  if (block.completed) {
    state.sessions.push({
      id: uid(), subjectId: block.subjectId, date: block.date,
      minutes: durationMinutes(block.start, block.end), type: 'work',
      time: block.start, fromBlock: block.id,
    });
  } else {
    state.sessions = state.sessions.filter(s => s.fromBlock !== block.id);
  }
  save();
  renderAll(currentViewName());
}

function renderUpcomingExam() {
  const upcoming = state.subjects
    .filter(s => s.examDate && daysUntil(s.examDate) >= 0)
    .sort((a, b) => daysUntil(a.examDate) - daysUntil(b.examDate));

  if (upcoming.length === 0) {
    els.upcomingExam.innerHTML = '<p class="empty-note">No exam dates added yet. Add one under Subjects.</p>';
    return;
  }
  const s = upcoming[0];
  const days = daysUntil(s.examDate);
  const level = urgencyLevel(days);
  const logged = hoursLoggedThisWeek(s.id);
  const pct = s.weeklyTarget > 0 ? Math.min(100, Math.round((logged / s.weeklyTarget) * 100)) : 0;
  els.upcomingExam.innerHTML = `
    <div class="subject-card" style="--subject-color:${s.color}; cursor:default;">
      <div class="subject-card-head">
        <span class="subject-name">${escapeHTML(s.name)}</span>
        <span class="urgency-pill urgency-${level}">${days === 0 ? 'Today' : days + ' day' + (days === 1 ? '' : 's') + ' left'}</span>
      </div>
      <span class="subject-countdown">${fromISODate(s.examDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
      <span class="subject-countdown-label">Exam date</span>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
      <span class="subject-progress-text">${pct}% of this week's ${s.weeklyTarget}h target</span>
    </div>
  `;
}

/* ---------------------------------------------------------
   Render: Subjects
   --------------------------------------------------------- */
function renderSubjects() {
  const sorted = [...state.subjects].sort((a, b) => {
    const da = a.examDate ? daysUntil(a.examDate) : Infinity;
    const db = b.examDate ? daysUntil(b.examDate) : Infinity;
    return da - db;
  });
  els.subjectGrid.innerHTML = '';
  els.subjectsEmpty.style.display = sorted.length ? 'none' : 'block';

  sorted.forEach(s => {
    const days = daysUntil(s.examDate);
    const level = urgencyLevel(s.examDate ? days : null);
    const logged = hoursLoggedThisWeek(s.id);
    const pct = s.weeklyTarget > 0 ? Math.min(100, Math.round((logged / s.weeklyTarget) * 100)) : 0;
    const suggested = suggestedHoursPerDay(s);

    let countdownText, countdownSub;
    if (!s.examDate) { countdownText = '—'; countdownSub = 'No exam date set'; }
    else if (days < 0) { countdownText = 'Passed'; countdownSub = fromISODate(s.examDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
    else { countdownText = days === 0 ? 'Today' : `${days}d`; countdownSub = 'until exam'; }

    const card = document.createElement('div');
    card.className = 'subject-card';
    card.style.setProperty('--subject-color', s.color);
    card.innerHTML = `
      <div class="subject-card-head">
        <span class="subject-name">${escapeHTML(s.name)}</span>
        <span class="urgency-pill urgency-${level}">${level === 'none' ? 'No exam' : level === 'urgent' ? 'Urgent' : level === 'soon' ? 'Soon' : 'On track'}</span>
      </div>
      <span class="subject-countdown">${countdownText}</span>
      <span class="subject-countdown-label">${countdownSub}</span>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
      <span class="subject-progress-text">${logged.toFixed(1)}h / ${s.weeklyTarget}h this week (${pct}%)</span>
      <p class="subject-suggest">${suggested > 0 ? `Suggested: ${suggested.toFixed(1)} h/day to hit target` : 'Weekly target reached 🎉'}</p>
    `;
    card.addEventListener('click', () => openSubjectModal(s.id));
    els.subjectGrid.appendChild(card);
  });
}

function buildColorPicker(container, selected) {
  container.innerHTML = '';
  PALETTE.forEach(color => {
    const sw = document.createElement('div');
    sw.className = 'color-swatch' + (color === selected ? ' is-selected' : '');
    sw.style.background = color;
    sw.dataset.color = color;
    sw.addEventListener('click', () => {
      $$('.color-swatch', container).forEach(el => el.classList.remove('is-selected'));
      sw.classList.add('is-selected');
    });
    container.appendChild(sw);
  });
}
function selectedColorFrom(container) {
  const sel = $('.color-swatch.is-selected', container);
  return sel ? sel.dataset.color : PALETTE[0];
}

function openSubjectModal(id) {
  const subject = id ? getSubject(id) : null;
  els.subjectModalTitle.textContent = subject ? 'Edit subject' : 'Add subject';
  els.subjectId.value = subject ? subject.id : '';
  els.subjectName.value = subject ? subject.name : '';
  els.subjectExamDate.value = subject ? subject.examDate : '';
  els.subjectWeeklyTarget.value = subject ? subject.weeklyTarget : 5;
  els.deleteSubjectBtn.style.display = subject ? 'block' : 'none';
  buildColorPicker(els.colorPicker, subject ? subject.color : PALETTE[state.subjects.length % PALETTE.length]);
  els.subjectModalOverlay.classList.add('is-open');
  els.subjectName.focus();
}
function closeSubjectModal() { els.subjectModalOverlay.classList.remove('is-open'); }

els.addSubjectBtn.addEventListener('click', () => openSubjectModal(null));
els.subjectModalClose.addEventListener('click', closeSubjectModal);
els.subjectModalOverlay.addEventListener('click', (e) => { if (e.target === els.subjectModalOverlay) closeSubjectModal(); });

els.subjectForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = els.subjectId.value;
  const data = {
    name: els.subjectName.value.trim(),
    examDate: els.subjectExamDate.value,
    weeklyTarget: Number(els.subjectWeeklyTarget.value) || 0,
    color: selectedColorFrom(els.colorPicker),
  };
  if (!data.name) return;
  if (id) {
    Object.assign(getSubject(id), data);
  } else {
    state.subjects.push({ id: uid(), ...data });
  }
  save();
  closeSubjectModal();
  populateSubjectSelects();
  renderAll(currentViewName());
});

els.deleteSubjectBtn.addEventListener('click', () => {
  const id = els.subjectId.value;
  if (!id) return;
  if (!confirm('Delete this subject? Its planner blocks and sessions will also be removed.')) return;
  state.subjects = state.subjects.filter(s => s.id !== id);
  state.blocks = state.blocks.filter(b => b.subjectId !== id);
  state.sessions = state.sessions.filter(s => s.subjectId !== id);
  save();
  closeSubjectModal();
  populateSubjectSelects();
  renderAll(currentViewName());
});

/* ---------------------------------------------------------
   Render: Planner
   --------------------------------------------------------- */
let plannerWeekOffset = 0;

function renderPlanner() {
  const week = getWeekDates(plannerWeekOffset);
  els.weekLabel.textContent = `${monthDay(week[0])} – ${monthDay(week[6])}${plannerWeekOffset === 0 ? ' (this week)' : ''}`;
  els.plannerGrid.innerHTML = '';

  week.forEach((date, idx) => {
    const iso = toISODate(date);
    const isToday = iso === todayISO();
    const col = document.createElement('div');
    col.className = 'planner-day' + (isToday ? ' is-today' : '');
    col.dataset.date = iso;

    const head = document.createElement('div');
    head.className = 'planner-day-head';
    head.innerHTML = `<span class="planner-day-name">${DAY_NAMES[idx]}</span><span class="planner-day-date">${dayLabel(date)}</span>`;
    col.appendChild(head);

    const body = document.createElement('div');
    body.className = 'planner-day-body';
    const dayBlocks = state.blocks.filter(b => b.date === iso).sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
    if (dayBlocks.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-note';
      empty.style.fontSize = '0.78rem';
      empty.textContent = 'No blocks yet.';
      body.appendChild(empty);
    } else {
      dayBlocks.forEach(b => body.appendChild(blockCardEl(b, iso, isToday)));
    }
    col.appendChild(body);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'planner-add-btn';
    addBtn.textContent = '+ Add block';
    addBtn.addEventListener('click', () => openBlockModal(iso));
    col.appendChild(addBtn);

    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('is-dragover'); });
    col.addEventListener('dragleave', () => col.classList.remove('is-dragover'));
    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.classList.remove('is-dragover');
      const blockId = e.dataTransfer.getData('text/plain');
      const block = state.blocks.find(b => b.id === blockId);
      if (block) { block.date = iso; save(); renderAll(currentViewName()); }
    });

    els.plannerGrid.appendChild(col);
  });
}

function blockCardEl(block, iso, isToday) {
  const subject = getSubject(block.subjectId);
  const now = new Date();
  const isPastDay = fromISODate(iso) < fromISODate(todayISO());
  const isPastToday = isToday && timeToMinutes(pad(now.getHours()) + ':' + pad(now.getMinutes())) > timeToMinutes(block.end);
  const overdue = !block.completed && (isPastDay || isPastToday);

  const card = document.createElement('div');
  card.className = 'block-card' + (block.completed ? ' is-completed' : '') + (overdue ? ' is-overdue' : '');
  card.style.setProperty('--subject-color', subject ? subject.color : '#888');
  card.draggable = true;
  card.innerHTML = `
    <div class="block-time">${block.start} – ${block.end}${overdue ? ' · overdue' : ''}</div>
    <div class="block-subject">${escapeHTML(subject ? subject.name : 'General')}</div>
    ${block.note ? `<div class="block-note">${escapeHTML(block.note)}</div>` : ''}
    <div class="block-actions">
      <button type="button" class="btn-complete ${block.completed ? 'is-on' : ''}">${block.completed ? 'Done' : 'Mark done'}</button>
      <button type="button" class="btn-delete">Delete</button>
    </div>
  `;
  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', block.id);
    card.classList.add('is-dragging');
  });
  card.addEventListener('dragend', () => card.classList.remove('is-dragging'));
  card.querySelector('.btn-complete').addEventListener('click', () => toggleBlockCompleted(block.id));
  card.querySelector('.btn-delete').addEventListener('click', () => {
    state.blocks = state.blocks.filter(b => b.id !== block.id);
    state.sessions = state.sessions.filter(s => s.fromBlock !== block.id);
    save();
    renderAll(currentViewName());
  });
  return card;
}

function openBlockModal(iso) {
  els.blockDay.value = iso;
  els.blockForm.reset();
  els.blockStart.value = '17:00';
  els.blockEnd.value = '18:00';
  if (els.blockSubject.options.length === 0) {
    alert('Add a subject first before scheduling a study block.');
    return;
  }
  els.blockModalOverlay.classList.add('is-open');
}
function closeBlockModal() { els.blockModalOverlay.classList.remove('is-open'); }

els.blockModalClose.addEventListener('click', closeBlockModal);
els.blockModalOverlay.addEventListener('click', (e) => { if (e.target === els.blockModalOverlay) closeBlockModal(); });

els.blockForm.addEventListener('submit', (e) => {
  e.preventDefault();
  state.blocks.push({
    id: uid(),
    subjectId: els.blockSubject.value,
    date: els.blockDay.value,
    start: els.blockStart.value,
    end: els.blockEnd.value,
    note: els.blockNote.value.trim(),
    completed: false,
  });
  save();
  closeBlockModal();
  renderAll(currentViewName());
});

els.weekPrevBtn.addEventListener('click', () => { plannerWeekOffset--; renderPlanner(); });
els.weekNextBtn.addEventListener('click', () => { plannerWeekOffset++; renderPlanner(); });

/* ---------------------------------------------------------
   Focus Timer
   --------------------------------------------------------- */
const timer = {
  mode: 'work',
  remaining: WORK_SECONDS,
  running: false,
  intervalId: null,
};

function timerTotal() { return timer.mode === 'work' ? WORK_SECONDS : BREAK_SECONDS; }

function updateTimerDisplay() {
  const m = Math.floor(timer.remaining / 60);
  const s = timer.remaining % 60;
  const text = `${pad(m)}:${pad(s)}`;
  els.timerTime.textContent = text;
  $('#quickTimerValue').textContent = text;
  els.timerSessionLabel.textContent = timer.mode === 'work' ? 'Work session' : 'Break';
  const offset = RING_CIRCUMFERENCE * (1 - timer.remaining / timerTotal());
  els.ringProgress.style.strokeDashoffset = offset;
  els.ringProgress.style.stroke = timer.mode === 'work' ? 'var(--amber)' : 'var(--teal)';
  els.startPauseBtn.textContent = timer.running ? 'Pause' : 'Start';
}

function setTimerMode(mode) {
  timer.mode = mode;
  timer.remaining = timerTotal();
  els.modeBtns.forEach(b => b.classList.toggle('is-active', b.dataset.mode === mode));
  updateTimerDisplay();
}

function startTimer() {
  if (timer.running) return;
  timer.running = true;
  updateTimerDisplay();
  timer.intervalId = setInterval(() => {
    timer.remaining--;
    if (timer.remaining <= 0) {
      completeTimerSession();
      return;
    }
    updateTimerDisplay();
  }, 1000);
}
function pauseTimer() {
  timer.running = false;
  clearInterval(timer.intervalId);
  updateTimerDisplay();
}
function resetTimer() {
  pauseTimer();
  timer.remaining = timerTotal();
  updateTimerDisplay();
}
function completeTimerSession() {
  pauseTimer();
  const finishedMode = timer.mode;
  const now = new Date();
  state.sessions.push({
    id: uid(),
    subjectId: els.timerSubjectSelect.value || null,
    date: todayISO(),
    minutes: finishedMode === 'work' ? WORK_SECONDS / 60 : BREAK_SECONDS / 60,
    type: finishedMode,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  });
  save();
  flashTitle(finishedMode === 'work' ? '✅ Focus session done — take a break!' : '🔔 Break over — back to it!');
  setTimerMode(finishedMode === 'work' ? 'break' : 'work');
  renderSessionLog();
  if (currentViewName() === 'dashboard') renderDashboard();
}

let titleFlashTimeout = null;
function flashTitle(msg) {
  const original = 'StudyFlow — Smart Study Planner';
  document.title = msg;
  clearTimeout(titleFlashTimeout);
  titleFlashTimeout = setTimeout(() => { document.title = original; }, 4000);
}

els.modeBtns.forEach(btn => btn.addEventListener('click', () => { if (!timer.running) setTimerMode(btn.dataset.mode); }));
els.startPauseBtn.addEventListener('click', () => timer.running ? pauseTimer() : startTimer());
els.resetBtn.addEventListener('click', resetTimer);
els.skipBtn.addEventListener('click', () => setTimerMode(timer.mode === 'work' ? 'break' : 'work'));

els.quickStartBtn.addEventListener('click', () => {
  els.timerSubjectSelect.value = els.quickSubjectSelect.value;
  setView('timer');
  setTimerMode('work');
  startTimer();
});

function renderSessionLog() {
  const todays = state.sessions.filter(s => s.date === todayISO()).sort((a, b) => (b.time || '').localeCompare(a.time || ''));
  els.sessionLog.innerHTML = '';
  if (todays.length === 0) {
    els.sessionLog.innerHTML = '<p class="empty-note">No focus sessions logged yet today.</p>';
    return;
  }
  todays.forEach(s => {
    const subject = getSubject(s.subjectId);
    const row = document.createElement('div');
    row.className = 'session-item';
    row.innerHTML = `
      <span class="session-dot" style="background:${subject ? subject.color : '#888'}"></span>
      <span>${escapeHTML(subject ? subject.name : 'General')} · ${s.type === 'work' ? 'Focus' : 'Break'}</span>
      <span class="subtle">${Math.round(s.minutes)}m</span>
    `;
    els.sessionLog.appendChild(row);
  });
}

/* ---------------------------------------------------------
   Render: Statistics
   --------------------------------------------------------- */
function renderStats() {
  // Weekly target vs actual, per subject
  const { start, end } = weekBoundsFor(new Date());
  const maxVal = Math.max(1, ...state.subjects.map(s => Math.max(s.weeklyTarget, hoursLoggedThisWeek(s.id))));
  els.weeklyBarChart.innerHTML = '';
  if (state.subjects.length === 0) {
    els.weeklyBarChart.innerHTML = '<p class="empty-note">Add a subject to see this chart.</p>';
  } else {
    state.subjects.forEach(s => {
      const actual = hoursLoggedThisWeek(s.id);
      const col = document.createElement('div');
      col.className = 'bar-col';
      col.innerHTML = `
        <div class="bar-stack" title="${s.name}: ${actual.toFixed(1)}h of ${s.weeklyTarget}h">
          <div class="bar-target" style="height:${(s.weeklyTarget / maxVal) * 100}%"></div>
          <div class="bar-actual" style="height:${(actual / maxVal) * 100}%; background:${s.color}"></div>
        </div>
        <span class="bar-col-label">${s.name.length > 8 ? s.name.slice(0, 7) + '…' : s.name}</span>
      `;
      els.weeklyBarChart.appendChild(col);
    });
  }

  // Mini stats
  const totalTarget = state.subjects.reduce((a, s) => a + Number(s.weeklyTarget || 0), 0);
  const totalActual = sessionsInRange(null, start, end, 'work').reduce((a, s) => a + s.minutes, 0) / 60;
  const completedSessions = sessionsInRange(null, start, end, 'work').length;
  els.miniStats.innerHTML = `
    <div class="mini-stat-row"><span class="mini-label">Planned this week</span><span class="mini-value">${totalTarget.toFixed(1)}h</span></div>
    <div class="mini-stat-row"><span class="mini-label">Actually studied</span><span class="mini-value">${totalActual.toFixed(1)}h</span></div>
    <div class="mini-stat-row"><span class="mini-label">Focus sessions</span><span class="mini-value">${completedSessions}</span></div>
    <div class="mini-stat-row"><span class="mini-label">Current streak</span><span class="mini-value">${computeStreak()} 🔥</span></div>
  `;

  // Subject progress list
  els.subjectProgressList.innerHTML = '';
  if (state.subjects.length === 0) {
    els.subjectProgressList.innerHTML = '<p class="empty-note">No subjects yet.</p>';
  } else {
    state.subjects.forEach(s => {
      const logged = hoursLoggedThisWeek(s.id);
      const pct = s.weeklyTarget > 0 ? Math.min(100, Math.round((logged / s.weeklyTarget) * 100)) : 0;
      const row = document.createElement('div');
      row.className = 'sp-row';
      row.innerHTML = `
        <span class="sp-name">${escapeHTML(s.name)}</span>
        <div class="sp-track"><div class="sp-fill" style="width:${pct}%; background:${s.color}"></div></div>
        <span class="sp-pct">${pct}%</span>
      `;
      els.subjectProgressList.appendChild(row);
    });
  }

  // Daily productivity — last 7 days
  const days = Array.from({ length: 7 }, (_, i) => addDays(new Date(), -6 + i));
  const dayTotals = days.map(d => {
    const iso = toISODate(d);
    return state.sessions.filter(s => s.date === iso && s.type === 'work').reduce((a, s) => a + s.minutes, 0) / 60;
  });
  const maxDay = Math.max(1, ...dayTotals);
  els.dailyBarChart.innerHTML = '';
  days.forEach((d, i) => {
    const col = document.createElement('div');
    col.className = 'bar-col';
    const h = (dayTotals[i] / maxDay) * 100;
    col.innerHTML = `
      <div class="bar-stack" title="${dayTotals[i].toFixed(1)}h">
        <div class="bar-actual" style="height:${h}%"></div>
      </div>
      <span class="bar-col-label">${d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
    `;
    els.dailyBarChart.appendChild(col);
  });
}

/* ---------------------------------------------------------
   Render: Habits (Habitub)
   --------------------------------------------------------- */
function editIconSVG() {
  return '<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
}

function renderHabits() {
  const total = state.habits.length;
  const doneToday = state.habitLogs.filter(l => l.date === todayISO()).length;
  els.statHabitsTracked.textContent = total;
  els.statHabitsToday.textContent = `${doneToday}/${total}`;

  const best = state.habits.reduce((m, h) => Math.max(m, habitCurrentStreak(h.id)), 0);
  els.statBestStreak.textContent = `${best} 🔥`;

  const weekStart = getMonday(new Date());
  const weekEnd = addDays(weekStart, 6);
  const weekCheckins = state.habitLogs.filter(l => {
    const d = fromISODate(l.date);
    return d >= weekStart && d <= weekEnd;
  }).length;
  els.statCheckinsWeek.textContent = weekCheckins;

  els.todayHabitList.innerHTML = '';
  if (total === 0) {
    els.todayHabitList.innerHTML = '<p class="empty-note">No habits yet. Add one to start tracking.</p>';
  } else {
    state.habits.forEach(h => els.todayHabitList.appendChild(habitTaskItemEl(h)));
  }

  els.habitGrids.innerHTML = '';
  if (total === 0) {
    els.habitGrids.innerHTML = '<p class="empty-note">Your activity grids will appear here once you add a habit.</p>';
  } else {
    state.habits.forEach(h => els.habitGrids.appendChild(habitCardEl(h)));
  }
}

function habitTaskItemEl(habit) {
  const doneToday = state.habitLogs.some(l => l.habitId === habit.id && l.date === todayISO());
  const el = document.createElement('div');
  el.className = 'task-item' + (doneToday ? ' is-done' : '');
  el.innerHTML = `
    <span class="task-check">${checkIconSVG()}</span>
    <span class="task-dot" style="background:${habit.color}"></span>
    <div style="flex:1">
      <div class="task-title">${escapeHTML(habit.name)}</div>
    </div>
    <span class="habit-mini-streak">${habitCurrentStreak(habit.id)} 🔥</span>
  `;
  el.querySelector('.task-check').addEventListener('click', () => toggleHabitDate(habit.id, todayISO()));
  return el;
}

function habitCardEl(habit) {
  const card = document.createElement('div');
  card.className = 'habit-card';
  const cur = habitCurrentStreak(habit.id);
  const longest = habitLongestStreak(habit.id);
  card.innerHTML = `
    <div class="habit-card-head">
      <div class="habit-name-row">
        <span class="habit-dot" style="background:${habit.color}"></span>
        <span class="habit-name">${escapeHTML(habit.name)}</span>
      </div>
      <div class="habit-streaks">
        <span>Current: <b>${cur}</b></span>
        <span>Best: <b>${longest}</b></span>
      </div>
      <div class="habit-card-actions">
        <button type="button" class="habit-icon-btn" data-action="edit" title="Edit habit">${editIconSVG()}</button>
      </div>
    </div>
    <div class="habit-grid-scroll"><div class="habit-grid"></div></div>
  `;

  const grid = card.querySelector('.habit-grid');
  grid.style.setProperty('--habit-color', habit.color);
  const weeks = habitGridRange(HABIT_GRID_WEEKS);
  const doneSet = habitDatesSet(habit.id);
  const todayD = fromISODate(todayISO());
  const todayIso = todayISO();

  weeks.forEach(week => {
    const col = document.createElement('div');
    col.className = 'habit-week';
    week.forEach(date => {
      const iso = toISODate(date);
      const isFuture = date > todayD;
      const isDone = doneSet.has(iso);
      const cell = document.createElement('div');
      cell.className = 'habit-day' + (isDone ? ' is-done' : '') + (isFuture ? ' is-future' : '') + (iso === todayIso ? ' is-today' : '');
      cell.title = `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}${isDone ? ' — done' : ''}`;
      if (!isFuture) cell.addEventListener('click', () => toggleHabitDate(habit.id, iso));
      col.appendChild(cell);
    });
    grid.appendChild(col);
  });

  card.querySelector('[data-action="edit"]').addEventListener('click', () => openHabitModal(habit.id));
  return card;
}

function openHabitModal(id) {
  const habit = id ? getHabit(id) : null;
  els.habitModalTitle.textContent = habit ? 'Edit habit' : 'Add habit';
  els.habitId.value = habit ? habit.id : '';
  els.habitName.value = habit ? habit.name : '';
  els.deleteHabitBtn.style.display = habit ? 'block' : 'none';
  buildColorPicker(els.habitColorPicker, habit ? habit.color : PALETTE[state.habits.length % PALETTE.length]);
  els.habitModalOverlay.classList.add('is-open');
  els.habitName.focus();
}
function closeHabitModal() { els.habitModalOverlay.classList.remove('is-open'); }

els.addHabitBtn.addEventListener('click', () => openHabitModal(null));
els.habitModalClose.addEventListener('click', closeHabitModal);
els.habitModalOverlay.addEventListener('click', (e) => { if (e.target === els.habitModalOverlay) closeHabitModal(); });

els.habitForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = els.habitId.value;
  const data = {
    name: els.habitName.value.trim(),
    color: selectedColorFrom(els.habitColorPicker),
  };
  if (!data.name) return;
  if (id) Object.assign(getHabit(id), data);
  else state.habits.push({ id: uid(), ...data });
  save();
  closeHabitModal();
  renderHabits();
});

els.deleteHabitBtn.addEventListener('click', () => {
  const id = els.habitId.value;
  if (!id) return;
  if (!confirm('Delete this habit? Its activity history will also be removed.')) return;
  state.habits = state.habits.filter(h => h.id !== id);
  state.habitLogs = state.habitLogs.filter(l => l.habitId !== id);
  save();
  closeHabitModal();
  renderHabits();
});

/* ---------------------------------------------------------
   Render: Diary (Goals Diary — Diary 3)
   --------------------------------------------------------- */
let diaryActiveScope = 'today';

function weekKeyOf(dateISO) { return toISODate(getMonday(fromISODate(dateISO))); }
function currentWeekKey() { return toISODate(getMonday(new Date())); }

function diaryGoalsForScope(scope) {
  if (scope === 'today') return state.diaryGoals.filter(g => g.scope === 'today' && g.date === todayISO());
  if (scope === 'week') return state.diaryGoals.filter(g => g.scope === 'week' && weekKeyOf(g.date) === currentWeekKey());
  return state.diaryGoals.filter(g => g.scope === 'future');
}

const DIARY_TITLES = { today: "Today's goals", week: "This week's goals", future: 'Future goals' };
const DIARY_PLACEHOLDERS = {
  today: 'What do you want to achieve today?',
  week: 'What do you want to achieve this week?',
  future: 'What do you want to achieve someday?',
};

function trashIconSVG() {
  return '<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z"/></svg>';
}

function renderDiary() {
  $$('.tab-btn', els.diaryTabs).forEach(b => b.classList.toggle('is-active', b.dataset.scope === diaryActiveScope));
  els.diaryPaneTitle.textContent = DIARY_TITLES[diaryActiveScope];
  els.diaryGoalInput.placeholder = DIARY_PLACEHOLDERS[diaryActiveScope];

  const list = diaryGoalsForScope(diaryActiveScope);
  const doneCount = list.filter(g => g.done).length;
  els.diaryPaneCount.textContent = `${doneCount}/${list.length} done`;

  els.diaryGoalList.innerHTML = '';
  if (list.length === 0) {
    els.diaryGoalList.innerHTML = '<p class="empty-note">Nothing here yet — add your first goal above.</p>';
    return;
  }
  list.slice().reverse().forEach(g => els.diaryGoalList.appendChild(diaryGoalItemEl(g)));
}

function diaryGoalItemEl(goal) {
  const el = document.createElement('div');
  el.className = 'task-item diary-item' + (goal.done ? ' is-done' : '');
  el.innerHTML = `
    <span class="task-check">${checkIconSVG()}</span>
    <div class="diary-goal-body">
      <div class="task-title">${escapeHTML(goal.text)}</div>
      ${goal.description ? `<div class="diary-goal-desc">${escapeHTML(goal.description)}</div>` : ''}
    </div>
    <button type="button" class="diary-delete-btn" title="Delete">${trashIconSVG()}</button>
  `;
  el.querySelector('.task-check').addEventListener('click', () => toggleDiaryGoal(goal.id));
  el.querySelector('.diary-delete-btn').addEventListener('click', () => deleteDiaryGoal(goal.id));
  return el;
}

function toggleDiaryGoal(id) {
  const g = state.diaryGoals.find(x => x.id === id);
  if (!g) return;
  g.done = !g.done;
  save();
  renderDiary();
}
function deleteDiaryGoal(id) {
  state.diaryGoals = state.diaryGoals.filter(g => g.id !== id);
  save();
  renderDiary();
}

els.diaryTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  diaryActiveScope = btn.dataset.scope;
  renderDiary();
});

els.diaryGoalForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = els.diaryGoalInput.value.trim();
  const description = els.diaryGoalDescInput.value.trim();
  if (!text) return;
  state.diaryGoals.push({ id: uid(), scope: diaryActiveScope, text, description, done: false, date: todayISO() });
  els.diaryGoalInput.value = '';
  els.diaryGoalDescInput.value = '';
  save();
  renderDiary();
});

/* ---------------------------------------------------------
   Clock
   --------------------------------------------------------- */
let clockIntervalId = null;
function updateClock() {
  const now = new Date();
  const h = now.getHours();
  els.clockTime.textContent = `${pad(h)}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  els.clockDate.textContent = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  els.clockIcon.textContent = h < 6 ? '🌙' : h < 12 ? '🌤️' : h < 18 ? '☀️' : h < 21 ? '🌇' : '🌙';
  try { els.clockTZ.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { els.clockTZ.textContent = ''; }
}
function startClock() {
  updateClock();
  if (clockIntervalId) clearInterval(clockIntervalId);
  clockIntervalId = setInterval(updateClock, 1000);
}

/* ---------------------------------------------------------
   Calculator
   --------------------------------------------------------- */
const calc = { current: '0', previous: null, operator: null, overwrite: true };

function trimNumber(n) {
  if (!Number.isFinite(n)) return 'Error';
  return String(Math.round(n * 1e10) / 1e10);
}

function updateCalcDisplay() {
  els.calcResult.textContent = calc.current;
  els.calcExpression.textContent = calc.operator ? `${calc.previous} ${calc.operator}` : '';
}

function calcInputDigit(d) {
  if (calc.overwrite) {
    calc.current = d === '.' ? '0.' : d;
    calc.overwrite = false;
  } else if (d === '.') {
    if (!calc.current.includes('.')) calc.current += '.';
  } else {
    calc.current = calc.current === '0' ? d : calc.current + d;
  }
  updateCalcDisplay();
}

function calcCompute() {
  const prev = parseFloat(calc.previous);
  const curr = parseFloat(calc.current);
  if (Number.isNaN(prev) || Number.isNaN(curr)) return;
  let result;
  switch (calc.operator) {
    case '+': result = prev + curr; break;
    case '−': result = prev - curr; break;
    case '×': result = prev * curr; break;
    case '÷': result = curr === 0 ? NaN : prev / curr; break;
    default: return;
  }
  calc.current = trimNumber(result);
  calc.operator = null;
  calc.previous = null;
  calc.overwrite = true;
}

function calcChooseOperator(op) {
  if (calc.operator && !calc.overwrite) calcCompute();
  calc.previous = calc.current;
  calc.operator = op;
  calc.overwrite = true;
  updateCalcDisplay();
}

function calcClear() {
  calc.current = '0';
  calc.previous = null;
  calc.operator = null;
  calc.overwrite = true;
  updateCalcDisplay();
}

function calcBackspace() {
  if (calc.overwrite) return;
  calc.current = calc.current.length > 1 ? calc.current.slice(0, -1) : '0';
  if (calc.current === '-') calc.current = '0';
  updateCalcDisplay();
}

function calcPercent() {
  calc.current = trimNumber(parseFloat(calc.current) / 100);
  updateCalcDisplay();
}

function calcEquals() {
  if (calc.operator === null) return;
  const prevText = calc.previous, opText = calc.operator, currText = calc.current;
  calcCompute();
  els.calcExpression.textContent = `${prevText} ${opText} ${currText} =`;
  els.calcResult.textContent = calc.current;
}

els.calcGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.num !== undefined) calcInputDigit(btn.dataset.num);
  else if (btn.dataset.op) calcChooseOperator(btn.dataset.op);
  else if (btn.dataset.action === 'clear') calcClear();
  else if (btn.dataset.action === 'backspace') calcBackspace();
  else if (btn.dataset.action === 'percent') calcPercent();
  else if (btn.dataset.action === 'equals') calcEquals();
});

document.addEventListener('keydown', (e) => {
  if (currentViewName() !== 'calculator') return;
  if (e.key >= '0' && e.key <= '9') calcInputDigit(e.key);
  else if (e.key === '.') calcInputDigit('.');
  else if (e.key === '+') calcChooseOperator('+');
  else if (e.key === '-') calcChooseOperator('−');
  else if (e.key === '*') calcChooseOperator('×');
  else if (e.key === '/') { e.preventDefault(); calcChooseOperator('÷'); }
  else if (e.key === 'Enter' || e.key === '=') calcEquals();
  else if (e.key === 'Backspace') calcBackspace();
  else if (e.key === 'Escape') calcClear();
});

/* ---------------------------------------------------------
   Master render dispatcher
   --------------------------------------------------------- */
function currentViewName() {
  const active = els.views.find(v => v.classList.contains('is-active'));
  return active ? active.id.replace('view-', '') : 'dashboard';
}

function renderAll(activeView) {
  populateSubjectSelects();
  renderDashboard();
  renderSubjects();
  renderPlanner();
  renderSessionLog();
  renderStats();
  renderHabits();
  renderDiary();
}

/* ---------------------------------------------------------
   Init
   --------------------------------------------------------- */
function initApp() {
  applyTheme();
  updateTimerDisplay();
  renderAll('dashboard');
  startClock();
  calcClear();
}

/* ---------------------------------------------------------
   Bootstrap — decide whether to show the login screen or
   go straight into the app
   --------------------------------------------------------- */
applyTheme(); // theme should apply even behind the login screen
if (isLoggedIn() && getStoredUser()) {
  showApp();
} else {
  showAuthScreen();
}