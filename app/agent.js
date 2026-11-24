// Grafo multiagente ReAct en el navegador: misma lógica y mismos prompts que codes/agents.py
import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

const MAX_PASOS = 6, MAX_RECHAZOS = 2, TOP_K = 3;

export const HERRAMIENTAS = {
  buscar_kb: "busca en la base de conocimiento local (artículos de Wikipedia, problemas de matemáticas resueltos y programas de Python de ejemplo). Entrada: una consulta en texto.",
  buscar_web: "busca en internet. Entrada: una consulta en texto.",
  ejecutar_python: "ejecuta código Python y devuelve lo que imprime. Úsala para cálculos y para probar código. Entrada: código Python completo con print.",
};

const P_INV = `Eres el Agente Investigador de un equipo de auditoría. Resuelves la pregunta paso a paso con el formato ReAct.

Herramientas disponibles:
${Object.entries(HERRAMIENTAS).map(([n, d]) => `${n}: ${d}`).join("\n")}

Formato obligatorio, un paso por turno:
Thought: tu razonamiento breve
Action: nombre de una herramienta
Action Input: la entrada de la herramienta

Luego recibirás una Observation. Cuando tengas evidencia suficiente escribe:
Thought: ya tengo la evidencia
Final Report: hechos y cifras que encontraste, citando los [id] de las observaciones. Si la tarea pide código, incluye la función completa en un bloque \`\`\`python.

Reglas:
1. Usa al menos una herramienta antes del Final Report y no inventes datos que no estén en las observaciones.
2. Para preguntas de hechos usa buscar_kb primero y buscar_web solo si la base no tiene la respuesta.
3. Para cálculos escribe el cálculo en ejecutar_python con print y usa el resultado.
4. Para código, prueba tu función con los tests usando ejecutar_python antes del reporte.
5. Escribe las entradas de buscar_kb y buscar_web en inglés, porque la base de conocimiento está en inglés.`;

const P_AUD = `Eres el Agente Auditor de Hechos. Verificas el reporte del Investigador contra las observaciones de las herramientas.
Rechaza el reporte si contiene datos que no aparecen en las observaciones (alucinaciones), si no responde la pregunta o si está incompleto.
Responde exactamente en dos líneas:
VEREDICTO: APROBADO o RECHAZADO
MOTIVO: una oración`;

// Los modelos pequeños copian literalmente reglas condicionales ("Final answer: número"),
// así que la regla de formato se decide en código y solo se envía cuando aplica.
const esCodigoP = p => /must pass these tests|assert |def |python/i.test(p);
const esMateP = p => /\d/.test(p) && !esCodigoP(p);
const formato = p => esCodigoP(p) ? "\nEntrega la función completa dentro de un bloque ```python."
  : esMateP(p) ? "\nTermina con una última línea con este formato exacto: Final answer: seguido del número." : "";

const P_RED = `Eres el Agente Redactor. Escribes la respuesta final para el usuario usando solo el reporte aprobado y la evidencia de las herramientas.
Responde en el idioma de la pregunta, de forma breve y directa, citando los [id] de las fuentes.
Si la respuesta es un número calculado, antes de la línea final escribe una o dos frases con los datos que usaste, cada uno con su [id], y la operación que hiciste.`;

// Base de conocimiento: textos y embeddings int8 exportados por codes/export_web.py
let KB = null, VEC = null, embedder = null;
export async function cargarKB(progreso) {
  KB = await (await fetch("data/kb.json")).json();
  VEC = new Int8Array(Uint8Array.from(atob(KB.vec), c => c.charCodeAt(0)).buffer);
  embedder = await pipeline("feature-extraction", "Xenova/" + KB.embedder, { dtype: "q8", progress_callback: progreso });
  return KB.docs.length;
}

async function buscarKB(consulta, k = TOP_K) {
  const q = (await embedder(consulta, { pooling: "mean", normalize: true })).data;
  const d = KB.dim, n = KB.docs.length, scores = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < d; j++) s += q[j] * VEC[i * d + j];
    scores[i] = s / 127;  // coseno, porque los vectores eran unitarios antes de cuantizar
  }
  const top = [...scores.keys()].sort((a, b) => scores[b] - scores[a]).slice(0, k);
  const docs = top.map(i => ({ id: KB.docs[i].id, titulo: KB.docs[i].t, texto: KB.docs[i].x, score: scores[i] }));
  return { obs: docs.map(x => `[${x.id}] ${x.texto.slice(0, 700)}`).join("\n"), docs };
}

