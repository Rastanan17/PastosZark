
const $ = (selector) => document.querySelector(selector);

const money = (amount) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(Number(amount) || 0);

const CYCLE_DAYS = 17;
const HELPER_RATE = 3000;

const initialClients = [
  { id: 1, name: "Micaela", address: "Vitto Dumas 427", zone: "Santa Elena", fee: 35000, next: "2026-10-19", originalDate: "2026-10-18", scheduledDate: "2026-10-19" },
  { id: 2, name: "Yanina", address: "Nápoles 921", zone: "Santa Clara", fee: 25000, next: "2026-10-22" },
  { id: 3, name: "Pablo", address: "Bolívar 579", zone: "Camet Norte", fee: 55000, next: "2026-10-28" },
  { id: 4, name: "Gustavo", address: "M. Belgrano 572", zone: "Camet Norte", fee: 45000, next: "2026-10-28" },
  { id: 5, name: "Javier 1", address: "Av. A.C.A. 1228", zone: "Atlántida", fee: 35000, next: "2026-10-29" },
  { id: 6, name: "Javier 2", address: "Cannes 995", zone: "Santa Clara", fee: 25000, next: "2026-10-29" },
  { id: 7, name: "Juan", address: "Viña del Mar 1088", zone: "Santa Clara", fee: 25000, next: "2026-10-30" },
  { id: 8, name: "Juan Pablo", address: "Hernán Cortez 346", zone: "Santa Elena", fee: 55000, next: "2026-11-02" },
  { id: 9, name: "Silvana", address: "Sáenz Peña 196", zone: "Camet Norte", fee: 45000, next: "2026-11-03" },
  { id: 10, name: "Lucía", address: "Mitre 641", zone: "Camet Norte", fee: 55000, next: "2026-11-03" },
  { id: 11, name: "Lucas", address: "La Gallareta 304", zone: "Playa Dorada", fee: 55000, next: null },
  { id: 12, name: "Mónica", address: "La Habana 570", zone: "Santa Clara", fee: 25000, next: null }
];

const initialTasks = [
  {
    id: 1,
    client: "Mónica",
    title: "Corregir corte mal realizado",
    detail: "Coordinar visita para la semana del 19 al 25 de octubre. Registrar el inicio real de la mensualidad.",
    status: "coordinar",
    startsCycle: true
  },
  {
    id: 2,
    client: "Lucas",
    title: "Coordinar visita pendiente",
    detail: "La Gallareta 304, Playa Dorada. Confirmar día y horario.",
    status: "coordinar",
    startsCycle: true
  },
  {
    id: 3,
    client: "Silvia",
    title: "Nuevo servicio",
    detail: "Pidió visita aproximadamente dentro de dos semanas. Falta confirmar día, dirección y precio.",
    status: "coordinar"
  },
  {
    id: 4,
    client: "Lili",
    title: "Nuevo servicio",
    detail: "Pidió visita aproximadamente dentro de dos semanas. Falta confirmar día, dirección y precio.",
    status: "coordinar"
  },
  {
    id: 5,
    client: "Lucía",
    title: "Terminar la otra mitad del terreno",
    detail: "Trabajo puntual de $35.000. Pagó $20.000. Falta cobrar $15.000.",
    status: "incompleto",
    balance: 15000,
    jobTotal: 35000,
    paidAmount: 20000,
    startsCycle: false
  }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function load(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : clone(fallback);
  } catch {
    return clone(fallback);
  }
}

let clients = load("zark_clients", initialClients);
let tasks = load("zark_tasks", initialTasks);
let currentPage = "inicio";
let searchText = "";

function saveData() {
  localStorage.setItem("zark_clients", JSON.stringify(clients));
  localStorage.setItem("zark_tasks", JSON.stringify(tasks));
}

function todayISO() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
}

function parseISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function addDays(dateString, days) {
  const date = parseISODate(dateString);
  if (!date) return null;

  date.setDate(date.getDate() + days);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function dateLabel(value) {
  const date = parseISODate(value);
  if (!date) return "Sin fecha";

  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function findClientByName(name) {
  return clients.find(client =>
    client.name.trim().toLowerCase() ===
    String(name).trim().toLowerCase()
  );
}

// Calcula el siguiente corte desde la fecha REAL de finalización.
function completeCut(client, actualDate) {
  if (!client || !parseISODate(actualDate)) return false;

  client.lastCompletedDate = actualDate;

  // Los clientes antiguos se consideran de mantenimiento periódico.
  // Los nuevos sin mensualidad no entran en un ciclo automático.
  if (client.monthlyService === false) {
    client.scheduledDate = null;
    client.next = null;
  } else {
    client.scheduledDate = addDays(actualDate, CYCLE_DAYS);
    client.next = client.scheduledDate;
  }

  return true;
}

// Corrige los registros antiguos sin borrar los datos guardados.
function migrateData() {
  clients.forEach(client => {
    if (client.scheduledDate === undefined) {
      client.scheduledDate = client.next || null;
    }

    if (client.lastCompletedDate === undefined) {
      client.lastCompletedDate = null;
    }
  });

  const micaela = clients.find(client => client.id === 1);

  // Corregir la fecha antigua de Micaela una sola vez.
  if (micaela && !localStorage.getItem("zark_micaela_date_fixed")) {
    if (micaela.next === "2026-11-04" || !micaela.next) {
      micaela.originalDate = "2026-10-18";
      micaela.scheduledDate = "2026-10-19";
      micaela.next = "2026-10-19";
    }

    localStorage.setItem("zark_micaela_date_fixed", "1");
  }

  tasks.forEach(task => {
    if (task.client === "Lucía" && task.title.includes("otra mitad")) {
      task.balance ??= 15000;
      task.jobTotal ??= 35000;
      task.paidAmount ??= 20000;
      task.startsCycle = false;
    }

    if (
      ["Mónica", "Lucas"].includes(task.client) &&
      task.status !== "terminado"
    ) {
      task.startsCycle ??= true;
    }
  });

  saveData();
}

function render() {
  document.querySelectorAll(".nav-button").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === currentPage
    );
  });

  const content = $("#appContent");
  if (!content) return;

  if (currentPage === "inicio") content.innerHTML = renderHome();
  if (currentPage === "agenda") content.innerHTML = renderAgenda();
  if (currentPage === "clientes") content.innerHTML = renderClients();
  if (currentPage === "pendientes") content.innerHTML = renderTasks();
  if (currentPage === "nuevo") content.innerHTML = renderNewClient();

  bindPageEvents();
}

