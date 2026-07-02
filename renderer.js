/* ===================================================
   WeekToDo Planner — renderer.js
   =================================================== */

// ── CONSTANTS ──────────────────────────────────────

const DAY_NAMES    = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const LIST_IDS     = ['custom', 'grocery', 'ideas'];
const LIST_NAMES   = { custom: 'Custom List', grocery: 'Grocery List', ideas: 'Ideas' };
const COLORS       = ['none', 'green', 'yellow', 'blue', 'red', 'purple'];
const COLOR_HEX    = {
  none: null, green: '#4eca6d', yellow: '#f4b942',
  blue: '#5b8ff9', red: '#e8506a', purple: '#9d6fff'
};
const SLOTS        = 9;   // empty slot rows per column

// ── STATE ──────────────────────────────────────────

let state = {
  weekOffset: 0,
  dayTasks:  {},
  listTasks: { custom: [], grocery: [], ideas: [] }
};

let dragData  = null;   // { task, colId }
let ctxTarget = null;   // { task, colId } — persists for modal use

// ── STORAGE ────────────────────────────────────────

function loadState() {
  try {
    const raw = localStorage.getItem('weektodo_v2');
    if (!raw) { seedDemo(); return; }
    const s = JSON.parse(raw);
    state.weekOffset = s.weekOffset ?? 0;
    state.dayTasks   = s.dayTasks   ?? {};
    state.listTasks  = s.listTasks  ?? {};
    LIST_IDS.forEach(id => { if (!state.listTasks[id]) state.listTasks[id] = []; });
  } catch(e) { console.error('Load error:', e); }
}

function saveState() {
  try { localStorage.setItem('weektodo_v2', JSON.stringify(state)); }
  catch(e) { console.error('Save error:', e); }
}

// ── SEED DEMO TASKS (first launch) ─────────────────

let _id = Date.now();
function uid() { return (++_id).toString(36); }

function seedDemo() {
  const dates = getWeekDates();
  const mk    = d => dateKey(d);

  // Monday
  state.dayTasks[mk(dates[1])] = [
    task('Click the dot to complete a task',      'green'),
    task('Double-click text to edit it',          'yellow'),
    task('Mouse over to see the ••• options menu','none'),
  ];
  // Tuesday
  state.dayTasks[mk(dates[2])] = [
    task('Drag and drop tasks between columns', 'blue',   '04:20 pm', '16:20'),
    task('Right-click for quick options',       'none'),
  ];
  // Wednesday
  state.dayTasks[mk(dates[3])] = [
    task('Open task options with the ••• button', 'none'),
  ];

  state.listTasks.custom = [
    task('This is a custom list',                       'none'),
    task('Click an empty row to add a new task',        'none'),
    task('Right-click or ••• to delete or set color',   'none'),
  ];
}

function task(text, color = 'none', time = null, time24 = null) {
  return { id: uid(), text, color, completed: false, time, time24 };
}

// ── DATE HELPERS ───────────────────────────────────

function getWeekDates() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay();            // 0 = Sunday
  const sun = new Date(today);
  sun.setDate(today.getDate() - dow + state.weekOffset * 7);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(sun);
    d.setDate(sun.getDate() + i);
    return d;
  });
}

function dateKey(d) { return d.toISOString().slice(0, 10); }

function fmtDate(d) {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function isToday(d) {
  const n = new Date();
  return d.getFullYear() === n.getFullYear() &&
         d.getMonth()    === n.getMonth()    &&
         d.getDate()     === n.getDate();
}

function fmtTime(h24) {
  if (!h24) return null;
  const [h, m] = h24.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function getTasks(colId) {
  if (LIST_IDS.includes(colId)) return state.listTasks[colId];
  if (!state.dayTasks[colId]) state.dayTasks[colId] = [];
  return state.dayTasks[colId];
}

// ── TOAST ──────────────────────────────────────────

const toastEl = document.getElementById('toast');
let   toastTimer;

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2000);
}

// ── CONTEXT MENU ───────────────────────────────────

const ctxMenu      = document.getElementById('ctx-menu');
const ctxColorsEl  = document.getElementById('ctx-colors');
const ctxTimeBtn   = document.getElementById('ctx-time-btn');
const ctxDeleteBtn = document.getElementById('ctx-delete-btn');

// Build colour swatches
COLORS.forEach(color => {
  const el = document.createElement('div');
  el.className     = 'ctx-dot';
  el.dataset.color = color;
  if (color === 'none') {
    el.style.background  = 'transparent';
    el.style.borderColor = '#4e5268';
    el.style.border      = '1.5px solid #4e5268';
  } else {
    el.style.background = COLOR_HEX[color];
  }
  el.addEventListener('click', () => {
    if (!ctxTarget) return;
    ctxTarget.task.color = color;
    saveState();
    render();
    hideCtx();
  });
  ctxColorsEl.appendChild(el);
});

