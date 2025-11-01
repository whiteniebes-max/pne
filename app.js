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

  // cargar plan guardado (si existe)
  userPlan = JSON.parse(localStorage.getItem("userPlan") || "null");

  // si no hay uno guardado → crear
  if (!userPlan) {
    userPlan = initializeUserPlan();
    preloadCompleted();
    localStorage.setItem("userPlan", JSON.stringify(userPlan));
  } else {
    // ✅ Si existe Semestre 0, eliminar
    if (userPlan["Semestre 0 — ✅ Cursadas"]) {
      delete userPlan["Semestre 0 — ✅ Cursadas"];
    }
    if (userPlan["Semestre 0"]) {
      delete userPlan["Semestre 0"];
    }

    // asegurar estructura mínima
    const base = initializeUserPlan();
    for (let s in base) {
      if (!userPlan[s]) userPlan[s] = base[s];
    }

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


/* Solo marca cursadas, NO las pone en Semestre */
function preloadCompleted() {
  let cursadas = [
    // BioIng
    "026745","027413",

    // CD S1
    "001449","032683","033518","033698","033514",

    // CD S2
    "015962","001299","001290","033699","033515",

    // CD S3
    "001432","030890","004196","033700","033704",

    // CD — Constitución
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

  let app = document.getElementById("app");
  let cat = document.getElementById("catalog");
  let cFilters = document.getElementById("catalog-filters");
  let cCourses = document.getElementById("catalog-courses");

  app.innerHTML = "";
  cCourses.innerHTML = "";

  // ✅ Mi plan
  if (mode === "miplan") {
    cat.classList.add("visible");
    cFilters.style.display = "block";

    renderCatalog();
    displaySemesters(userPlan, true);

    let btn = document.createElement("button");
    btn.textContent = "➕ Agregar semestre";
    btn.onclick = () => addSemester();
    app.appendChild(btn);

    return;
  }

  // ✅ Ocultar catálogo para los pensums
  cat.classList.remove("visible");
  cFilters.style.display = "none";

  if (mode === "bioingenieria") {
    displaySemesters(data.bioingenieria, false);
    return;
  }

  if (mode === "cienciadatos") {
    displaySemesters(data.cienciadatos, false);
    return;
  }
}



// =====================================================
//              CATÁLOGO
// =====================================================

function renderCatalog() {
  const container = document.getElementById("catalog-courses");
  container.innerHTML = "";

  let filter = document.getElementById("catalogFilter").value;
  let all = getAllCourses();

  all = all.filter(c => {
    if (filter === "available") return !completed.has(c.code) && canTake(c);
    if (filter === "completed") return completed.has(c.code);
    if (filter === "locked") return !completed.has(c.code) && !canTake(c);
    return true;
  });

  all.forEach(c => {
    let el = renderCourse(c, null, true);
    el.ondragstart = e => dragStart(e, c.code, null);
    container.appendChild(el);
  });
}



// =====================================================
//              UTIL
// =====================================================

function getAllCourses() {
  let list = [];

  for (let sem in data.bioingenieria) {
    list.push(...data.bioingenieria[sem]);
  }
  for (let sem in data.cienciadatos) {
    list.push(...data.cienciadatos[sem]);
  }
  return list;
}



// =====================================================
//              SEMESTRES
// =====================================================

function displaySemesters(obj, editable) {
  let app = document.getElementById("app");

  for (let sem in obj) {
    const box = document.createElement("div");
    box.className = "semester";
    box.dataset.sem = sem;
    box.ondragover = e => dragOver(e);
    box.ondrop = e => drop(e);

    box.innerHTML = `<h2>${sem}</h2>`;

    obj[sem].forEach(course => {
      let el = renderCourse(course, sem, editable);
      box.appendChild(el);
    });

    app.appendChild(box);
  }
}


function renderCourse(c, sem, editable) {
  let el = document.createElement("div");
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

  let toSem = e.currentTarget.dataset.sem;
  moveCourse(dragData.code, dragData.sem, toSem);
}

function moveCourse(code, fromSem, toSem) {
  if (!userPlan[toSem]) return;

  let c = findCourse(code);
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
    let c = data.bioingenieria[sem].find(x => x.code === code);
    if (c) return c;
  }
  for (let sem in data.cienciadatos) {
    let c = data.cienciadatos[sem].find(x => x.code === code);
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