function renderHome() {
  const monthlyTotal = clients.reduce(
    (sum, client) => sum + (client.monthlyService === false ? 0 : client.fee || 0),
    0
  );

  const pendingBalance = tasks.reduce(
    (sum, task) => sum + (task.balance || 0),
    0
  );

  const activeTasks = tasks.filter(task =>
    task.status !== "terminado" || (task.balance || 0) > 0
  );

  const incomplete = activeTasks.filter(
    task => task.status === "incompleto"
  ).length;

  const upcoming = clients
    .filter(client => client.next)
    .sort((a, b) => a.next.localeCompare(b.next))
    .slice(0, 4);

  return `
    <section class="welcome">
      <p class="eyebrow">PANEL GENERAL</p>
      <h2>Tu trabajo, bajo control.</h2>
      <p>Clientes, visitas y cuentas en un solo lugar.</p>
    </section>

    <section class="stats-grid">
      <article class="stat-card">
        <span>Clientes</span>
        <strong>${clients.length}</strong>
        <small>Registrados</small>
      </article>

      <article class="stat-card">
        <span>Mensualidades</span>
        <strong>${money(monthlyTotal)}</strong>
        <small>Importe mensual previsto</small>
      </article>

      <article class="stat-card warning">
        <span>Por cobrar</span>
        <strong>${money(pendingBalance)}</strong>
        <small>Deuda registrada</small>
      </article>

      <article class="stat-card">
        <span>Pendientes</span>
        <strong>${activeTasks.length}</strong>
        <small>${incomplete} trabajo(s) incompleto(s)</small>
      </article>
    </section>

    <section class="section">
      <div class="section-heading">
        <h3>Atención necesaria</h3>
        <button class="text-button" data-go="pendientes">Ver todo</button>
      </div>
      ${activeTasks.slice(0, 3).map(taskCard).join("") ||
        '<p class="empty">No hay pendientes.</p>'}
    </section>

    <section class="section">
      <div class="section-heading">
        <h3>Próximos cortes</h3>
        <button class="text-button" data-go="agenda">Ver agenda</button>
      </div>

      ${upcoming.map(client => `
        <article class="list-card">
          <div class="avatar">🌿</div>
          <div class="list-main">
            <strong>${escapeHTML(client.name)}</strong>
            <p>${escapeHTML(client.zone)} · ${escapeHTML(client.address)}</p>
          </div>
          <div class="list-side">
            <strong>${dateLabel(client.next)}</strong>
            <small>${money(client.fee)}/mes</small>
          </div>
        </article>
      `).join("") || '<p class="empty">No hay cortes programados.</p>'}
    </section>
  `;
}

function renderAgenda() {
  const clientEvents = clients
    .filter(client => client.next)
    .map(client => ({
      date: client.next,
      type: "corte",
      client
    }));

  const taskEvents = tasks
    .filter(task => task.status === "programado" && task.date)
    .map(task => ({
      date: task.date,
      type: "tarea",
      task
    }));

  const events = [...clientEvents, ...taskEvents]
    .sort((a, b) => a.date.localeCompare(b.date));

  return `
    <section class="page-heading">
      <p class="eyebrow">ORGANIZACIÓN</p>
      <h2>Agenda de cortes</h2>
      <p>Fechas previstas y visitas especiales coordinadas.</p>
    </section>

    <div class="notice">
      <strong>Ciclo de mantenimiento</strong>
      <p>Al terminar un corte, el próximo se calcula 17 días después de la fecha real de finalización.</p>
      <p>Los recordatorios automáticos de Android todavía no están implementados.</p>
    </div>

    <section class="section">
      ${events.map(event => {
        if (event.type === "corte") {
          const client = event.client;
          const date = parseISODate(event.date);

          return `
            <article class="list-card">
              <div class="date-tile">
                <strong>${date.getDate()}</strong>
                <small>${date.toLocaleDateString("es-AR", { month: "short" })}</small>
              </div>

              <div class="list-main">
                <strong>${escapeHTML(client.name)}</strong>
                <p>${escapeHTML(client.zone)} · ${escapeHTML(client.address)}</p>
                <small>Mensualidad: ${money(client.fee)}</small>
              </div>

              <button class="small-button" data-complete-cut="${client.id}">
                Corte realizado
              </button>
            </article>
          `;
        }

        const task = event.task;
        const date = parseISODate(event.date);

        return `
          <article class="list-card">
            <div class="date-tile">
              <strong>${date.getDate()}</strong>
              <small>${date.toLocaleDateString("es-AR", { month: "short" })}</small>
            </div>

            <div class="list-main">
              <strong>${escapeHTML(task.client)}</strong>
              <p>${escapeHTML(task.title)}</p>
              <small>Visita especial</small>
            </div>

            <button class="small-button" data-finish="${task.id}">
              Finalizar visita
            </button>
          </article>
        `;
      }).join("") || '<p class="empty">Todavía no hay visitas programadas.</p>'}
    </section>
  `;
}