function showCtx(e, task, colId) {
  e.preventDefault();
  e.stopPropagation();
  ctxTarget = { task, colId };

  // Highlight active colour
  Array.from(ctxColorsEl.children).forEach(d =>
    d.classList.toggle('active', d.dataset.color === task.color)
  );

  ctxMenu.style.display = 'block';
  const x = Math.min(e.clientX, window.innerWidth  - 185);
  const y = Math.min(e.clientY, window.innerHeight - 190);
  ctxMenu.style.left = x + 'px';
  ctxMenu.style.top  = y + 'px';
}

function hideCtx() {
  ctxMenu.style.display = 'none';
  ctxTarget = null;
}

ctxTimeBtn.addEventListener('click', () => {
  if (!ctxTarget) return;
  const saved   = ctxTarget;         // keep ref before hideCtx nullifies ctxTarget
  hideCtx();
  const modal   = document.getElementById('time-modal');
  modal._task   = saved.task;
  document.getElementById('time-input').value = saved.task.time24 || '';
  modal.style.display = 'flex';
});

ctxDeleteBtn.addEventListener('click', () => {
  if (!ctxTarget) return;
  const { task, colId } = ctxTarget;
  hideCtx();
  const tasks = getTasks(colId);
  const idx   = tasks.findIndex(t => t.id === task.id);
  if (idx !== -1) tasks.splice(idx, 1);
  saveState();
  render();
  toast('Task deleted');
});

document.addEventListener('click', e => {
  if (!ctxMenu.contains(e.target)) hideCtx();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    hideCtx();
    document.getElementById('time-modal').style.display = 'none';
  }
});

// ── TIME MODAL ─────────────────────────────────────

const timeModal = document.getElementById('time-modal');

document.getElementById('time-cancel').addEventListener('click', () => {
  timeModal.style.display = 'none';
  timeModal._task = null;
});

document.getElementById('time-ok').addEventListener('click', () => {
  const task = timeModal._task;
  if (!task) return;
  const val   = document.getElementById('time-input').value;
  task.time24 = val   || null;
  task.time   = val ? fmtTime(val) : null;
  saveState();
  render();
  timeModal.style.display = 'none';
  timeModal._task = null;
  toast('Time set');
});

timeModal.addEventListener('click', e => {
  if (e.target === timeModal) {
    timeModal.style.display = 'none';
    timeModal._task = null;
  }
});

// ── DRAG & DROP ────────────────────────────────────

function onDragStart(e, task, colId) {
  dragData = { task, colId };
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  dragData = null;
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function onDragOver(e) {
  if (!dragData) return;
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.classList.add('drag-over');
}

function onDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function onDropOnTask(e, targetTask, colId) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.classList.remove('drag-over');
  if (!dragData || dragData.task.id === targetTask.id) return;

  const from    = getTasks(dragData.colId);
  const to      = getTasks(colId);
  const fromIdx = from.findIndex(t => t.id === dragData.task.id);
  const toIdx   = to.findIndex(t => t.id === targetTask.id);
  if (fromIdx === -1 || toIdx === -1) return;

  if (from === to) {
    from.splice(fromIdx, 1);
    from.splice(toIdx > fromIdx ? toIdx - 1 : toIdx, 0, dragData.task);
  } else {
    from.splice(fromIdx, 1);
    to.splice(toIdx, 0, dragData.task);
  }

  saveState(); render(); toast('Task moved');
}

function onDropOnSlot(e, colId) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.classList.remove('drag-over');
  if (!dragData) return;

  const from    = getTasks(dragData.colId);
  const to      = getTasks(colId);
  const fromIdx = from.findIndex(t => t.id === dragData.task.id);
  if (fromIdx === -1) return;

  from.splice(fromIdx, 1);
  to.push(dragData.task);
  saveState(); render(); toast('Task moved');
}

// ── INLINE EDIT / ADD ──────────────────────────────

function inlineEdit(row, task, colId) {
  const dot = row.querySelector('.task-dot');
  const inp = document.createElement('input');
  inp.className   = 'task-input';
  inp.value       = task.text;
  row.innerHTML   = '';
  row.appendChild(dot);
  row.appendChild(inp);
  inp.focus(); inp.select();

  let settled = false;
  function commit() {
    if (settled) return; settled = true;
    const val = inp.value.trim();
    if (val && val !== task.text) { task.text = val; saveState(); toast('Task updated'); }
    render();
  }
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter')  commit();
    if (e.key === 'Escape') { settled = true; render(); }
  });
  inp.addEventListener('blur', commit);
}

