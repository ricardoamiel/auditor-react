// Interfaz: chat, carga del modelo y visualizaciones con D3 v7
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import { cargarKB, correrAgentes, naiveRAG } from "./agent.js";

const $ = (id) => document.getElementById(id);
const COLOR = { Investigador: "--investigador", Herramientas: "--herramientas", Auditor: "--auditor", Redactor: "--redactor" };
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const colorNodo = (n) => css(COLOR[n] || "--muted");

const EJEMPLOS = [
  "how are glacier caves formed?",
  "¿Quién escribió la novela Don Quijote y en qué año se publicó?",
  "Janet's ducks lay 16 eggs per day. She eats three for breakfast every morning and bakes muffins for her friends every day with four. She sells the remainder at the farmers' market daily for $2 per fresh duck egg. How much in dollars does she make every day at the farmers' market?",
  "Write a python function to find the first repeated character in a given string.\nYour code must pass these tests:\nassert first_repeated_char(\"abcabc\") == \"a\"\nassert first_repeated_char(\"abc\") == None\nassert first_repeated_char(\"123123\") == \"1\"",
];

let engine = null, ocupado = false;

// ---------- Grafo de agentes ----------
const NODOS = [
  { id: "Inicio", x: 40, y: 150, r: true }, { id: "Investigador", x: 200, y: 150 }, { id: "Herramientas", x: 200, y: 42 },
  { id: "Auditor", x: 385, y: 150 }, { id: "Redactor", x: 545, y: 150 }, { id: "Fin", x: 615, y: 150, r: true },
];
const P = Object.fromEntries(NODOS.map((n) => [n.id, n]));
const M = ["multi"], S = ["multi_sin_auditor"], N = ["naive"], MS = ["multi", "multi_sin_auditor"], T = ["multi", "multi_sin_auditor", "naive"];
const ARISTAS = [  // cada arista indica en qué sistemas existe
  { id: "Inicio>Investigador", d: "M52,150 L142,150", modos: MS },
  { id: "Investigador>Herramientas", d: "M180,128 L180,64", et: "Action", ex: 136, ey: 98, modos: MS },
  { id: "Herramientas>Investigador", d: "M220,64 L220,128", et: "Observation", ex: 228, ey: 98, modos: MS },
  { id: "Investigador>Auditor", d: "M258,150 L327,150", et: "reporte", ex: 270, ey: 140, modos: M },
  { id: "Auditor>Investigador", d: "M385,172 C385,240 200,240 200,174", et: "rechazo", ex: 270, ey: 238, modos: M },
  { id: "Auditor>Redactor", d: "M443,150 L487,150", et: "aprobado", ex: 465, ey: 120, ta: "middle", modos: M },
  { id: "Investigador>Redactor", d: "M200,172 C200,240 545,240 545,174", et: "reporte", ex: 360, ey: 238, modos: S },
  { id: "Inicio>Herramientas", d: "M48,140 L142,52", et: "recuperar", ex: 50, ey: 88, modos: N },
  { id: "Herramientas>Redactor", d: "M258,42 C460,42 545,60 545,128", et: "contexto", ex: 420, ey: 36, modos: N },
  { id: "Redactor>Fin", d: "M603,150 L605,150", modos: T },
];
const NODOS_MODO = { multi: ["Investigador", "Herramientas", "Auditor", "Redactor"],
  multi_sin_auditor: ["Investigador", "Herramientas", "Redactor"], naive: ["Herramientas", "Redactor"] };

function mostrarModo() {  // atenúa lo que no existe en el sistema elegido
  const modo = $("modo").value;
  d3.selectAll(".arista-g").style("opacity", (e) => (e.modos.includes(modo) ? 1 : 0));
  d3.selectAll(".nodo").style("opacity", (n) => (n.r || NODOS_MODO[modo].includes(n.id) ? 1 : 0.25));
}