function renderClients() {
  const filtered = clients.filter(client =>
    `${client.name} ${client.address} ${client.zone}`
      .toLowerCase()
      .includes(searchText.toLowerCase())
  );

  return `
    <section class="page-heading">
      <p class="eyebrow">CARTERA</p>
      <h2>Clientes</h2>
      <p>Mensualidades y datos de cada terreno.</p>
      <button class="primary-button" data-go="nuevo">＋ Agregar cliente</button>
    </section>

    <input id="clientSearch" class="search" type="search"
      placeholder="Buscar por nombre, dirección o zona..."
      value="${escapeHTML(searchText)}">

    <section class="section" id="clientList">
      ${filtered.map(client => `
        <article class="client-card">
          <div class="client-top">
            <div class="avatar">🌱</div>
            <div class="list-main">
              <strong>${escapeHTML(client.name)}</strong>
              <p>${escapeHTML(client.zone)}</p>
            </div>
            <strong class="fee">
              ${money(client.fee)}
              <small>/mes</small>
            </strong>
          </div>

          <p class="address">⌖ ${escapeHTML(client.address)}</p>
          <p class="address">
            📐 ${client.areaM2 ? `${client.areaM2} m²` : "Superficie sin registrar"}
            · Primer corte: ${money(client.firstCutPrice || 0)}
          </p>

          <div class="client-bottom">
            <span>Próximo corte: ${dateLabel(client.next)}</span>
            <button class="small-button" data-client="${client.id}">Ver ficha</button>
          </div>
        </article>
      `).join("") || '<p class="empty">No se encontraron clientes.</p>'}
    </section>
  `;
}

function renderNewClient() {
  return `
    <section class="page-heading">
      <p class="eyebrow">NUEVO SERVICIO</p>
      <h2>Agregar cliente</h2>
      <p>Registrá el terreno, calculá el presupuesto y programá la visita.</p>
    </section>

    <form id="newClientForm" class="client-form">
      <h3>Datos del cliente</h3>

      <label class="field">
        Nombre y apellido *
        <input name="name" required maxlength="100" placeholder="Ej. María González">
      </label>

      <label class="field">
        Teléfono
        <input name="phone" type="tel" placeholder="Número de contacto">
      </label>

      <label class="field">
        Domicilio del terreno *
        <input name="address" required placeholder="Calle y número">
      </label>

      <label class="field">
        Zona o localidad *
        <input name="zone" required placeholder="Santa Clara, Camet Norte...">
      </label>

      <label class="field">
        Referencias para llegar
        <input name="references" placeholder="Portón, esquina, acceso...">
      </label>

      <hr>
      <h3>Características del terreno</h3>

      <label class="field">
        Superficie aproximada en m² *
        <input id="areaM2" name="areaM2" type="number" min="1" step="1" required placeholder="Ej. 180">
      </label>

      <label class="field">
        Estado del terreno
        <select name="grassCondition">
          <option value="normal">Pasto normal</option>
          <option value="alto">Pasto alto</option>
          <option value="muy alto">Pasto muy alto o maleza abundante</option>
          <option value="abandonado">Terreno abandonado</option>
        </select>
      </label>

      <label class="field">
        Obstáculos, escombros u observaciones
        <textarea name="notes" rows="3" placeholder="Árboles, piedras, basura, desniveles..."></textarea>
      </label>

      <div id="priceSuggestion" class="notice">
        Ingresá la superficie para calcular los precios orientativos.
      </div>

      <hr>
      <h3>Presupuesto</h3>

      <label class="field">
        Precio del primer corte ($) *
        <input id="firstCutPrice" name="firstCutPrice" type="number" min="0" step="500" required placeholder="Precio del primer corte">
      </label>

      <label class="check-field">
        <input id="monthlyService" name="monthlyService" type="checkbox">
        <span>Contrata mantenimiento mensual (2 cortes por mes)</span>
      </label>

      <label class="field">
        Mensualidad ($)
        <input id="monthlyFee" name="monthlyFee" type="number" min="0" step="500" disabled placeholder="Activá el mantenimiento para editar">
      </label>

      <p class="form-help">
        Los precios sugeridos son orientativos. Podés ajustarlos según
        la altura del pasto, los obstáculos y el trabajo necesario.
      </p>

      <hr>
      <h3>Fechas</h3>

      <label class="field">
        Fecha del primer corte
        <input name="firstCutDate" type="date">
      </label>

      <label class="field">
        Inicio acordado de la mensualidad
        <input name="monthlyStartDate" type="date">
      </label>

      <button class="primary-button" type="submit">Guardar cliente</button>
    </form>
  `;
}