function inlineAdd(slotRow, colId) {
  const dot = document.createElement('div');
  dot.className = 'task-dot dot-none';
  const inp = document.createElement('input');
  inp.className   = 'task-input';
  inp.placeholder = 'New task…';
  slotRow.innerHTML = '';
  slotRow.classList.remove('task-slot');
  slotRow.appendChild(dot);
  slotRow.appendChild(inp);
  inp.focus();

  let settled = false;
  function commit() {
    if (settled) return; settled = true;
    const val = inp.value.trim();
    if (val) {
      getTasks(colId).push(task(val));
      saveState(); toast('Task added');
    }
    render();
  }
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter')  commit();
    if (e.key === 'Escape') { settled = true; render(); }
  });
  inp.addEventListener('blur', commit);
}

// ── RENDER ─────────────────────────────────────────

function makeTaskRow(t, colId) {
  const row = document.createElement('div');
  row.className  = 'task-row task-item';
  row.draggable  = true;

  // Dot
  const dot = document.createElement('div');
  dot.className = `task-dot ${t.completed ? 'dot-done' : 'dot-' + (t.color || 'none')}`;
  dot.addEventListener('click', e => {
    e.stopPropagation();
    t.completed = !t.completed;
    saveState(); render();
  });

  // Text
  const txt = document.createElement('span');
  txt.className   = 'task-text' + (t.completed ? ' done' : '');
  txt.textContent = t.text;
  txt.title       = t.text;
  txt.addEventListener('dblclick', e => {
    e.stopPropagation();
    inlineEdit(row, t, colId);
  });

  row.appendChild(dot);
  row.appendChild(txt);

  // Time badge
  if (t.time) {
    const badge = document.createElement('span');
    badge.className   = 'task-time';
    badge.textContent = t.time;
    row.appendChild(badge);
  }

  // ••• button
  const acts = document.createElement('div');
  acts.className = 'task-acts';
  const btn = document.createElement('button');
  btn.className   = 'task-menu-btn';
  btn.textContent = '•••';
  btn.addEventListener('click', e => showCtx(e, t, colId));
  acts.appendChild(btn);
  row.appendChild(acts);

  // Right-click
  row.addEventListener('contextmenu', e => showCtx(e, t, colId));

  // Drag
  row.addEventListener('dragstart', e => onDragStart(e, t, colId));
  row.addEventListener('dragend',   onDragEnd);
  row.addEventListener('dragover',  onDragOver);
  row.addEventListener('dragleave', onDragLeave);
  row.addEventListener('drop',      e => onDropOnTask(e, t, colId));

  return row;
}

function makeSlotRow(colId) {
  const row = document.createElement('div');
  row.className = 'task-row task-slot';
  row.addEventListener('click',     () => inlineAdd(row, colId));
  row.addEventListener('dragover',  onDragOver);
  row.addEventListener('dragleave', onDragLeave);
  row.addEventListener('drop',      e => onDropOnSlot(e, colId));
  return row;
}

function fillBody(body, tasks, colId) {
  tasks.forEach(t => body.appendChild(makeTaskRow(t, colId)));
  const extra = Math.max(SLOTS - tasks.length, 2);
  for (let i = 0; i < extra + 2; i++) body.appendChild(makeSlotRow(colId));
}

function renderWeek() {
  const wrap  = document.getElementById('day-columns');
  wrap.innerHTML = '';
  const dates = getWeekDates();

  dates.forEach((date, i) => {
    const key   = dateKey(date);
    const tasks = getTasks(key);

    const col = document.createElement('div');
    col.className = 'day-col';

    const hdr = document.createElement('div');
    hdr.className = 'day-header';
    hdr.innerHTML = `
      <div class="day-name ${isToday(date) ? 'today' : ''}">${DAY_NAMES[i]}</div>
      <div class="day-date">${fmtDate(date)}</div>
    `;

    const body = document.createElement('div');
    body.className = 'col-body';
    fillBody(body, tasks, key);

    col.appendChild(hdr);
    col.appendChild(body);
    wrap.appendChild(col);
  });
}

function renderLists() {
  const wrap = document.getElementById('custom-lists');
  wrap.innerHTML = '';

  LIST_IDS.forEach(id => {
    const tasks = getTasks(id);

    const col = document.createElement('div');
    col.className = 'custom-col';

    const hdr = document.createElement('div');
    hdr.className = 'list-header';
    hdr.innerHTML = `<div class="list-name">${LIST_NAMES[id]}</div>`;

    const body = document.createElement('div');
    body.className = 'col-body';
    fillBody(body, tasks, id);

    col.appendChild(hdr);
    col.appendChild(body);
    wrap.appendChild(col);
  });
}

function render() {
  renderWeek();
  renderLists();
}

// ── NAVIGATION ─────────────────────────────────────

document.getElementById('prev-btn').addEventListener('click', () => {
  state.weekOffset--; saveState(); render();
});
document.getElementById('next-btn').addEventListener('click', () => {
  state.weekOffset++; saveState(); render();
});

// ── INIT ───────────────────────────────────────────

loadState();
render();