function dibujarGrafo() {
  const svg = d3.select("#grafo");
  svg.selectAll("*").remove();
  svg.append("defs").append("marker").attr("id", "punta").attr("viewBox", "0 0 10 10").attr("refX", 9).attr("refY", 5)
    .attr("markerWidth", 7).attr("markerHeight", 7).attr("orient", "auto-start-reverse")
    .append("path").attr("d", "M0,0 L10,5 L0,10 z").attr("class", "flecha");
  const a = svg.append("g").selectAll("g").data(ARISTAS).join("g").attr("class", "arista-g");
  a.append("path").attr("class", "arista").attr("id", (e) => "e_" + e.id.replace(">", "_")).attr("d", (e) => e.d).attr("marker-end", "url(#punta)");
  a.filter((e) => e.et).append("text").attr("class", "etiqueta").attr("text-anchor", (e) => e.ta || "start").attr("x", (e) => e.ex).attr("y", (e) => e.ey).text((e) => e.et);
  const n = svg.append("g").selectAll("g").data(NODOS).join("g").attr("class", "nodo").attr("id", (d) => "n_" + d.id)
    .attr("transform", (d) => `translate(${d.x},${d.y})`);
  n.filter((d) => d.r).append("circle").attr("r", 11).attr("fill", css("--idle"));
  n.filter((d) => !d.r).append("rect").attr("x", -58).attr("y", -22).attr("width", 116).attr("height", 44).attr("rx", 10);
  n.append("text").attr("text-anchor", "middle").attr("dy", (d) => (d.r ? 26 : -1)).text((d) => d.id);
  n.filter((d) => !d.r).append("text").attr("class", "contador").attr("text-anchor", "middle").attr("dy", 14).text("");
}

const visitas = {};
let previo = "Inicio";
function reiniciarGrafo() {
  Object.keys(visitas).forEach((k) => delete visitas[k]);
  previo = "Inicio";
  d3.selectAll(".arista").classed("usada", false).style("stroke", null);
  d3.selectAll(".nodo").classed("activo", false).select("rect").style("stroke", null);
  d3.selectAll(".contador").text("");
}

function activar(nodo) {
  visitas[nodo] = (visitas[nodo] || 0) + 1;
  const arista = d3.select("#e_" + previo + "_" + nodo);
  if (!arista.empty()) {  // pulso que recorre la arista recién usada
    arista.classed("usada", true).style("stroke", colorNodo(nodo));
    const largo = arista.node().getTotalLength();
    arista.attr("stroke-dasharray", `${largo} ${largo}`).attr("stroke-dashoffset", largo)
      .transition().duration(450).attr("stroke-dashoffset", 0);
  }
  d3.selectAll(".nodo").classed("activo", false).select("rect").style("stroke", null);
  d3.select("#n_" + nodo).classed("activo", true).select("rect").style("stroke", colorNodo(nodo));
  d3.select("#n_" + nodo).select(".contador").text(`visitas: ${visitas[nodo]}`);
  previo = nodo;
}

function terminarGrafo() {
  const arista = d3.select("#e_" + previo + "_Fin");
  if (!arista.empty()) arista.classed("usada", true).style("stroke", css("--text2"));
  d3.selectAll(".nodo").classed("activo", false).select("rect").style("stroke", null);
  d3.select("#n_Fin circle").attr("fill", css("--auditor"));
}

// ---------- Tooltip ----------
const tip = $("tooltip");
const mostrarTip = (ev, texto) => { tip.hidden = false; tip.textContent = texto; tip.style.left = Math.min(ev.clientX + 14, innerWidth - 340) + "px"; tip.style.top = ev.clientY + 14 + "px"; };
const ocultarTip = () => { tip.hidden = true; };