function renderTasks() {
  const activeTasks = tasks.filter(task =>
    task.status !== "terminado" || (task.balance || 0) > 0
  );

  return `
    <section class="page-heading">
      <p class="eyebrow">NO DEJAR COLGADO</p>
      <h2>Pendientes</h2>
      <p>Trabajos incompletos, visitas por coordinar y saldos por cobrar.</p>
    </section>

    <section class="section">
      ${activeTasks.map(taskCard).join("") ||
        '<p class="empty">No hay tareas pendientes.</p>'}
    </section>

    <section class="section helper-card">
      <div class="helper-icon">🧤</div>
      <div>
        <h3>Joaquín · Rastrillado</h3>
        <p>Tarifa acordada: ${money(HELPER_RATE)} por hora.</p>
        <button class="primary-button" id="helperButton">Registrar jornada</button>
      </div>
    </section>
  `;
}

function taskCard(task) {
  const incomplete = task.status === "incompleto";
  const scheduled = task.status === "programado";
  const paymentPending = task.status === "terminado" && (task.balance || 0) > 0;

  let statusLabel = "Por coordinar";
  if (incomplete) statusLabel = "Trabajo incompleto";
  else if (scheduled) statusLabel = `Programado: ${dateLabel(task.date)}`;
  else if (paymentPending) statusLabel = "Trabajo terminado · Cobro pendiente";

  return `
    <article class="task-card">
      <div class="task-top">
        <span class="status ${incomplete || paymentPending ? "red" : "amber"}">
          ${statusLabel}
        </span>
        ${task.balance > 0 ? `<strong class="debt">${money(task.balance)}</strong>` : ""}
      </div>

      <h3>${escapeHTML(task.title)}</h3>
      <p class="task-client">${escapeHTML(task.client)}</p>
      <p>${escapeHTML(task.detail)}</p>

      ${incomplete
        ? `<button class="small-button" data-finish="${task.id}">Registrar trabajo terminado</button>`
        : paymentPending
          ? `<button class="small-button" data-payment="${task.id}">Registrar cobro</button>`
          : task.status !== "terminado"
            ? `<button class="small-button" data-schedule="${task.id}">${scheduled ? "Cambiar fecha" : "Registrar fecha"}</button>`
            : ""}
    </article>
  `;
}