async function buscarWeb(consulta, k = 3) {
  try {  // la API de Wikipedia permite CORS con origin=*
    const u = `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=${k}&srsearch=${encodeURIComponent(consulta)}`;
    const r = await (await fetch(u)).json();
    const docs = r.query.search.map((h, i) => ({ id: `web_${i}`, titulo: h.title, texto: h.snippet.replace(/<[^>]+>/g, ""),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(h.title)}` }));
    return { obs: docs.map(x => `[${x.id}] ${x.titulo}: ${x.texto}`).join("\n") || "Sin resultados.", docs };
  } catch (e) { return { obs: "ERROR: búsqueda web no disponible.", docs: [] }; }
}

// Python en un Web Worker con Pyodide; se reinicia si excede el tiempo
let worker = null;
function ejecutarPython(codigo, ms = 15000) {
  worker ??= new Worker("py_worker.js");
  return new Promise(res => {
    const t = setTimeout(() => { worker.terminate(); worker = null; res({ out: "ERROR: tiempo de ejecución agotado.", ok: false }); }, ms);
    worker.onmessage = e => { clearTimeout(t); res(e.data); };
    worker.postMessage({ codigo });
  });
}

async function ejecutar(accion, entrada) {
  if (accion === "buscar_kb") return buscarKB(entrada);
  if (accion === "buscar_web") return buscarWeb(entrada);
  if (accion === "ejecutar_python") return { obs: (await ejecutarPython(entrada)).out || "(sin salida; usa print)", docs: [] };
  return { obs: `ERROR: la herramienta ${accion} no existe. Usa una de: ${Object.keys(HERRAMIENTAS).join(", ")}.`, docs: [] };
}

export const extraerCodigo = t => {
  const b = [...t.matchAll(/```(?:python)?\n([\s\S]*?)```/g)].map(m => m[1]);
  return b.length ? b.sort((a, c) => c.length - a.length)[0].trim() : "";
};

// Recorre el grafo: Investigador, Herramientas, Auditor y Redactor. emit recibe cada evento de la traza.
// Presupuesto: en el navegador se usan límites menores que en Python para que una consulta no tarde minutos.
// detener() permite cortar desde la interfaz; limiteMs fuerza el reporte final cuando se acaba el tiempo.
export async function correrAgentes(pregunta, llm, { conAuditor = true, emit = () => {}, maxPasos = MAX_PASOS, maxRechazos = MAX_RECHAZOS,
  maxTokens = 600, limiteMs = Infinity, detener = () => false } = {}) {
  const inicio = performance.now();
  const sinTiempo = () => performance.now() - inicio > limiteMs;
  const s = { pasos: [], contextos: [], reporte: "", feedback: "", rechazos: 0, pasosIntento: 0, accion: null };
  let nodo = "Investigador";
  const paso = async (nombre, f) => {
    emit({ nodo: nombre, tipo: "inicio" });
    const t0 = performance.now(), ev = await f();
    emit({ nodo: nombre, ...ev, ms: performance.now() - t0 });
  };
  while (nodo !== "Fin") {
    if (detener()) throw new Error("Consulta detenida.");
    if (sinTiempo()) { s.pasosIntento = maxPasos; s.rechazos = maxRechazos; }  // se acabó el tiempo: cerrar con lo que hay
    if (nodo === "Investigador") {
      await paso("Investigador", async () => {
        const scratch = s.pasos.map(p => `Thought: ${p.thought}\nAction: ${p.accion}\nAction Input: ${p.entrada}\nObservation: ${p.obs}`).join("\n");
        let tarea = `Pregunta: ${pregunta}`;
        if (s.feedback) tarea += `\n\nEl Auditor rechazó tu reporte anterior. Motivo: ${s.feedback}\nCorrige el problema.`;
        if (s.pasosIntento >= maxPasos) tarea += "\n\nYa no puedes usar más herramientas: escribe ahora el Final Report.";
        const t = await llm([{ role: "system", content: P_INV }, { role: "user", content: tarea + (scratch ? "\n\n" + scratch : "") }], maxTokens, ["Observation:"]);
        const th = (t.match(/Thought:\s*([\s\S]*?)(?:\nAction:|\nFinal Report:|$)/) || [, t.slice(0, 200)])[1].trim();
        // Sin Action el turno se toma como reporte final (el modelo a veces escribe Final answer en vez de Final Report)
        if (t.includes("Final Report:") || !t.includes("Action:") || s.pasosIntento >= maxPasos) {
          s.reporte = t.split("Final Report:").pop().trim(); s.accion = null;
          return { tipo: "reporte", texto: s.reporte };
        }
        let accion = (t.match(/Action:\s*`?(\w+)/) || [, "ninguna"])[1];
        let entrada = ((t.match(/Action Input:\s*([\s\S]*)/) || [, ""])[1]).trim();
        if (accion === "ejecutar_python") entrada = extraerCodigo(entrada) || entrada.replace(/^`+|`+$/g, "");
        s.accion = { thought: th, accion, entrada };
        return { tipo: "thought", texto: th, accion, entrada };
      });
      nodo = s.accion ? "Herramientas" : (conAuditor ? "Auditor" : "Redactor");
    } else if (nodo === "Herramientas") {
      await paso("Herramientas", async () => {
        const { obs, docs } = await ejecutar(s.accion.accion, s.accion.entrada);
        s.pasos.push({ ...s.accion, obs }); s.contextos.push(obs); s.pasosIntento++;
        const accion = s.accion.accion; s.accion = null;
        return { tipo: "observation", accion, texto: obs, docs };
      });
      nodo = "Investigador";
    } else if (nodo === "Auditor") {
      let rechazado = false;
      await paso("Auditor", async () => {
        // En código los tests son la evidencia: se ejecutan siempre y el error se devuelve al Investigador
        let motivo = "";
        const esCodigo = pregunta.includes("must pass these tests") || pregunta.includes("assert ");
        if (esCodigo) {
          const tests = pregunta.split("\n").filter(l => l.trim().startsWith("assert")).join("\n");
          const r = await ejecutarPython(extraerCodigo(s.reporte) + "\n" + tests + "\nprint('TESTS OK')");
          if (!(r.ok && r.out.includes("TESTS OK")))
            motivo = `El código no pasa los tests. Salida:\n${r.out.slice(-400)}\nCorrige la función y pruébala con ejecutar_python antes de reportar.`;
        } else if (!s.pasos.length) motivo = "El reporte no se apoya en ninguna herramienta. Usa buscar_kb o ejecutar_python para obtener evidencia.";
        if (!motivo && !esCodigo) {
          const ev = s.contextos.join("\n\n").slice(-6000);
          const t = await llm([{ role: "system", content: P_AUD }, { role: "user", content: `Pregunta: ${pregunta}\n\nObservaciones:\n${ev}\n\nReporte:\n${s.reporte}` }], 80);
          if (t.toUpperCase().includes("RECHAZADO")) motivo = t.split("MOTIVO:").pop().trim() || "Reporte no respaldado.";
        }
        if (motivo && s.rechazos < maxRechazos) {
          s.feedback = motivo; s.rechazos++; s.pasosIntento = 0; rechazado = true;
          return { tipo: "rechazo", texto: motivo };
        }
        s.feedback = "";
        return { tipo: "aprobado", texto: motivo ? `Aprobado con advertencia (límite de rechazos): ${motivo}` : "Aprobado." };
      });
      nodo = rechazado ? "Investigador" : "Redactor";
    } else if (nodo === "Redactor") {
      let resp = "";
      await paso("Redactor", async () => {
        resp = await llm([{ role: "system", content: P_RED }, { role: "user", content: `Pregunta: ${pregunta}\n\nEvidencia de las herramientas:\n${s.contextos.join("\n\n").slice(0, 8000) || "(sin evidencia)"}\n\nReporte aprobado:\n${s.reporte}${formato(pregunta)}` }], 500);
        return { tipo: "respuesta", texto: resp };
      });
      nodo = "Fin";
      return resp;
    }
  }
}

// Naive RAG de un solo paso, para comparar en vivo
export async function naiveRAG(pregunta, llm, { emit = () => {} } = {}) {
  emit({ nodo: "Herramientas", tipo: "inicio" });
  let t0 = performance.now();
  const { obs, docs } = await buscarKB(pregunta, TOP_K + 1);
  emit({ nodo: "Herramientas", tipo: "observation", accion: "buscar_kb", texto: obs, docs, ms: performance.now() - t0 });
  emit({ nodo: "Redactor", tipo: "inicio" });
  t0 = performance.now();
  const r = await llm([{ role: "system", content: "Responde la pregunta usando solo el contexto, en el idioma de la pregunta, citando los [id]. Si el contexto no contiene la respuesta, dilo en una frase en vez de adivinar." },
    { role: "user", content: `Contexto:\n${obs}\n\nPregunta: ${pregunta}${formato(pregunta)}` }], 500);
  emit({ nodo: "Redactor", tipo: "respuesta", texto: r, ms: performance.now() - t0 });
  return r;
}
