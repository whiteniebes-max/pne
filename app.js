// =====================================================
//              ESTADO GLOBAL
// =====================================================

let data = {};
let completed = new Set(JSON.parse(localStorage.getItem("completedCourses") || "[]"));
let userPlan = JSON.parse(localStorage.getItem("userPlan") || "null");

// =====================================================
//              CARGA INICIAL
// =====================================================

async function load() {
  data = await fetch("curricula.json").then(r => r.json());

  userPlan = JSON.parse(localStorage.getItem("userPlan") || "null");

  if (!userPlan) {
    userPlan = initializeUserPlan();
    preloadCompleted();
    localStorage.setItem("userPlan", JSON.stringify(userPlan));
  } else {
    if (userPlan["Semestre 0 — ✅ Cursadas"]) delete userPlan["Semestre 0 — ✅ Cursadas"];
    if (userPlan["Semestre 0"]) delete userPlan["Semestre 0"];

    const base = initializeUserPlan();
    for (let s in base) if (!userPlan[s]) userPlan[s] = base[s];
    localStorage.setItem("userPlan", JSON.stringify(userPlan));
  }

  document.getElementById("viewMode").onchange = render;
  const cf = document.getElementById("catalogFilter");
  if (cf) cf.onchange = render;

  render();
}

// =====================================================
//              PLAN PERSONAL
// =====================================================

function initializeUserPlan() {
  return {
    "Semestre 1": [],
    "Semestre 2": [],
    "Semestre 3": [],
    "Semestre 4": [],
    "Semestre 5": [],
    "Semestre 6": [],
    "Semestre 7": [],
    "Semestre 8": []
  };
}

function preloadCompleted() {
  let cursadas = [
    "026745","027413",
    "001449","032683","033518","033698","033514",
    "015962","001299","001290","033699","033515",
    "001432","030890","004196","033700","033704",
    "001505"
  ];
  cursadas.forEach(code => completed.add(code));
  localStorage.setItem("completedCourses", JSON.stringify([...completed]));
}

// =====================================================
//              RENDER
// =====================================================

function render() {
  const mode = document.getElementById("viewMode").value;

  const app = document.getElementById("app");
  const miPlan = document.getElementById("mi-plan");
  const cat = document.getElementById("catalog");
  const cFilters = document.getElementById("catalog-filters");
  const cCourses = document.getElementById("catalog-courses");

  app.innerHTML = "";
  if (cCourses) cCourses.innerHTML = "";

  if (cat) cat.style.display = "none";
  if (cFilters) cFilters.style.display = "none";
  if (miPlan) miPlan.style.display = "none";
  app.style.display = "grid";

  // 🌸 MODO MI PLAN
  if (mode === "miplan") {
    if (miPlan) miPlan.style.display = "flex";
    if (cat) cat.style.display = "flex";
    if (cFilters) cFilters.style.display = "block";

    renderCatalog();
    displaySemesters(userPlan, true);

    const btn = document.createElement("button");
    btn.textContent = "➕ Agregar semestre";
    btn.onclick = addSemester;
    app.appendChild(btn);
    return;
  }

  // 💡 MODO BIOINGENIERÍA
  if (mode === "bioingenieria" && data.bioingenieria) {
    displaySemesters(data.bioingenieria, false);
    return;
  }

  // 💡 MODO CIENCIA DE DATOS
  if (mode === "cienciadatos" && data.cienciadatos) {
    displaySemesters(data.cienciadatos, false);
    return;
  }
}

// =====================================================
//              CATÁLOGO
// =====================================================

function renderCatalog() {
  const container = document.getElementById("catalog-courses");
  if (!container) return;
  container.innerHTML = "";

  const filter = document.getElementById("catalogFilter")?.value || "all";
  let all = getAllCourses();

  all = all.filter(c => {
    if (filter === "available") return !completed.has(c.code) && canTake(c);
    if (filter === "completed") return completed.has(c.code);
    if (filter === "locked") return !completed.has(c.code) && !canTake(c);
    return true;
  });

  all.forEach(c => {
    const el = renderCourse(c, null, true);
    el.ondragstart = e => dragStart(e, c.code, null);
    container.appendChild(el);
  });
}

// =====================================================
//              UTIL
// =====================================================

function getAllCourses() {
  let list = [];
  for (let sem in data.bioingenieria) list.push(...data.bioingenieria[sem]);
  for (let sem in data.cienciadatos) list.push(...data.cienciadatos[sem]);
  return list;
}