function bindNewClientForm() {
  const form = $("#newClientForm");
  if (!form) return;

  const areaInput = $("#areaM2");
  const firstPriceInput = $("#firstCutPrice");
  const monthlyCheckbox = $("#monthlyService");
  const monthlyFeeInput = $("#monthlyFee");
  const suggestion = $("#priceSuggestion");

  function calculatePrices() {
    const area = Number(areaInput.value);

    let firstPrice = null;
    let monthlyPrice = null;

    if (area > 0 && area <= 100) {
      firstPrice = 15000;
      monthlyPrice = 25000;
    } else if (area <= 200 && area > 100) {
      firstPrice = 20000;
      monthlyPrice = 35000;
    } else if (area <= 300 && area > 200) {
      firstPrice = 25000;
      monthlyPrice = 45000;
    } else if (area <= 500 && area > 300) {
      firstPrice = 30000;
      monthlyPrice = 55000;
    }

    if (!area || area < 1) {
      suggestion.textContent =
        "Ingresá la superficie para calcular los precios orientativos.";
      firstPriceInput.value = "";
      monthlyFeeInput.value = "";
      return;
    }

    if (firstPrice === null) {
      suggestion.textContent =
        "Terreno de más de 500 m²: definí un presupuesto manual.";
      firstPriceInput.value = "";
      monthlyFeeInput.value = "";
      return;
    }

    suggestion.innerHTML =
      `<strong>Precios sugeridos para ${area} m²</strong>
       <p>Primer corte: ${money(firstPrice)}</p>
       <p>Mantenimiento: ${money(monthlyPrice)} por mes</p>`;

    firstPriceInput.value = firstPrice;
    monthlyFeeInput.value = monthlyPrice;
  }

  areaInput.addEventListener("input", calculatePrices);

  monthlyCheckbox.addEventListener("change", () => {
    monthlyFeeInput.disabled = !monthlyCheckbox.checked;
    if (monthlyCheckbox.checked && !monthlyFeeInput.value) {
      calculatePrices();
    }
  });

  form.addEventListener("submit", event => {
    event.preventDefault();

    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const address = String(data.get("address") || "").trim();
    const zone = String(data.get("zone") || "").trim();
    const areaM2 = Number(data.get("areaM2"));
    const firstCutPrice = Number(data.get("firstCutPrice"));
    const monthlyService = monthlyCheckbox.checked;
    const monthlyFee = monthlyService ? Number(data.get("monthlyFee")) : 0;

    if (!name || !address || !zone || !Number.isFinite(areaM2) || areaM2 <= 0) {
      alert("Completá el nombre, domicilio, zona y superficie.");
      return;
    }

    if (!Number.isFinite(firstCutPrice) || firstCutPrice < 0) {
      alert("Revisá el precio del primer corte.");
      return;
    }

    if (monthlyService && (!Number.isFinite(monthlyFee) || monthlyFee <= 0)) {
      alert("Ingresá una mensualidad válida.");
      return;
    }

    const firstCutDate = data.get("firstCutDate") || null;
    const monthlyStartDate = data.get("monthlyStartDate") || null;

    if (
      (firstCutDate && !parseISODate(firstCutDate)) ||
      (monthlyStartDate && !parseISODate(monthlyStartDate))
    ) {
      alert("Revisá las fechas ingresadas.");
      return;
    }

    const duplicate = clients.some(client =>
      client.name.trim().toLowerCase() === name.toLowerCase() &&
      client.address.trim().toLowerCase() === address.toLowerCase()
    );

    if (duplicate && !confirm(
      "Ya existe un cliente con ese nombre y domicilio. ¿Querés registrarlo igualmente?"
    )) return;

    const newId = clients.reduce(
      (max, client) => Math.max(max, Number(client.id) || 0),
      0
    ) + 1;

    const client = {
      id: newId,
      name,
      phone: String(data.get("phone") || "").trim(),
      address,
      zone,
      references: String(data.get("references") || "").trim(),
      areaM2,
      grassCondition: data.get("grassCondition"),
      notes: String(data.get("notes") || "").trim(),
      firstCutPrice,
      monthlyService,
      fee: monthlyFee,
      monthlyStartDate: monthlyService ? monthlyStartDate : null,
      originalDate: firstCutDate,
      scheduledDate: firstCutDate,
      lastCompletedDate: null,
      next: firstCutDate
    };

    if (!confirm(
      `Nuevo cliente: ${name}\n` +
      `Terreno: ${areaM2} m²\n` +
      `Primer corte: ${money(firstCutPrice)}\n` +
      `Mensualidad: ${monthlyService ? money(monthlyFee) + "/mes" : "No contratada"}\n` +
      `Primer corte programado: ${dateLabel(firstCutDate)}\n\n` +
      "¿Guardar estos datos?"
    )) return;

    clients.push(client);
    saveData();

    currentPage = "clientes";
    searchText = "";
    render();

    alert(`Cliente ${name} guardado correctamente.`);
  });

  calculatePrices();
}

