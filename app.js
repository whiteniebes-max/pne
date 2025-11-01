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
  try {
    const response = await fetch("curricula.json");
    data = await response.json();
  } catch (err) {
    console.error("❌ Error al cargar curricula.json:", err);
    alert("Error al cargar curricula.json. Verifica que esté en la misma carpeta que index.html");
    return;
  }

  // cargar plan guardado (si existe)
  userPlan = JSON.parse(localStorage.getItem("userPlan") || "null");

  if (!userPlan) {
    userPlan = initializeUserPlan();
    preloadCompleted();
    localStorage.setItem("userPlan", JSON.stringify(userPlan));
  }

  document.getElementById("viewMode").onchange = render;
  const cf = document.getElementById("catalogFilter");
  if (cf) cf.onchange = render;
  const searchInput = document.getElementById("catalogSearch");
  if (searchInput) searchInput.addEventListener("input", () => renderCatalog());

  render();
}

// =====================================================
//              PLAN PERSONAL
// =====================================================

function initializeUserPlan() {
  return {
    "Semestre I": [],
    "Semestre II": [],
    "Semestre III": [],
    "Semestre IV": [],
    "Semestre V": [],
    "Semestre VI": [],
    "Semestre VII": [],
    "Semestre VIII": []
  };
}

function preloadCompleted() {
  const cursadas = [
    "026745", "027413",
    "001449", "032683", "033518", "033698", "033514",
    "015962", "001299", "001290", "033699", "033515",
    "001432", "030890", "004196", "033700", "033704",
    "001505"
  ];
  cursadas.forEach(code => completed.add(code));
  localStorage.setItem("completedCourses", JSON.stringify([...completed]));
}

// =====================================================
//              RENDER PRINCIPAL
// =====================================================

function render() {
  const mode = document.getElementById("viewMode").value;
  const app = document.getElementById("app");
  const appPlan = document.getElementById("app-plan");
  const miPlan = document.getElementById("mi-plan");
  const cat = document.getElementById("catalog");
  const cFilters = document.getElementById("catalog-filters");
  const cCourses = document.getElementById("catalog-courses");

  // limpiar todo antes de renderizar
  app.innerHTML = "";
  appPlan.innerHTML = "";
  cCourses.innerHTML = "";

  // ===========================
  // 🩷 MODO MI PLAN
  // ===========================
  if (mode === "miplan") {
    miPlan.style.display = "flex";
    app.style.display = "none";
    cat.classList.add("visible");
    cFilters.style.display = "block";

    renderCatalog();
    displaySemesters(userPlan, true, appPlan);

    const btn = document.createElement("button");
    btn.textContent = "➕ Agregar semestre";
    btn.onclick = addSemester;
    appPlan.appendChild(btn);

    return;
  }

  // ===========================
  // 💡 OTROS MODOS
  // ===========================
  miPlan.style.display = "none";
  app.style.display = "grid";
  cat.classList.remove("visible");
  cFilters.style.display = "none";

  if (mode === "bioingenieria" && data.bioingenieria) {
    displaySemesters(data.bioingenieria, false, app);
    return;
  }

  if (mode === "cienciadatos" && data.cienciadatos) {
    displaySemesters(data.cienciadatos, false, app);
    return;
  }

  console.warn("⚠️ No se encontraron datos para el modo seleccionado:", mode);
}

// =====================================================
//              CATÁLOGO
// =====================================================

function renderCatalog() {
  const container = document.getElementById("catalog-courses");
  const search = document.getElementById("catalogSearch")?.value.toLowerCase() || "";
  const filter = document.getElementById("catalogFilter").value;

  container.innerHTML = "";

  const all = getAllCourses();

  const filtered = all.filter(c => {
    const matchesSearch =
      c.name.toLowerCase().includes(search) || c.code.toLowerCase().includes(search);

    if (filter === "available") return matchesSearch && !completed.has(c.code) && canTake(c);
    if (filter === "completed") return matchesSearch && completed.has(c.code);
    if (filter === "locked") return matchesSearch && !completed.has(c.code) && !canTake(c);

    return matchesSearch;
  });

  filtered.forEach(c => {
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
  if (data.bioingenieria) {
    for (let sem in data.bioingenieria) list.push(...data.bioingenieria[sem]);
  }
  if (data.cienciadatos) {
    for (let sem in data.cienciadatos) list.push(...data.cienciadatos[sem]);
  }
  return list;
}

// =====================================================
//              SEMESTRES
// =====================================================

function displaySemesters(obj, editable, container) {
  const target = container || document.getElementById("app");

  for (let sem in obj) {
    const box = document.createElement("div");
    box.className = "semester";
    box.dataset.sem = sem;
    box.ondragover = dragOver;
    box.ondrop = drop;
    box.innerHTML = `<h2>${sem}</h2>`;

    const courses = obj[sem];
    if (!Array.isArray(courses)) continue;

    courses.forEach(course => {
      const el = renderCourse(course, sem, editable);
      box.appendChild(el);
    });

    target.appendChild(box);
  }
}

function renderCourse(c, sem, editable) {
  const el = document.createElement("div");
  el.className = "course";

  if (completed.has(c.code)) el.classList.add("completed");
  else if (canTake(c)) el.classList.add("available");
  else el.classList.add("locked");

  el.textContent = `${c.code} — ${c.name}`;

  if (editable) {
    el.draggable = true;
    el.ondragstart = e => dragStart(e, c.code, sem);
  }

  el.onclick = () => toggleCompleted(c.code);
  return el;
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
  if (!userPlan[toSem]) userPlan[toSem] = [];

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
  let n = Object.keys(userPlan).length + 1;
  userPlan[`Semestre ${n}`] = [];
  localStorage.setItem("userPlan", JSON.stringify(userPlan));
  render();
}

// START
load();