// =====================================================
//              SEMESTRES
// =====================================================

function displaySemesters(obj, editable) {
  const app = document.getElementById("app");

  for (let sem in obj) {
    const box = document.createElement("div");
    box.className = "semester";
    box.dataset.sem = sem;
    box.ondragover = e => dragOver(e);
    box.ondrop = e => drop(e);

    // 🗑️ botón para eliminar semestre (solo en Mi Plan)
    let title = document.createElement("h2");
    title.textContent = sem;
    if (editable) {
      const delBtn = document.createElement("button");
      delBtn.textContent = "🗑️";
      delBtn.style.marginLeft = "8px";
      delBtn.style.cursor = "pointer";
      delBtn.onclick = () => removeSemester(sem);
      title.appendChild(delBtn);
    }
    box.appendChild(title);

    obj[sem].forEach(course => {
      const el = renderCourse(course, sem, editable);
      box.appendChild(el);
    });

    app.appendChild(box);
  }
}

function renderCourse(c, sem, editable) {
  const el = document.createElement("div");
  el.className = "course";

  if (completed.has(c.code)) el.classList.add("completed");
  else if (canTake(c)) el.classList.add("available");
  else el.classList.add("locked");

  el.textContent = `${c.code} — ${c.name}`;

  // 🗑️ botón de eliminar asignatura
  if (editable) {
    el.draggable = true;
    el.ondragstart = e => dragStart(e, c.code, sem);

    const delBtn = document.createElement("button");
    delBtn.textContent = "✖";
    delBtn.style.float = "right";
    delBtn.style.background = "transparent";
    delBtn.style.border = "none";
    delBtn.style.cursor = "pointer";
    delBtn.style.color = "#a53b68";
    delBtn.onclick = e => {
      e.stopPropagation();
      removeCourse(c.code, sem);
    };
    el.appendChild(delBtn);
  }

  el.onclick = () => toggleCompleted(c.code);

  return el;
}

// =====================================================
//              ELIMINAR SEMESTRE / ASIGNATURA
// =====================================================

function removeSemester(sem) {
  if (!confirm(`¿Eliminar ${sem}?`)) return;
  delete userPlan[sem];
  localStorage.setItem("userPlan", JSON.stringify(userPlan));
  render();
}

function removeCourse(code, sem) {
  if (!sem || !userPlan[sem]) return;
  userPlan[sem] = userPlan[sem].filter(c => c.code !== code);
  localStorage.setItem("userPlan", JSON.stringify(userPlan));
  render();
}

// =====================================================
//              DRAG & DROP
// =====================================================

let dragData = null;

function dragStart(e, code, sem) {
  dragData = { code, sem };
}

function dragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add("dragover");
}

function drop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove("dragover");

  const toSem = e.currentTarget.dataset.sem;
  moveCourse(dragData.code, dragData.sem, toSem);
}

function moveCourse(code, fromSem, toSem) {
  if (!userPlan[toSem]) return;
  const c = findCourse(code);
  if (!c) return;

  if (fromSem && userPlan[fromSem]) {
    userPlan[fromSem] = userPlan[fromSem].filter(x => x.code !== code);
  }
  userPlan[toSem].push(c);
  localStorage.setItem("userPlan", JSON.stringify(userPlan));
  render();
}

// =====================================================
//              LÓGICA
// =====================================================

function canTake(course) {
  if (!course.prereq || course.prereq.length === 0) return true;
  return course.prereq.every(p => completed.has(p));
}

function toggleCompleted(code) {
  if (completed.has(code)) completed.delete(code);
  else completed.add(code);
  localStorage.setItem("completedCourses", JSON.stringify([...completed]));
  render();
}

function findCourse(code) {
  for (let sem in data.bioingenieria) {
    const c = data.bioingenieria[sem].find(x => x.code === code);
    if (c) return c;
  }
  for (let sem in data.cienciadatos) {
    const c = data.cienciadatos[sem].find(x => x.code === code);
    if (c) return c;
  }
  return null;
}

// =====================================================
//              NUEVO SEMESTRE
// =====================================================

function addSemester() {
  const n = Object.keys(userPlan).length + 1;
  userPlan[`Semestre ${n}`] = [];
  localStorage.setItem("userPlan", JSON.stringify(userPlan));
  render();
}

// START
load();