function bindPageEvents() {
  document.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", () => {
      currentPage = button.dataset.go;
      render();
    });
  });

  const search = $("#clientSearch");

  if (search) {
    search.addEventListener("input", event => {
      searchText = event.target.value;
      const position = search.selectionStart;

      render();

      const newSearch = $("#clientSearch");
      if (newSearch) {
        newSearch.focus();
        newSearch.setSelectionRange(position, position);
      }
    });
  }

  document.querySelectorAll("[data-client]").forEach(button => {
    button.addEventListener("click", () => {
      showClient(Number(button.dataset.client));
    });
  });

  document.querySelectorAll("[data-complete-cut]").forEach(button => {
    button.addEventListener("click", () => {
      const client = clients.find(
        item => item.id === Number(button.dataset.completeCut)
      );

      if (!client) return;

      const actualDate = prompt(
        `¿Qué día terminaste el corte de ${client.name}?\nFormato AAAA-MM-DD:`,
        todayISO()
      );

      if (!actualDate) return;

      if (!parseISODate(actualDate)) {
        alert("La fecha no es válida. Usá AAAA-MM-DD.");
        return;
      }

      const nextDate = client.monthlyService === false
        ? null
        : addDays(actualDate, CYCLE_DAYS);

      const nextText = nextDate ? dateLabel(nextDate) : "Sin próximo corte automático";

      if (!confirm(
        `Cliente: ${client.name}\n` +
        `Trabajo terminado: ${dateLabel(actualDate)}\n` +
        `Próximo corte: ${nextText}\n\n` +
        "¿Confirmar?"
      )) return;

      client.originalDate ||= client.scheduledDate || client.next;
      completeCut(client, actualDate);

      saveData();
      render();
    });
  });

  document.querySelectorAll("[data-finish]").forEach(button => {
    button.addEventListener("click", () => {
      const task = tasks.find(
        item => item.id === Number(button.dataset.finish)
      );

      if (!task) return;

      const actualDate = prompt(
        `Fecha real de finalización de ${task.client} (AAAA-MM-DD):`,
        todayISO()
      );

      if (!actualDate) return;

      if (!parseISODate(actualDate)) {
        alert("La fecha no es válida.");
        return;
      }

      if (task.status === "incompleto") {
        const remaining = Number(task.balance) || 0;

        if (!confirm(
          `¿Confirmás que el trabajo de ${task.client} quedó terminado el ${dateLabel(actualDate)}?`
        )) return;

        task.completedDate = actualDate;
        task.status = remaining > 0 ? "terminado" : "terminado";
        task.detail += ` Trabajo terminado el ${dateLabel(actualDate)}. El saldo pendiente se conserva.`;

        // El trabajo puntual de Lucía no reinicia su ciclo mensual.
        saveData();
        render();
        return;
      }

      const client = findClientByName(task.client);

      if (client && task.startsCycle) {
        const nextDate = addDays(actualDate, CYCLE_DAYS);

        if (!confirm(
          `Visita terminada: ${dateLabel(actualDate)}\n` +
          `Próximo corte: ${dateLabel(nextDate)}\n\n` +
          "¿Confirmar?"
        )) return;

        completeCut(client, actualDate);
      } else if (!confirm(
        `¿Marcar la visita de ${task.client} como terminada el ${dateLabel(actualDate)}?`
      )) {
        return;
      }

      task.completedDate = actualDate;
      task.status = "terminado";

      saveData();
      render();
    });
  });

  document.querySelectorAll("[data-payment]").forEach(button => {
    button.addEventListener("click", () => {
      const task = tasks.find(
        item => item.id === Number(button.dataset.payment)
      );

      if (!task || !(task.balance > 0)) return;

      const value = prompt(
        `Saldo pendiente: ${money(task.balance)}\n¿Cuánto cobraste ahora?`,
        String(task.balance)
      );

      if (value === null) return;

      const amount = Number(value);

      if (!Number.isFinite(amount) || amount <= 0 || amount > task.balance) {
        alert("Ingresá un importe mayor que cero y no superior al saldo.");
        return;
      }

      task.paidAmount = (task.paidAmount || 0) + amount;
      task.balance -= amount;
      task.detail =
        `Trabajo puntual: ${money(task.jobTotal || 35000)}. ` +
        `Cobrado: ${money(task.paidAmount)}. ` +
        `Saldo pendiente: ${money(task.balance)}.`;

      saveData();
      render();
    });
  });

  document.querySelectorAll("[data-schedule]").forEach(button => {
    button.addEventListener("click", () => {
      const task = tasks.find(
        item => item.id === Number(button.dataset.schedule)
      );

      if (!task) return;

      const date = prompt(
        "Fecha de la visita (AAAA-MM-DD):",
        task.date || ""
      );

      if (!date) return;

      if (!parseISODate(date)) {
        alert("La fecha no es válida. Usá AAAA-MM-DD.");
        return;
      }

      task.status = "programado";
      task.date = date;

      saveData();
      render();
    });
  });

  const helper = $("#helperButton");
  if (helper) helper.addEventListener("click", registerHelperShift);

  bindNewClientForm();
}