// ---------- Línea de tiempo (diagrama de Gantt de los pasos) ----------
let pasos = [];
function dibujarTimeline() {
  const cont = $("timeline");
  cont.innerHTML = "";
  if (!pasos.length) return;
  const ancho = cont.clientWidth || 560, fila = 24, m = { l: 190, r: 48, t: 4, b: 26 };
  const alto = m.t + m.b + fila * pasos.length;
  const fin = d3.max(pasos, (p) => p.t0 + p.ms) || 1;
  const x = d3.scaleLinear().domain([0, fin / 1000]).range([m.l, ancho - m.r]);
  const svg = d3.select(cont).append("svg").attr("viewBox", `0 0 ${ancho} ${alto}`).attr("width", "100%");
  svg.append("g").attr("transform", `translate(0,${alto - m.b})`).call(d3.axisBottom(x).ticks(5).tickFormat((v) => v + " s"))
    .call((g) => g.selectAll("line,path").attr("stroke", css("--border"))).call((g) => g.selectAll("text").attr("fill", css("--text2")));
  const g = svg.selectAll("g.paso").data(pasos).join("g").attr("class", "paso").attr("transform", (_, i) => `translate(0,${m.t + i * fila})`);
  g.append("text").attr("x", m.l - 8).attr("y", fila / 2 + 4).attr("text-anchor", "end").style("font-size", "11px")
    .text((p) => p.etiqueta.length > 30 ? p.etiqueta.slice(0, 29) + "…" : p.etiqueta);
  g.append("rect").attr("x", (p) => x(p.t0 / 1000)).attr("y", 5).attr("height", fila - 10).attr("rx", 3)
    .attr("width", (p) => Math.max(3, x((p.t0 + p.ms) / 1000) - x(p.t0 / 1000)))
    .attr("fill", (p) => (p.tipo === "rechazo" ? css("--rechazo") : colorNodo(p.nodo)));
  g.append("text").attr("x", (p) => x((p.t0 + p.ms) / 1000) + 4).attr("y", fila / 2 + 4).style("font-size", "11px")
    .style("fill", css("--text2")).text((p) => (p.ms / 1000).toFixed(1) + " s");
  g.append("rect").attr("x", 0).attr("width", ancho).attr("height", fila).attr("fill", "transparent")  // zona de hover amplia
    .on("mousemove", (ev, p) => mostrarTip(ev, `${p.etiqueta}\n${(p.texto || "").slice(0, 400)}`)).on("mouseleave", ocultarTip);
}

// ---------- Evidencia recuperada ----------
function mostrarEvidencia(docs) {
  const cont = d3.select("#evidencia");
  if (!docs.length) return;
  cont.selectAll(".nota").remove();
  const d = cont.selectAll("div.doc.nuevo").data(docs).join("div").attr("class", "doc");
  d.html((x) => `<b>[${x.id}]</b> ${x.titulo || ""}${x.url ? ` <a href="${x.url}" target="_blank" rel="noopener">abrir</a>` : ""}` +
    (x.score != null ? `<div class="puntaje" style="width:${Math.max(4, x.score * 100)}%" title="similitud coseno ${x.score.toFixed(3)}"></div>` : "") +
    `<div class="texto">${(x.texto || "").replace(/</g, "&lt;")}</div>`);
}

// ---------- Resultados de la evaluación ----------
async function mostrarResultados() {
  try {
    const r = await (await fetch("data/resultados.json")).json();
    const cols = [["acierto", "Acierto"], ["faithfulness", "Faithfulness"], ["answer_relevance", "Answer Relevance"], ["segundos", "Segundos"]];
    const tabla = (filas) => {
      let h = `<table><tr><th>Sistema</th>${cols.map((c) => `<th>${c[1]}</th>`).join("")}</tr>`;
      for (const f of filas) h += `<tr><td>${f.nombre}</td>${cols.map(([k]) => `<td>${f[k] == null ? "" : k === "segundos" ? f[k].toFixed(1) : f[k].toFixed(2)}</td>`).join("")}</tr>`;
      return h + "</table>";
    };
    // formato actual: consultas complejas (resultado principal) y preguntas de los datasets (control)
    $("resultados").innerHTML = Array.isArray(r) ? tabla(r)
      : `<h3>50 consultas complejas</h3><p class="nota">Cada una exige dos documentos y una resta.</p>${tabla(r.complejas)}`
        + `<h3>50 preguntas de los datasets (control)</h3><p class="nota">WikiQA, GSM8K y MBPP: casi siempre basta una búsqueda.</p>${tabla(r.control)}`;
  } catch { $("resultados").innerHTML = '<p class="nota">Los resultados se publican al terminar la evaluación.</p>'; }
}

// ---------- Chat ----------
function agregarMsg(clase, texto) {
  const ultimo = $("mensajes").lastElementChild;
  if (clase === "sistema" && ultimo && ultimo.className === "msg sistema" && ultimo.textContent === texto) return ultimo;
  const div = document.createElement("div");
  div.className = "msg " + clase;
  div.textContent = texto;
  $("mensajes").appendChild(div);
  $("mensajes").scrollTop = 1e9;
  return div;
}

function estado(texto, clase = "") { $("estado").textContent = texto; $("punto").className = "punto " + clase; }

function onEvento(ev, t0) {
  if (ev.tipo === "inicio") { nodoActual = ev.nodo; activar(ev.nodo); estado(`${ev.nodo} trabajando`, "ocupado"); return; }
  if (ev.nodo !== previo) activar(ev.nodo);  // eventos del servidor llegan sin evento de inicio
  const etiqueta = ev.nodo + (ev.accion ? `: ${ev.accion}` : ev.tipo === "rechazo" ? ": rechazo" : "");
  const ms = ev.ms ?? 0;
  const inicio = pasos.length ? pasos[pasos.length - 1].t0 + pasos[pasos.length - 1].ms : 0;  // pasos consecutivos
  pasos.push({ nodo: ev.nodo, tipo: ev.tipo, etiqueta, texto: ev.texto, ms, t0: inicio });
  dibujarTimeline();
  if (ev.docs) mostrarEvidencia(ev.docs);
}

// Genera en streaming para mostrar el avance (tokens y velocidad) mientras el agente trabaja
let detenido = false, nodoActual = "";
async function llmNavegador(mensajes, max, stop) {
  const t0 = performance.now();
  let texto = "", n = 0;
  const flujo = await engine.chat.completions.create({ messages: mensajes, temperature: 0, max_tokens: max, stop, stream: true });
  for await (const parte of flujo) {
    texto += parte.choices[0]?.delta?.content || "";
    n++;
    if (n % 8 === 0) estado(`${nodoActual}: ${n} tokens, ${(n / ((performance.now() - t0) / 1000)).toFixed(1)} tokens/s`, "ocupado");
  }
  return texto;
}
// Límites para el navegador: menos pasos, un rechazo, respuestas más cortas y 2 minutos como máximo
const PRESUPUESTO_NAVEGADOR = { maxPasos: 3, maxRechazos: 1, maxTokens: 350, limiteMs: 120000 };

const SIN_SERVIDOR = (url) => `No hay un servidor respondiendo en ${url}. Esta página solo es la interfaz: el modelo 7B corre en una máquina con GPU ` +
  "con python app/server.py, y si esa máquina es remota se abre un túnel ssh -L 8000:localhost:8000 hacia ella. Los pasos están en el README.";