function showClient(id) {
  const client = clients.find(item => item.id === id);
  if (!client) return;

  alert(
    `${client.name}\n` +
    `${client.address}\n` +
    `${client.zone}\n` +
    `Teléfono: ${client.phone || "Sin registrar"}\n` +
    `Superficie: ${client.areaM2 ? client.areaM2 + " m²" : "Sin registrar"}\n\n` +
    `Primer corte: ${money(client.firstCutPrice || 0)}\n` +
    `Mensualidad: ${client.monthlyService === false ? "No contratada" : money(client.fee) + "/mes"}\n` +
    `Próximo corte: ${dateLabel(client.next)}\n` +
    `Último corte terminado: ${dateLabel(client.lastCompletedDate)}\n` +
    `Estado del pasto: ${client.grassCondition || "Sin registrar"}\n` +
    `Observaciones: ${client.notes || "Ninguna"}\n\n` +
    "El historial completo de pagos y visitas se incorporará en otra etapa."
  );
}

function registerHelperShift() {
  const client = prompt("¿Para qué cliente o terreno trabajó Joaquín?");
  if (!client) return;

  const start = prompt("Hora de entrada (HH:MM):");
  const end = prompt("Hora de salida (HH:MM):");

  if (!start || !end) return;

  const toMinutes = value => {
    if (!/^\d{2}:\d{2}$/.test(value)) return NaN;

    const [hours, minutes] = value.split(":").map(Number);

    return hours < 24 && minutes < 60
      ? hours * 60 + minutes
      : NaN;
  };

  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);

  if (
    !Number.isFinite(startMinutes) ||
    !Number.isFinite(endMinutes) ||
    endMinutes <= startMinutes
  ) {
    alert("Revisá las horas. La salida debe ser posterior a la entrada.");
    return;
  }

  const hours = (endMinutes - startMinutes) / 60;
  const total = Math.round(hours * HELPER_RATE);

  if (!confirm(
    `Joaquín · ${client}\n` +
    `${start} a ${end}\n` +
    `${hours.toFixed(2)} horas\n` +
    `Pago calculado: ${money(total)}\n\n` +
    "¿Guardar jornada?"
  )) return;

  const shifts = load("zark_shifts", []);

  shifts.push({
    id: Date.now(),
    client,
    date: todayISO(),
    start,
    end,
    hours,
    rate: HELPER_RATE,
    total,
    paid: false
  });

  localStorage.setItem("zark_shifts", JSON.stringify(shifts));
  alert("Jornada guardada en este dispositivo.");
}

// Navegación inferior.
document.querySelectorAll(".nav-button").forEach(button => {
  button.addEventListener("click", () => {
    currentPage = button.dataset.page;
    render();
  });
});

const todayButton = $("#todayButton");

if (todayButton) {
  todayButton.addEventListener("click", () => {
    currentPage = "inicio";
    render();
  });
}

migrateData();
render();