async function servidorVivo(url) {
  try {
    const r = await fetch(url + "/salud", { signal: AbortSignal.timeout(5000) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
async function viaServidor(pregunta, modo, emit) {
  const url = $("url").value.replace(/\/$/, "");
  let r;
  try {
    r = await fetch(url + "/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pregunta, modo }) });
  } catch { throw new Error(SIN_SERVIDOR(url)); }
  const lector = r.body.getReader(), dec = new TextDecoder();
  let buf = "", resp = "";
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lineas = buf.split("\n");
    buf = lineas.pop();
    for (const l of lineas.filter(Boolean)) {
      const ev = JSON.parse(l);
      if (ev.fin) resp = ev.respuesta; else emit(ev);
    }
  }
  return resp;
}

async function enviar(pregunta) {
  if (ocupado || !pregunta.trim()) return;
  ocupado = true; detenido = false;
  $("enviar").textContent = "Detener"; $("enviar").classList.add("detener");
  agregarMsg("usuario", pregunta);
  reiniciarGrafo(); pasos = []; dibujarTimeline();
  d3.select("#evidencia").html("");
  const modo = $("modo").value, t0 = performance.now();
  const emit = (ev) => onEvento(ev, t0);
  try {
    let resp;
    if ($("motor").value === "servidor") resp = await viaServidor(pregunta, modo, emit);
    else if (modo === "naive") resp = await naiveRAG(pregunta, llmNavegador, { emit });
    else resp = await correrAgentes(pregunta, llmNavegador, { conAuditor: modo === "multi", emit, detener: () => detenido, ...PRESUPUESTO_NAVEGADOR });
    terminarGrafo();
    const div = agregarMsg("bot", resp);
    const meta = document.createElement("span");
    const rech = pasos.filter((p) => p.tipo === "rechazo").length;
    meta.className = "meta";
    meta.textContent = `${((performance.now() - t0) / 1000).toFixed(1)} s, ${pasos.length} pasos, ${rech} rechazos del Auditor`;
    div.appendChild(meta);
    estado("Listo", "listo");
  } catch (e) {
    agregarMsg("sistema", detenido ? "Consulta detenida." : "Error: " + e.message);
    estado(detenido ? "Detenido" : "Error", detenido ? "listo" : "");
    terminarGrafo();
  }
  ocupado = false;
  $("enviar").textContent = "Enviar"; $("enviar").classList.remove("detener");
}

const SIN_WEBGPU = "Este navegador no tiene WebGPU activo, que es lo que permite correr el modelo en el navegador. " +
  "En Chrome o Edge de Windows y macOS viene activo. En Linux abre chrome://flags, activa Unsafe WebGPU Support y Vulkan, y reinicia el navegador; " +
  "en chrome://gpu debe aparecer WebGPU: Hardware accelerated. También puedes elegir el motor Servidor.";
let webgpu = null;
async function hayWebGPU() {
  if (webgpu === null) {
    try { webgpu = !!(navigator.gpu && (await navigator.gpu.requestAdapter())); } catch { webgpu = false; }
  }
  return webgpu;
}

async function cargar() {
  $("cargar").disabled = true;
  const motor = $("motor").value;
  try {
    estado("Cargando base de conocimiento", "ocupado");
    const n = await cargarKB((p) => { if (p.progress) $("progreso").style.width = p.progress * 0.3 + "%"; });
    let etiqueta = `${n} documentos indexados`;
    if (motor === "servidor") {
      const url = $("url").value.replace(/\/$/, "");
      const info = await servidorVivo(url);
      if (!info) throw new Error(SIN_SERVIDOR(url));
      etiqueta = `servidor con ${info.modelo.split("/").pop()} en ${info.gpu}`;
    } else {
      if (!(await hayWebGPU())) throw new Error(SIN_WEBGPU);
      const webllm = await import("https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.86/+esm");
      engine = await webllm.CreateMLCEngine(motor, {
        initProgressCallback: (p) => { $("progreso").style.width = 30 + p.progress * 70 + "%"; estado(p.text.slice(0, 60), "ocupado"); },
      });
    }
    $("progreso").style.width = "100%";
    estado(`Listo: ${etiqueta}`, "listo");
    $("entrada").disabled = false; $("enviar").disabled = false;
  } catch (e) {
    estado("No se pudo cargar", "");
    agregarMsg("sistema", e.message);
    $("cargar").disabled = false;
  }
}

$("motor").addEventListener("change", () => { $("lblUrl").hidden = $("motor").value !== "servidor"; $("cargar").disabled = false; });
$("cargar").addEventListener("click", cargar);
$("modo").addEventListener("change", () => { reiniciarGrafo(); mostrarModo(); });
$("form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (ocupado) {  // el mismo botón detiene la consulta en curso
    detenido = true;
    if (engine) engine.interruptGenerate();
    estado("Deteniendo", "ocupado");
    return;
  }
  const t = $("entrada").value; $("entrada").value = ""; enviar(t);
});
$("entrada").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!ocupado) $("form").requestSubmit(); } });
for (const ej of EJEMPLOS) {
  const b = document.createElement("button");
  b.type = "button"; b.textContent = ej.split("\n")[0].slice(0, 48) + (ej.length > 48 ? "…" : "");
  b.title = ej;
  b.onclick = () => { $("entrada").value = ej; $("entrada").focus(); };
  $("ejemplos").appendChild(b);
}
function aplicarTema(tema) {
  document.documentElement.setAttribute("data-theme", tema);
  $("tema").textContent = tema === "dark" ? "Modo claro" : "Modo oscuro";
  try { localStorage.setItem("tema", tema); } catch {}
}
let temaGuardado = "light";
try { temaGuardado = localStorage.getItem("tema") || "light"; } catch {}
aplicarTema(temaGuardado);
$("tema").addEventListener("click", () => {
  aplicarTema(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
  if (!ocupado) { dibujarGrafo(); mostrarModo(); }
  dibujarTimeline();
});

// Un enlace con ?servidor=URL deja la página lista para usar ese servidor (lo imprime el notebook de Colab)
const servidorEnlace = new URLSearchParams(location.search).get("servidor");
if (servidorEnlace) { $("motor").value = "servidor"; $("url").value = servidorEnlace; $("lblUrl").hidden = false; }

dibujarGrafo();
mostrarModo();
mostrarResultados();
hayWebGPU().then((ok) => { if (!ok && $("motor").value !== "servidor") agregarMsg("sistema", SIN_WEBGPU); });
addEventListener("resize", dibujarTimeline);
