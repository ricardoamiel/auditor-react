// Contenido de la presentación (una sola fuente para PPTX y HTML).
// Coordenadas en pulgadas sobre un lienzo de 13,333 x 7,5 (16:9).
// step: 0 = visible al entrar; 1, 2, 3... = aparece con cada clic (en PPTX es una diapositiva más).
// Paleta UTEC: celeste y negro; verde = mejora, rojo = falla; amarillo solo para resaltar barras.
// Los números salen de results/ y paper/tablas/ (evaluación en Khipu, noviembre 2026).

const C = {
  cy: "00BFFF",   // celeste UTEC
  cyl: "E3F8FF",  // celeste muy claro (tarjetas)
  ink: "231F20",  // negro UTEC (texto)
  grl: "EEF1F4",  // gris claro
  grm: "B8C2CC",  // gris medio (barras secundarias)
  ye: "FDB913",   // amarillo UTEC
  ok: "1E9E5A",
  okl: "E3F5EA",
  bad: "D64545",
  rdl: "FDECEE",
  wh: "FFFFFF",
};
C.gr = C.ink;
C.cyd = C.ink;

const UI = "https://ricardoamiel.github.io/auditor-react/";
const REPO = "https://github.com/ricardoamiel/auditor-react";

// ---------- ayudas de composición ----------
const T = (text, x, y, w, h, o = {}) => ({ t: "text", text, x, y, w, h, ...o });
const B = (text, x, y, w, h, o = {}) => ({ t: "box", text, x, y, w, h, ...o });
const A = (x1, y1, x2, y2, o = {}) => ({ t: "arrow", x1, y1, x2, y2, ...o });
const I = (src, x, y, w, h, o = {}) => ({ t: "img", src, x, y, w, h, ...o });
const IC = (icon, x, y, d, o = {}) => ({ t: "icon", icon, x, y, d, ...o });

function card(x, y, w, h, icon, title, body, o = {}) {
  const fill = o.fill || C.cyl, step = o.step || 0, ic = o.ic || C.cy;
  const els = [B("", x, y, w, h, { fill, radius: 0.12, step, anim: o.anim })];
  let ty = y + 0.2;
  if (icon) { els.push(IC(icon, x + w / 2 - 0.36, y + 0.2, 0.72, { bg: ic, step, anim: o.anim })); ty = y + 1.02; }
  els.push(T(title, x + 0.12, ty, w - 0.24, 0.45, { size: o.ts || 18, bold: true, align: "center", step, anim: o.anim, mono: o.mono }));
  if (body) els.push(T(body, x + 0.15, ty + 0.48, w - 0.3, h - (ty - y) - 0.58, { size: o.bs || 15, align: "center", valign: "top", step, anim: o.anim }));
  return els;
}
// barra horizontal con su valor al final
function hbar(label, v, x, y, wmax, h, o = {}) {
  const step = o.step || 0, w = Math.max(0.04, wmax * v / (o.max || 1));
  return [
    T(label, x - (o.lw || 3.2) - 0.1, y, o.lw || 3.2, h, { size: o.ls || 16, align: "right", bold: !!o.lb, step }),
    B("", x, y, w, h, { fill: o.fill || C.cy, step, anim: "left" }),
    T(o.txt || v.toFixed(2), x + w + 0.08, y, 1.6, h, { size: o.vs || 17, bold: true, step }),
  ];
}
// barra vertical con su valor arriba
function vbar(v, x, base, hmax, w, o = {}) {
  const step = o.step || 0, h = Math.max(0.04, hmax * v / (o.max || 1));
  return [
    B("", x, base - h, w, h, { fill: o.fill || C.cy, step, anim: "up" }),
    T(o.txt || v.toFixed(2), x - 0.3, base - h - 0.45, w + 0.6, 0.42, { size: o.vs || 16, bold: true, align: "center", step }),
  ];
}
const big = (text, o = {}) => T(text, 0.8, 6.15, 11.73, 0.6, { size: 21, bold: true, align: "center", ...o });
const chip = (text, x, y, w, o = {}) => B(text, x, y, w, 0.4, { fill: C.ink, color: C.wh, size: 13, bold: true, radius: 0.06, anim: "pop", ...o });
function malBien(y, h, mal, bien, step, o = {}) {
  const wm = o.wm || 4.9;
  return [
    B(mal, 0.7, y, wm, h, { fill: C.rdl, size: o.size || 15, radius: 0.1, step }),
    A(0.7 + wm + 0.08, y + h / 2, 0.7 + wm + 0.52, y + h / 2, { step }),
    B(bien, 0.7 + wm + 0.6, y, 12.65 - (0.7 + wm + 0.6), h, { fill: C.okl, size: o.size || 15, radius: 0.1, step }),
  ];
}

const S = [];

// ================= Portada =================
S.push({
  kind: "cover",
  els: [
    T("AUDITOR REACT", 0.75, 1.45, 6.4, 0.95, { size: 46, bold: true }),
    T("Sistema multiagente con guardrails para\nhechos, matemáticas y código", 0.75, 2.4, 6.4, 1.0, { size: 21, bold: true }),
    T("Proyecto final · Procesamiento de Lenguaje Natural", 0.75, 3.55, 6.4, 0.45, { size: 16 }),
    T("Ricardo Acuña\nJuan Aquino\nJosué Velo", 0.75, 4.3, 6.4, 1.2, { size: 17, bold: true, valign: "top" }),
    T("Noviembre 2026", 0.75, 5.6, 6.4, 0.4, { size: 14 }),
  ],
  notes: "Presentamos Auditor ReAct, nuestro proyecto final: tres agentes que investigan, auditan y redactan respuestas sobre hechos, problemas de matemáticas y código. Vamos a contar cómo lo implementamos, qué encontramos al evaluarlo con honestidad y para qué casos conviene usarlo.",
});

// ================= Problema =================
S.push({
  title: "¿Qué problema resolvemos?",
  line: "Un RAG de un paso responde con lo primero que recupera",
  els: [
    ...card(0.8, 1.9, 3.7, 3.0, "FaMagnifyingGlass", "Falta evidencia", "La pregunta necesita dos documentos y la búsqueda trae uno", { step: 0 }),
    ...card(4.82, 1.9, 3.7, 3.0, "FaCalculator", "Hay que calcular", "El modelo hace la cuenta de memoria y puede equivocarse", { step: 1 }),
    ...card(8.84, 1.9, 3.7, 3.0, "FaCode", "Hay que ejecutar", "El código se entrega sin haber corrido sus tests", { step: 2 }),
    B("Idea: un agente que investiga con herramientas, otro que audita y otro que redacta", 1.3, 5.35, 10.73, 0.8, { fill: C.ink, color: C.wh, size: 20, bold: true, radius: 0.1, step: 3, anim: "pop" }),
  ],
  notes: "El punto de partida es el Naive RAG: recupera una vez y genera. Falla en tres situaciones. Cuando la respuesta necesita dos documentos y solo trae uno. Cuando hay que calcular y el modelo lo hace de memoria. Y cuando hay que entregar código que nunca se probó. Nuestra idea fue separar responsabilidades: un Investigador con herramientas, un Auditor que verifica y un Redactor.",
});

// ================= 01 Implementación =================
S.push({ kind: "section", num: "01.", icon: "FaDiagramProject", title: "Arquitectura e implementación", sub: "Grafo de agentes, ciclo ReAct, herramientas y datos",
  notes: "Primero, cómo está construido: la arquitectura, las herramientas y cómo procesamos los datos." });

// Grafo de agentes
const nodo = (t, x, y, w, h, o = {}) => B(t, x, y, w, h, { fill: o.fill || C.cyl, line: C.ink, lw: 1.5, size: 18, bold: true, radius: 0.12, step: o.step || 0, anim: "pop" });
const seg = (x, y, w, h, step) => B("", x, y, w, h, { fill: C.ink, step, anim: "fade" });
S.push({
  title: "Arquitectura: un grafo de estados",
  line: "LangGraph con tres agentes sobre Qwen2.5 7B en 4 bits (NF4)",
  els: [
    B("", 0.75, 4.12, 0.42, 0.42, { shape: "ellipse", fill: C.ink }),
    T("Inicio", 0.45, 4.6, 1.0, 0.35, { size: 13, align: "center" }),
    A(1.22, 4.33, 2.55, 4.33),
    nodo("Investigador", 2.6, 3.88, 2.5, 0.9, { fill: C.cy }),
    T("Thought, Action,\nObservation:\nhasta 6 pasos", 0.4, 2.65, 2.1, 1.0, { size: 13, align: "right", step: 1 }),

    nodo("Herramientas", 2.6, 1.75, 2.5, 0.8, { step: 1 }),
    A(3.35, 3.86, 3.35, 2.6, { step: 1 }),
    A(4.35, 2.6, 4.35, 3.86, { step: 1 }),
    T("buscar_kb\nbuscar_web\nejecutar_python", 5.3, 1.6, 2.6, 1.1, { size: 14, mono: true, valign: "middle", step: 1 }),

    A(5.15, 4.33, 6.45, 4.33, { step: 2 }),
    T("reporte", 5.1, 3.9, 1.4, 0.35, { size: 13, align: "center", step: 2 }),
    nodo("Auditor", 6.5, 3.88, 2.3, 0.9, { step: 2 }),
    seg(7.63, 4.8, 0.04, 0.75, 2),
    seg(3.85, 5.51, 3.82, 0.04, 2),
    A(3.87, 5.53, 3.87, 4.82, { step: 2 }),
    T("rechazo con motivo, máximo 2", 4.1, 5.6, 3.5, 0.4, { size: 14, bold: true, align: "center", step: 2 }),

    A(8.85, 4.33, 9.75, 4.33, { step: 3 }),
    T("aprobado", 8.65, 3.9, 1.3, 0.35, { size: 13, align: "center", step: 3 }),
    nodo("Redactor", 9.8, 3.88, 2.2, 0.9, { step: 3 }),
    T("respuesta con citas", 9.6, 4.85, 2.6, 0.4, { size: 13, align: "center", step: 3 }),
    A(12.05, 4.33, 12.35, 4.33, { step: 3 }),
    B("", 12.4, 4.12, 0.42, 0.42, { shape: "ellipse", fill: C.ink, step: 3 }),
    T("Fin", 12.1, 4.6, 1.0, 0.35, { size: 13, align: "center", step: 3 }),

    big("Estado: pregunta, traza, contextos, reporte y número de rechazos", { step: 4, size: 18, y: 6.25 }),
  ],
  notes: "Usamos un StateGraph de LangGraph y los tres agentes comparten Qwen2.5 7B cuantizado en 4 bits, unos cinco gigas de VRAM, así que corre en una T4. El Investigador piensa con el formato Thought, Action, Action Input. Si pide una acción, el nodo de herramientas la ejecuta: búsqueda en el índice FAISS, búsqueda web con DuckDuckGo o ejecución de Python, y devuelve la Observation; ese ciclo se repite hasta seis veces. Cuando escribe su Final Report, pasa al Auditor. El Auditor puede rechazar con un motivo y devolver el estado al Investigador, como máximo dos veces. Si aprueba, el Redactor escribe la respuesta citando las fuentes. Todo viaja en un estado compartido.",
});

// Traza ReAct real
const paso = (n, th, obs, okObs, y, step) => [
  chip(`Paso ${n}`, 0.7, y + 0.22, 1.1, { step }),
  B(th, 1.95, y, 5.0, 0.85, { fill: C.cyl, size: 15, radius: 0.1, align: "left", step, anim: "up" }),
  A(7.0, y + 0.42, 7.5, y + 0.42, { step }),
  B(obs, 7.55, y, 5.1, 0.85, { fill: okObs ? C.okl : C.rdl, size: 15, radius: 0.1, align: "left", step, anim: "up" }),
];
S.push({
  title: "El ciclo ReAct en una consulta real",
  line: "GSM8K: el Investigador se corrige leyendo cada Observation",
  els: [
    B("Sarah gastó $300 en libros de $15 y los repartió en partes iguales entre sus 4 hijos. ¿Cuántos recibió cada uno?", 0.7, 1.8, 11.95, 0.7, { fill: C.grl, size: 16, radius: 0.1 }),
    T("Thought y Action", 1.95, 2.6, 5.0, 0.35, { size: 14, bold: true }),
    T("Observation", 7.55, 2.6, 5.0, 0.35, { size: 14, bold: true }),
    ...paso(1, "Divido 300 entre 15 y luego entre 4\nAction: execute_python", "ERROR: la herramienta execute_python no existe", false, 3.0, 1),
    ...paso(2, "Uso la herramienta correcta\nAction: ejecutar_python", "El código se ejecutó sin imprimir nada; usa print", false, 4.0, 2),
    ...paso(3, "Agrego print al resultado\nAction: ejecutar_python", "5.0", true, 5.0, 3),
    big("Auditor: aprobado · Redactor: «Each child got 5 books. Final answer: 5»", { step: 4, size: 18, y: 6.05 }),
  ],
  notes: "Esta traza es real, de la evaluación. El modelo primero inventa el nombre de la herramienta y el sistema le responde con el error. Luego ejecuta sin imprimir y la observación le pide usar print. En el tercer paso obtiene 5. Lo importante es que los errores no rompen el flujo: se convierten en observaciones de las que el agente aprende dentro de la misma consulta.",
});

// Herramientas y datos
S.push({
  title: "Herramientas y base de conocimiento",
  line: "Índice FAISS con 10 758 documentos de los tres datasets",
  els: [
    ...card(0.8, 1.85, 3.7, 2.75, "FaDatabase", "buscar_kb", "FAISS por coseno con all MiniLM L6; devuelve los 3 más cercanos", { mono: true, ts: 17 }),
    ...card(4.82, 1.85, 3.7, 2.75, "FaGlobe", "buscar_web", "DuckDuckGo, con la API de Wikipedia como respaldo", { mono: true, ts: 17, step: 1 }),
    ...card(8.84, 1.85, 3.7, 2.75, "FaTerminal", "ejecutar_python", "Proceso aislado con límite de 10 segundos", { mono: true, ts: 17, step: 2 }),
    B("Un error de herramienta nunca rompe el flujo: vuelve al agente como Observation", 0.8, 4.95, 11.74, 0.8, { fill: C.grl, size: 17, bold: true, radius: 0.1, step: 3 }),
    T("herramienta inexistente · código sin print · timeout · búsqueda web caída", 0.8, 5.85, 11.74, 0.45, { size: 15, align: "center", mono: true, step: 3 }),
  ],
  notes: "El Investigador tiene tres herramientas. buscar_kb consulta un índice FAISS con embeddings normalizados, así que el producto interno es el coseno. buscar_web usa DuckDuckGo y cae a Wikipedia si falla. ejecutar_python corre el código en un proceso aislado con diez segundos de límite. Una decisión de diseño importante: cualquier error, sea una herramienta mal escrita, código que no imprime o un timeout, se devuelve como Observation, así el agente puede corregirse en el siguiente paso, como vimos en la traza.",
});

// Procesamiento de datos
const fila = (n, origen, transf, docs, evalq, y, step) => [
  B(`**${n}**`, 0.6, y, 1.5, 1.0, { fill: C.cy, size: 16, radius: 0.1, step, anim: "left" }),
  B(origen, 2.2, y, 2.65, 1.0, { fill: C.grl, size: 13, radius: 0.1, step, anim: "left" }),
  A(4.88, y + 0.5, 5.08, y + 0.5, { step }),
  B(transf, 5.1, y, 4.0, 1.0, { fill: C.cyl, size: 13, radius: 0.1, step, anim: "left" }),
  A(9.13, y + 0.5, 9.33, y + 0.5, { step }),
  B(docs, 9.35, y, 1.5, 1.0, { fill: C.cyl, size: 14, radius: 0.1, step, anim: "left" }),
  B(evalq, 10.95, y, 1.8, 1.0, { fill: C.okl, size: 13, radius: 0.1, step, anim: "left" }),
];
S.push({
  title: "Procesamiento de datos",
  line: "De tres datasets de Hugging Face a un índice de 10 758 documentos",
  els: [
    ...[["Origen", 2.2, 2.65], ["Transformación", 5.1, 4.0], ["Índice", 9.35, 1.5], ["Prueba", 10.95, 1.8]].map(([t, x, w]) => T(t, x, 1.72, w, 0.4, { size: 14, bold: true, align: "center" })),
    ...fila("WikiQA", "Pares pregunta y oración candidata (train, validation y test)", "Agrupa las oraciones por título del artículo, sin duplicados y en su orden", "**2 811**\nmed. 1 065 car.", "20 preguntas de test con respuesta", 2.15, 0),
    ...fila("GSM8K", "Problemas de primaria con solución paso a paso", "Problem y Worked solution de train; la respuesta oro es el número tras ####, sin comas", "**7 473**\nmed. 511 car.", "15 de test, fuera del índice", 3.3, 1),
    ...fila("MBPP", "Enunciado, función de referencia y 3 asserts", "Task y Solution de train, validation y prompt; tests y setup se guardan aparte", "**474**\nmed. 240 car.", "15 de test con sus asserts", 4.45, 2),
    B("Embeddings normalizados con all MiniLM L6 · FAISS IndexFlatIP (producto interno = coseno) · copia en int8 para la app web", 0.6, 5.65, 12.15, 0.7, { fill: C.ink, color: C.wh, size: 15, bold: true, radius: 0.1, step: 3, anim: "pop" }),
    T("Consultas elegidas con semilla 42 · 15 multisalto con el año verificado en el texto de cada artículo", 0.6, 6.4, 12.15, 0.4, { size: 14, align: "center", step: 3 }),
  ],
  notes: "Así procesamos los datos. WikiQA viene como pares de pregunta y oración candidata; los agrupamos por título y armamos un artículo por título, sin oraciones repetidas: 2 811 documentos. De GSM8K indexamos los problemas de entrenamiento con su solución, y de la prueba sacamos el número final que viene después de los cuatro numerales. De MBPP indexamos enunciado y solución, y guardamos los tests aparte porque el Auditor los ejecuta. Los documentos son cortos, así que cada uno es un solo vector, sin trocear. Las consultas de GSM8K y MBPP salen del split de test y no están en el índice. Para la aplicación web exportamos los mismos vectores cuantizados a int8.",
});

// Auditor
S.push({
  title: "El Auditor: dos guardrails",
  line: "Revisa el reporte antes de que llegue al usuario",
  els: [
    ...card(0.8, 1.85, 5.75, 2.35, "FaListCheck", "Determinista", "En código ejecuta los tests de MBPP y devuelve el assert que falla", { bs: 16 }),
    ...card(6.78, 1.85, 5.75, 2.35, "FaScaleBalanced", "Semántico", "El LLM contrasta el reporte con las observaciones: APROBADO o RECHAZADO con motivo", { bs: 16, step: 1 }),
    T("Lo que aprendimos al compararlo", 0.7, 4.35, 12, 0.45, { size: 18, bold: true, step: 2 }),
    ...malBien(4.85, 1.15, "**Auditor v1**\n«Revisa tu respuesta»: el agente reintenta a ciegas", "**Auditor v2**\n«Falla el test assert ... Corrige la función y pruébala con ejecutar_python antes de reportar»", 2, { wm: 4.6 }),
  ],
  notes: "El Auditor combina dos guardrails. Uno determinista: si la tarea es código, corre los tests y devuelve exactamente el assert que falla. Otro semántico: el modelo compara el reporte con lo que realmente observó y decide aprobar o rechazar con un motivo. La primera versión rechazaba con mensajes genéricos y el agente reintentaba sin rumbo; la segunda le da el error concreto y una instrucción para probar antes de reportar.",
});

// Modelos y cómputo
S.push({
  title: "Modelos y cómputo",
  line: "Todo con modelos abiertos y reproducible desde un notebook",
  els: [
    ...card(0.6, 1.85, 2.9, 3.4, "FaRobot", "Orquestador", "Qwen2.5 7B Instruct en 4 bits NF4, unos 5 GB de VRAM", { bs: 15 }),
    ...card(3.7, 1.85, 2.9, 3.4, "FaVectorSquare", "Embeddings", "all MiniLM L6 v2, elegido por ablación", { bs: 15, step: 1 }),
    ...card(6.8, 1.85, 2.9, 3.4, "FaGavel", "Juez", "Phi 4, distinto del orquestador para no evaluarse a sí mismo", { bs: 15, step: 2 }),
    ...card(9.9, 1.85, 2.9, 3.4, "FaServer", "Hardware", "RTX A6000 en Khipu con SLURM; el notebook corre en una T4 de Colab", { bs: 15, step: 3 }),
    big("Checkpoints por consulta: cada corrida se reanuda donde quedó", { step: 4, size: 18, y: 5.75 }),
  ],
  notes: "Usamos Qwen2.5 7B cuantizado en 4 bits, que entra en unos cinco gigas, así que el notebook funciona en una T4 de Colab. Para los embeddings elegimos all MiniLM L6 con una ablación que mostramos luego. El juez es Phi 4, un modelo de otra familia, para que el sistema no se califique a sí mismo. La evaluación completa corrió en una A6000 del clúster Khipu, con checkpoints por consulta.",
});

// ================= 02 Evaluación =================
S.push({ kind: "section", num: "02.", icon: "FaFlask", title: "Pipeline de evaluación", sub: "50 consultas, métricas RAGAS, juez externo y ablaciones",
  notes: "Ahora, cómo medimos." });

S.push({
  title: "Diseño experimental",
  line: "Cinco sistemas sobre las mismas 50 consultas",
  els: [
    T("Consultas", 0.7, 1.8, 5.2, 0.45, { size: 18, bold: true }),
    B("WikiQA\n20", 0.7, 2.35, 2.2, 1.0, { fill: C.cy, size: 16, bold: true }),
    B("GSM8K\n15", 2.95, 2.35, 1.65, 1.0, { fill: C.cyl, size: 16, bold: true }),
    B("MBPP\n15", 4.65, 2.35, 1.65, 1.0, { fill: C.grl, size: 16, bold: true }),
    B("+ 15 multisalto creadas por nosotros: dos documentos y un cálculo", 0.7, 3.5, 5.6, 0.8, { fill: C.wh, line: C.cy, lw: 2, size: 15, radius: 0.1, step: 1 }),
    T("Sistemas", 0.7, 4.5, 5.2, 0.45, { size: 18, bold: true, step: 2 }),
    T("Multiagente 7B · Naive RAG 7B\nMultiagente sin Auditor 7B\nMultiagente 1.5B · Naive RAG 1.5B", 0.7, 4.95, 5.7, 1.2, { size: 15, valign: "top", step: 2 }),

    T("Métricas", 6.9, 1.8, 5.7, 0.45, { size: 18, bold: true, step: 3 }),
    B("**Faithfulness**\nfracción de afirmaciones de la respuesta respaldadas por el contexto", 6.9, 2.35, 5.75, 1.05, { fill: C.cyl, size: 15, radius: 0.1, align: "left", step: 3 }),
    B("**Answer Relevance**\nsimilitud entre la pregunta y 3 preguntas generadas desde la respuesta", 6.9, 3.55, 5.75, 1.05, { fill: C.cyl, size: 15, radius: 0.1, align: "left", step: 4 }),
    B("**Acierto**\nnúmero exacto en GSM8K, tests en MBPP y juez contra la referencia en WikiQA", 6.9, 4.75, 5.75, 1.05, { fill: C.grl, size: 15, radius: 0.1, align: "left", step: 5 }),
  ],
  notes: "Tomamos 50 consultas de prueba: 20 de WikiQA, 15 de GSM8K y 15 de MBPP, más 15 multisalto que armamos nosotros combinando dos artículos con años para obligar a buscar dos veces y restar. Comparamos cinco sistemas. Las métricas de RAGAS son Faithfulness, que mide si lo afirmado está en el contexto, y Answer Relevance, que mide si la respuesta contesta la pregunta. Además medimos acierto objetivo por tarea, que no depende del juez.",
});

// Pipeline de evaluación
const etapa = (n, f, d, out, x, step) => [
  chip(`${n}`, x, 1.85, 0.5, { step }),
  B(`**${f}**`, x, 2.35, 2.75, 0.6, { fill: C.cy, size: 15, mono: true, radius: 0.08, step, anim: "up" }),
  B(d, x, 3.0, 2.75, 1.25, { fill: C.cyl, size: 13, radius: 0.08, step, anim: "up" }),
  T(out, x, 4.3, 2.75, 0.5, { size: 12, mono: true, align: "center", step }),
];
S.push({
  title: "Pipeline de evaluación",
  line: "Cuatro etapas desacopladas; cada una lee la salida de la anterior",
  els: [
    ...etapa(1, "prepare_data.py", "Corpus, 50 consultas con semilla, índice FAISS y ablación de embeddings", "consultas_eval.json · index/", 0.6, 0),
    A(3.38, 3.6, 3.68, 3.6, { step: 1 }),
    ...etapa(2, "run_eval.py", "Los 5 sistemas: respuesta, traza, tiempo por nodo, tokens y métrica objetiva", "respuestas_*.jsonl", 3.72, 1),
    A(6.5, 3.6, 6.8, 3.6, { step: 2 }),
    ...etapa(3, "judge.py", "Phi 4: Faithfulness en dos pasos, Answer Relevance y corrección en WikiQA", "juez_*.jsonl", 6.84, 2),
    A(9.62, 3.6, 9.92, 3.6, { step: 3 }),
    ...etapa(4, "figures.py", "Tabla comparativa, 8 figuras y las tablas del paper, siempre desde los JSONL", "tabla_comparativa.csv · figures/", 9.96, 3),
    ...card(0.6, 4.95, 3.9, 1.5, null, "Juez de otra familia", "Phi 4 califica a Qwen: el sistema no se evalúa a sí mismo", { step: 4, ts: 16, bs: 14 }),
    ...card(4.72, 4.95, 3.9, 1.5, null, "Métricas sin juez", "Número exacto, tests ejecutados y documento oro recuperado", { step: 4, ts: 16, bs: 14 }),
    ...card(8.84, 4.95, 3.9, 1.5, null, "Checkpoints", "Un corte del job en SLURM no pierde ninguna consulta", { step: 4, ts: 16, bs: 14 }),
  ],
  notes: "El pipeline tiene cuatro etapas que se comunican solo por archivos. prepare_data arma el corpus, elige las consultas y construye el índice. run_eval corre los cinco sistemas y guarda respuesta, traza, tiempos y la métrica objetiva de cada consulta. judge usa Phi 4 para Faithfulness, que primero extrae afirmaciones y luego verifica cada una, y para Answer Relevance. figures genera la tabla, las figuras y las tablas del paper directamente desde esos archivos, así ningún número se copia a mano. Tres garantías: el juez es de otra familia, hay métricas que no dependen del juez y todo se reanuda desde el último checkpoint.",
});

S.push({
  title: "Validamos también el evaluador",
  line: "Errores que encontramos y corregimos antes de reportar",
  els: [
    ...malBien(1.85, 1.0, "**Juez**: generaba preguntas en español para consultas en inglés", "Prompts del juez en inglés y Faithfulness en dos pasos, como RAGAS", 0),
    ...malBien(3.05, 1.0, "**Extractor**: leía la cita [1] como la respuesta numérica", "Se quitan las citas antes de extraer: GSM8K pasa de 0.73 a 1.00", 1),
    ...malBien(4.25, 1.0, "**Parser**: un turno sin Action se volvía una acción inválida", "Un turno sin Action cuenta como reporte final", 2),
    big("Validar el evaluador es tan importante como validar el sistema", { step: 3, y: 5.55 }),
  ],
  notes: "Antes de mirar resultados auditamos la propia evaluación. El juez generaba preguntas en español y castigaba la relevancia; lo pasamos a inglés y separamos la extracción de afirmaciones de su verificación. El extractor de números tomaba la cita entre corchetes como respuesta, lo que escondía un 1.00 en GSM8K. Y el parser convertía un turno sin acción en una acción inválida. Todo está registrado en PROGRESO.md y los resultados descartados se conservan.",
});

S.push({
  title: "Ablación de recuperación",
  line: "Hit@1 sobre las preguntas de WikiQA con respuesta",
  els: [
    ...hbar("Multilingüe MiniLM L12", 0.82, 4.4, 2.1, 6.2, 0.7, { fill: C.grm, lw: 3.4, txt: "0.82 · 17 ms" }),
    ...hbar("all MiniLM L6", 0.96, 4.4, 3.1, 6.2, 0.7, { fill: C.cy, lw: 3.4, lb: true, txt: "0.96 · 11 ms", step: 1 }),
    ...hbar("bge small en v1.5", 0.98, 4.4, 4.1, 6.2, 0.7, { fill: C.grm, lw: 3.4, txt: "0.98 · 23 ms", step: 2 }),
    big("Elegimos all MiniLM L6: casi igual que bge y el doble de rápido", { step: 3, y: 5.35 }),
  ],
  notes: "Probamos tres modelos de embeddings. El multilingüe del laboratorio rinde 0.82 porque las preguntas están en inglés. bge small llega a 0.98 pero tarda el doble por consulta. all MiniLM L6 queda en 0.96 con 11 milisegundos, así que es el mejor balance para producción.",
});

// ================= 03 Hallazgos =================
S.push({ kind: "section", num: "03.", icon: "FaLightbulb", title: "Análisis de resultados", sub: "Dónde gana, si la diferencia es real y por qué falla",
  notes: "Vamos a los resultados, y sobre todo a cómo los interpretamos." });

const sis = [["Multiagente 7B", 0.78, 0.84, 0.68, 44.6, C.cy], ["Naive RAG 7B", 0.78, 0.91, 0.72, 4.8, C.ink], ["Multiagente sin Auditor 7B", 0.74, 0.84, 0.68, 38.6, C.grm], ["Multiagente 1.5B", 0.48, 0.47, 0.44, 49.4, C.grm], ["Naive RAG 1.5B", 0.50, 0.78, 0.64, 3.8, C.grm]];
S.push({
  title: "Resultado principal",
  line: "Las 50 consultas: acierto, métricas RAGAS y latencia",
  els: [
    T("Acierto", 3.9, 1.75, 2.0, 0.4, { size: 14, bold: true }),
    T("Faithfulness", 8.75, 1.75, 1.4, 0.4, { size: 14, bold: true, align: "center" }),
    T("Answer\nRelevance", 10.15, 1.6, 1.3, 0.65, { size: 14, bold: true, align: "center" }),
    T("Segundos", 11.45, 1.75, 1.2, 0.4, { size: 14, bold: true, align: "center" }),
    ...sis.flatMap(([n, a, f, r, s, col], i) => [
      ...hbar(n, a, 3.9, 2.25 + i * 0.68, 3.9, 0.5, { fill: col, lw: 3.3, ls: 15, lb: i < 2, step: i < 2 ? 0 : 1 }),
      T(f.toFixed(2), 8.75, 2.25 + i * 0.68, 1.4, 0.5, { size: 16, align: "center", step: i < 2 ? 0 : 1 }),
      T(r.toFixed(2), 10.15, 2.25 + i * 0.68, 1.3, 0.5, { size: 16, align: "center", step: i < 2 ? 0 : 1 }),
      T(s.toFixed(1), 11.45, 2.25 + i * 0.68, 1.2, 0.5, { size: 16, align: "center", step: i < 2 ? 0 : 1 }),
    ]),
    big("Empate en 0.78: estas preguntas se resuelven con una sola recuperación", { step: 2, y: 5.85 }),
    T("El documento correcto aparece entre los 3 primeros en el 99 % de los casos", 0.8, 6.4, 11.73, 0.4, { size: 15, align: "center", step: 2 }),
  ],
  notes: "Este es el resultado que no esperábamos. En las 50 consultas el multiagente y el Naive RAG empatan en 0.78, y el Naive es algo más fiel y relevante según RAGAS: 0.91 y 0.72 contra 0.84 y 0.68. La explicación está en la recuperación: el documento correcto sale entre los tres primeros casi siempre, así que un solo paso alcanza. Quitar el Auditor baja a 0.74. Con el modelo de 1.5B todo cae. Preferimos reportar este empate en vez de ajustar el sistema sobre el conjunto de prueba.",
});

const tareas = [["WikiQA", 0.80, 0.85], ["GSM8K", 1.00, 1.00], ["MBPP", 0.53, 0.47]];
S.push({
  title: "Acierto por tarea",
  line: "Multiagente 7B frente a Naive RAG 7B",
  els: [
    B("", 1.2, 5.3, 10.9, 0.03, { fill: C.ink }),
    ...tareas.flatMap(([n, m, nv], i) => {
      const x = 1.9 + i * 3.6;
      return [
        ...vbar(m, x, 5.3, 3.0, 1.1, { fill: C.cy, step: i }),
        ...vbar(nv, x + 1.25, 5.3, 3.0, 1.1, { fill: C.ink, step: i }),
        T(n, x - 0.2, 5.4, 2.75, 0.45, { size: 18, bold: true, align: "center", step: i }),
      ];
    }),
    B("", 9.3, 1.8, 0.3, 0.3, { fill: C.cy }), T("Multiagente", 9.65, 1.72, 1.6, 0.45, { size: 14 }),
    B("", 11.1, 1.8, 0.3, 0.3, { fill: C.ink }), T("Naive", 11.45, 1.72, 1.2, 0.45, { size: 14 }),
    big("Gana donde ejecuta y verifica: en código", { step: 3, y: 6.05 }),
  ],
  notes: "Por tarea se ve dónde aporta. En WikiQA el Naive es un poco mejor, porque el multiagente a veces busca en la web y se desvía. En GSM8K ambos llegan a 1.00 una vez corregido el extractor del número. En MBPP el multiagente gana porque ejecuta los tests antes de entregar el código.",
});

const fiel = [["WikiQA", 0.91, 0.92], ["GSM8K", 0.83, 1.00], ["MBPP", 0.74, 0.82]];
S.push({
  title: "¿De dónde sale la brecha de fidelidad?",
  line: "Faithfulness por tarea, multiagente 7B frente a Naive RAG 7B",
  els: [
    B("", 1.2, 5.0, 7.0, 0.03, { fill: C.ink }),
    ...fiel.flatMap(([n, m, nv], i) => {
      const x = 1.6 + i * 2.3;
      return [
        ...vbar(m, x, 5.0, 2.7, 0.85, { fill: C.cy, step: i }),
        ...vbar(nv, x + 0.95, 5.0, 2.7, 0.85, { fill: C.ink, step: i }),
        T(n, x - 0.2, 5.1, 2.2, 0.45, { size: 17, bold: true, align: "center", step: i }),
      ];
    }),
    B("", 1.6, 1.72, 0.28, 0.28, { fill: C.cy }), T("Multiagente", 1.95, 1.64, 1.6, 0.45, { size: 14 }),
    B("", 3.7, 1.72, 0.28, 0.28, { fill: C.ink }), T("Naive", 4.05, 1.64, 1.2, 0.45, { size: 14 }),
    B("**En hechos empatan**\n0.91 frente a 0.92", 8.75, 1.85, 3.95, 1.0, { fill: C.grl, size: 15, radius: 0.1, step: 1 }),
    B("**En cálculo y código** lo que salió de ejecutar Python no está en los documentos y el juez no lo da por respaldado", 8.75, 3.0, 3.95, 1.25, { fill: C.rdl, size: 15, radius: 0.1, step: 2 }),
    B("**Fue a la web en el 75 % de WikiQA** aunque el documento correcto ya estaba en la base", 8.75, 4.4, 3.95, 1.25, { fill: C.rdl, size: 15, radius: 0.1, step: 3 }),
    big("La fidelidad baja por lo que el multiagente calcula, no por lo que inventa", { step: 4, y: 6.1, size: 19 }),
  ],
  notes: "La Faithfulness del multiagente es menor, pero vale la pena ver dónde. En hechos de WikiQA es la misma: 0.91 contra 0.92. La brecha está en matemáticas y código, donde la respuesta afirma totales calculados con Python o describe el código que escribió; nada de eso está en los documentos recuperados, así que el juez lo cuenta como no respaldado aunque sea correcto. Además el Investigador fue a la web en tres de cada cuatro preguntas de WikiQA aunque ya tenía el documento, lo que suma tiempo y fuentes que pueden contradecir la referencia.",
});

S.push({
  title: "Consultas multisalto",
  line: "15 preguntas que exigen dos documentos y una resta",
  els: [
    T("0.93", 1.0, 1.9, 3.3, 1.3, { size: 72, bold: true, align: "center", color: C.cy }),
    T("Multiagente", 1.0, 3.15, 3.3, 0.45, { size: 18, bold: true, align: "center" }),
    T("0.53", 4.4, 1.9, 3.3, 1.3, { size: 72, bold: true, align: "center" }),
    T("Naive RAG", 4.4, 3.15, 3.3, 0.45, { size: 18, bold: true, align: "center" }),
    T("Ambos documentos recuperados: 0.80 frente a 0.27", 1.0, 3.75, 6.7, 0.5, { size: 17, align: "center", step: 1 }),
    B("**¿Cuántos años pasaron entre la apertura de Central Park y la de Kennywood?**", 8.1, 1.85, 4.6, 1.05, { fill: C.grl, size: 15, radius: 0.1, step: 2 }),
    B("**Multiagente**\nbusca Central Park: 1857\nbusca Kennywood: 1898\nejecuta 1898 menos 1857\nFinal answer: 41", 8.1, 3.05, 4.6, 1.75, { fill: C.okl, size: 15, radius: 0.1, step: 2 }),
    B("**Naive RAG**\n«No hay información suficiente para calcularlo»", 8.1, 4.95, 4.6, 0.95, { fill: C.rdl, size: 15, radius: 0.1, step: 3 }),
    big("Todos los fallos del Naive ocurren cuando su única búsqueda pierde un documento", { step: 4, y: 6.15, size: 18, w: 7.0, x: 0.8 }),
  ],
  notes: "Para probar la hipótesis armamos 15 preguntas que obligan a combinar dos artículos. Aquí el multiagente casi duplica el acierto: 0.93 contra 0.53. La razón es que hace dos búsquedas y recupera ambos documentos en el 80 % de los casos, contra 27 % del Naive. En el ejemplo, el Naive solo trae uno de los dos artículos y responde que no tiene información.",
});

// Comparación pareada: solo cuentan las consultas donde los sistemas discrepan
const pares = [
  ["50 consultas", "Multiagente frente a Naive RAG", 4, 4, "IC 95 % de la diferencia: −0.12 a 0.10", "Empate", C.grl],
  ["15 multisalto", "Multiagente frente a Naive RAG", 6, 0, "Prueba del signo: p = 0.03", "Gana el multiagente", C.okl],
  ["50 consultas", "Con Auditor frente a sin Auditor", 3, 1, "Prueba del signo: p = 0.63", "No concluyente", C.grl],
  ["50 consultas", "Naive RAG 7B frente a 1.5B", 14, 0, "Prueba del signo: p < 0.001", "Pesa el modelo", C.okl],
];
S.push({
  title: "¿Las diferencias son reales?",
  line: "Comparación pregunta por pregunta: solo cuentan los casos en que discrepan",
  els: [
    T("Solo acierta\nel primero", 5.0, 1.65, 1.6, 0.7, { size: 13, bold: true, align: "center" }),
    T("Solo acierta\nel segundo", 6.7, 1.65, 1.6, 0.7, { size: 13, bold: true, align: "center" }),
    ...pares.flatMap(([q, c, a, b, test, v, fill], i) => {
      const y = 2.45 + i * 0.95, step = i;
      return [
        B(`**${c}**\n${q}`, 0.6, y, 4.25, 0.8, { fill: C.cyl, size: 14, radius: 0.08, align: "left", step, anim: "left" }),
        T(String(a), 5.0, y, 1.6, 0.8, { size: 30, bold: true, align: "center", color: a > b ? C.cy : C.ink, step }),
        T(String(b), 6.7, y, 1.6, 0.8, { size: 30, bold: true, align: "center", step }),
        T(test, 8.4, y, 2.6, 0.8, { size: 13, step }),
        B(`**${v}**`, 11.0, y + 0.1, 1.75, 0.6, { fill, size: 13, radius: 0.08, step, anim: "pop" }),
      ];
    }),
    big("Con 50 consultas solo dos efectos son claros: la descomposición en multisalto y el tamaño del modelo", { step: 4, y: 6.3, size: 17 }),
  ],
  notes: "Con muestras chicas hay que preguntarse si las diferencias son reales. Como los sistemas responden las mismas preguntas, las comparamos pregunta por pregunta y solo miramos los casos en que uno acierta y el otro no. En las 50 consultas el multiagente y el Naive discrepan en ocho preguntas, cuatro para cada uno: el intervalo de la diferencia va de menos 0.12 a 0.10, es un empate. En multisalto el multiagente gana seis a cero, con p de 0.03. El Auditor gana tres a uno, que todavía no es concluyente. Y el salto de 1.5B a 7B es catorce a cero: el modelo pesa más que la arquitectura.",
});

S.push({
  title: "Ablación del Auditor en código",
  line: "Tests de MBPP aprobados con Qwen2.5 7B",
  els: [
    ...hbar("Sin Auditor", 0.47, 3.8, 2.0, 5.5, 0.62, { fill: C.grm, txt: "0.47 · 35 s" }),
    ...hbar("Auditor v1 genérico", 0.47, 3.8, 2.85, 5.5, 0.62, { fill: C.grm, txt: "0.47 · 82 s", step: 1 }),
    ...hbar("Auditor v2 accionable", 0.53, 3.8, 3.7, 5.5, 0.62, { fill: C.cy, lb: true, txt: "0.53 · 53 s", step: 2 }),
    T("Rechazos promedio: 1.93 con v1 y 1.00 con v2", 0.8, 4.55, 11.73, 0.45, { size: 16, align: "center", step: 2 }),
    big("Rechazar sin decir qué falla solo cuesta tiempo", { step: 3, y: 5.3 }),
  ],
  notes: "Comparamos dos versiones del Auditor solo en código. La primera rechazaba casi dos veces por consulta, duplicaba el tiempo y no mejoraba nada. La segunda devuelve el assert que falla y pide probar antes de reportar: sube a 0.53, rechaza la mitad de veces y es más rápida. Un guardrail útil tiene que dar retroalimentación accionable.",
});

const fallas = [
  [7, "MBPP: el Auditor detectó el test que falla y se agotaron los 2 reintentos", C.cy],
  [3, "WikiQA: respuesta parcial o especulativa frente a la oración de referencia", C.grm],
  [1, "WikiQA: referencia desactualizada (Yankee Stadium: 1.5 mil millones; la web dice 2.3)", C.grm],
];
S.push({
  title: "Análisis de errores",
  line: "Las 11 consultas que falla el multiagente 7B",
  els: [
    ...fallas.flatMap(([n, t, col], i) => [
      B("", 0.6, 1.85 + i * 1.0, 0.42 * n, 0.5, { fill: col, step: i, anim: "left" }),
      T(String(n), 0.6 + 0.42 * n + 0.08, 1.85 + i * 1.0, 0.5, 0.5, { size: 20, bold: true, step: i }),
      T(t, 0.6, 2.38 + i * 1.0, 7.0, 0.4, { size: 13, step: i }),
    ]),
    T("7 de las 11 también las falla el Naive RAG", 0.6, 4.95, 6.6, 0.45, { size: 16, bold: true, step: 3 }),
    T("En GSM8K rechazó en 7 de 15 problemas y solo cambió el resultado en uno: ahí sobre todo suma tiempo", 0.6, 5.4, 6.8, 0.7, { size: 14, valign: "top", step: 3 }),

    T("El Auditor como detector en MBPP", 7.6, 1.75, 5.1, 0.45, { size: 17, bold: true, align: "center", step: 4 }),
    T("Pasa los tests", 9.4, 2.25, 1.6, 0.5, { size: 13, bold: true, align: "center", step: 4 }),
    T("Falla", 11.1, 2.25, 1.6, 0.5, { size: 13, bold: true, align: "center", step: 4 }),
    B("**Aprobado**", 7.6, 2.8, 1.7, 0.9, { fill: C.cyl, size: 14, radius: 0.08, step: 4 }),
    B("**8**", 9.4, 2.8, 1.6, 0.9, { fill: C.okl, size: 26, radius: 0.08, step: 4 }),
    B("0", 11.1, 2.8, 1.6, 0.9, { fill: C.grl, size: 26, radius: 0.08, step: 4 }),
    B("**Rechazado 2 veces**", 7.6, 3.8, 1.7, 0.9, { fill: C.cyl, size: 14, radius: 0.08, step: 4 }),
    B("0", 9.4, 3.8, 1.6, 0.9, { fill: C.grl, size: 26, radius: 0.08, step: 4 }),
    B("**7**", 11.1, 3.8, 1.6, 0.9, { fill: C.rdl, size: 26, radius: 0.08, step: 4 }),
    B("Su veredicto acierta 15 de 15: puede avisar «no verificado» en vez de entregar código que falla", 7.6, 4.9, 5.1, 1.1, { fill: C.ink, color: C.wh, size: 15, bold: true, radius: 0.1, step: 5, anim: "pop" }),
  ],
  notes: "Revisamos una por una las 11 consultas que falla el multiagente. Siete son de código: en todas el Auditor encontró el test que falla y lo devolvió dos veces, pero el Investigador no logró corregirlo. Tres de WikiQA son respuestas parciales, por ejemplo decir solo cristianismo cuando la referencia dice cristianismo o islam. Y una es la referencia vieja del Yankee Stadium. Siete de estas once también las falla el Naive, así que son las preguntas difíciles del conjunto. Lo más útil está a la derecha: en código, todo lo que el Auditor aprobó pasa los tests y todo lo que rechazó dos veces falla. Ese veredicto se podría mostrar al usuario como una advertencia. En matemáticas, en cambio, rechazó en siete problemas y solo en uno cambió el resultado frente a no tener Auditor.",
});

S.push({
  title: "El costo: latencia",
  line: "Segundos promedio por consulta",
  els: [
    ...hbar("Naive RAG 7B", 4.8, 3.6, 2.0, 8.2, 0.6, { fill: C.ink, max: 45, txt: "4.8 s" }),
    T("Multiagente 7B", 0.3, 2.9, 3.2, 0.6, { size: 16, align: "right", step: 1 }),
    B("Investigador 33.2", 3.6, 2.9, 8.2 * 33.2 / 45, 0.6, { fill: C.cy, size: 14, bold: true, step: 1, anim: "left" }),
    B("", 3.6 + 8.2 * 33.2 / 45, 2.9, 8.2 * 7.0 / 45, 0.6, { fill: C.grm, step: 2, anim: "left" }),
    B("", 3.6 + 8.2 * 40.2 / 45, 2.9, 8.2 * 4.4 / 45, 0.6, { fill: C.ye, step: 2, anim: "left" }),
    T("44.6 s", 11.85, 2.9, 1.2, 0.6, { size: 17, bold: true, step: 1 }),
    B("", 3.6, 3.75, 0.3, 0.3, { fill: C.cy, step: 2 }), T("Investigador 33.2 s", 3.95, 3.67, 2.6, 0.45, { size: 14, step: 2 }),
    B("", 6.6, 3.75, 0.3, 0.3, { fill: C.grm, step: 2 }), T("Herramientas 7.0 s", 6.95, 3.67, 2.6, 0.45, { size: 14, step: 2 }),
    B("", 9.6, 3.75, 0.3, 0.3, { fill: C.ye, step: 2 }), T("Auditor y Redactor 4.4 s", 9.95, 3.67, 3.0, 0.45, { size: 14, step: 2 }),
    big("Nueve veces más lento: el 75 % del tiempo es el Investigador generando", { step: 3, y: 4.6 }),
    T("Con 1.5B el agente ignora el formato de las herramientas e inventa datos: acierto 0.48 contra 0.50 del Naive", 0.8, 5.35, 11.73, 0.8, { size: 16, align: "center", step: 4 }),
  ],
  notes: "La calidad se paga en latencia: 45 segundos contra 5. Tres cuartas partes del tiempo son el Investigador generando pensamientos; las herramientas y el Auditor pesan poco. También probamos un orquestador de 1.5B: no sigue el formato de las acciones e inventa datos, así que la arquitectura multiagente necesita un modelo con capacidad suficiente.",
});

// ================= 04 Casos de uso y demo =================
S.push({ kind: "section", num: "04.", icon: "FaRocket", title: "Casos de uso y demo", sub: "Cuándo conviene y cómo probarlo",
  notes: "Por último, para qué sirve y cómo se usa." });

S.push({
  title: "Casos de uso",
  line: "Donde la respuesta se puede verificar o necesita varias fuentes",
  els: [
    ...card(0.6, 1.85, 2.9, 3.6, "FaCode", "Asistente de código", "Entrega funciones que ya pasaron sus tests", { ts: 16, bs: 15 }),
    ...card(3.7, 1.85, 2.9, 3.6, "FaFileLines", "Preguntas compuestas", "Cruza documentos internos, por ejemplo normativa o reportes financieros", { ts: 16, bs: 15, step: 1 }),
    ...card(6.8, 1.85, 2.9, 3.6, "FaCalculator", "Tutor de matemáticas", "Calcula con Python en vez de hacerlo de memoria", { ts: 16, bs: 15, step: 2 }),
    ...card(9.9, 1.85, 2.9, 3.6, "FaShieldHalved", "Auditoría de hechos", "Rechaza afirmaciones sin respaldo en la evidencia", { ts: 16, bs: 15, step: 3 }),
    big("Cada respuesta llega con su traza y sus fuentes", { step: 4, y: 5.85 }),
  ],
  notes: "Los casos de uso naturales son aquellos donde la respuesta se puede comprobar o requiere juntar varias fuentes: un asistente de programación que entrega código probado, preguntas que cruzan documentos internos, un tutor que calcula en vez de adivinar y un verificador de hechos. En todos, la traza y las citas permiten auditar al propio sistema.",
});

S.push({
  title: "Recomendación para producción: enrutar",
  line: "Rápido por defecto, el grafo completo cuando la pregunta lo exige",
  els: [
    B("Consulta", 0.7, 3.35, 2.0, 0.9, { fill: C.grl, size: 18, bold: true, radius: 0.12 }),
    A(2.75, 3.8, 3.55, 3.8),
    B("¿Compuesta, cálculo\no código?", 3.6, 2.85, 3.0, 1.9, { shape: "diamond", fill: C.ink, color: C.wh, size: 15, bold: true, step: 1, anim: "pop" }),
    A(6.6, 3.5, 7.75, 2.55, { step: 2 }), T("no", 6.85, 2.55, 0.8, 0.4, { size: 14, bold: true, step: 2 }),
    B("**Naive RAG**\nuna búsqueda y una llamada · 5 s", 7.8, 1.95, 4.8, 1.15, { fill: C.cyl, size: 16, radius: 0.12, step: 2 }),
    A(6.6, 4.1, 7.75, 5.05, { step: 3 }), T("sí", 6.85, 4.75, 0.8, 0.4, { size: 14, bold: true, step: 3 }),
    B("**Multiagente con Auditor**\nherramientas, verificación y citas · 45 s", 7.8, 4.5, 4.8, 1.15, { fill: C.cy, size: 16, radius: 0.12, step: 3 }),
    big("Así se obtiene el acierto del multiagente sin pagar su latencia en todas las consultas", { step: 4, y: 6.0, size: 18 }),
  ],
  notes: "Nuestra recomendación es no usar el grafo para todo. Un enrutador decide: si la pregunta es directa, Naive RAG en cinco segundos; si es compuesta, pide un cálculo o código, el multiagente con Auditor. La aplicación web permite elegir el modo justamente para mostrar esa diferencia.",
});

S.push({
  title: "Demo: la aplicación web",
  line: "Grafo en vivo con D3, línea de tiempo por agente y evidencia recuperada",
  els: [
    I("app.png", 0.6, 1.75, 6.9, 4.31, { fit: "contain" }),
    B("", 0.6, 1.75, 6.9, 4.31, { fill: "none", line: C.grm, lw: 1 }),
    ...[["FaLaptop", "En el navegador", "Qwen2.5 1.5B con WebGPU, sin servidor"], ["FaServer", "Con servidor", "API en Python con el modelo 7B"], ["FaRoute", "Tres modos", "Multiagente, sin Auditor y Naive RAG"]].flatMap(([ic, t, d], i) => [
      IC(ic, 7.85, 1.85 + i * 1.12, 0.7, { step: i }),
      T(t, 8.7, 1.8 + i * 1.12, 4.2, 0.42, { size: 17, bold: true, step: i }),
      T(d, 8.7, 2.18 + i * 1.12, 4.2, 0.42, { size: 14, step: i }),
    ]),
    B("", 7.85, 5.3, 4.85, 0.85, { fill: C.ink, radius: 0.1, step: 3, anim: "pop" }),
    T("ricardoamiel.github.io/auditor-react", 7.9, 5.3, 4.75, 0.85, { size: 17, bold: true, color: C.wh, align: "center", link: UI, step: 3 }),
    T("Código, notebook y paper: github.com/ricardoamiel/auditor-react", 0.6, 6.25, 12.1, 0.45, { size: 15, align: "center", link: REPO, step: 3 }),
  ],
  notes: "La aplicación está publicada en GitHub Pages. Puede correr el modelo de 1.5B directamente en el navegador con WebGPU, o conectarse a un servidor con el 7B. Mientras responde, el grafo resalta el agente activo, la línea de tiempo muestra cuánto tarda cada paso y se listan los documentos recuperados. Aquí hacemos la demo en vivo con una pregunta de código y una multisalto.",
});

S.push({
  title: "Conclusiones",
  line: "",
  els: [
    ...[["FaScaleBalanced", "Más agentes no es más acierto por defecto", "En preguntas de un solo paso el Naive RAG empata y es 9 veces más rápido"], ["FaListCheck", "La verificación ejecutable es la que más rinde", "Tests y Python mejoran código y multisalto; el Auditor necesita dar el error concreto"], ["FaRoute", "Enrutar según la consulta", "Paso directo por defecto y el grafo completo para lo compuesto"]].flatMap(([ic, t, d], i) => [
      IC(ic, 0.9, 1.75 + i * 1.6, 1.0, { bg: i === 1 ? C.ink : C.cy, step: i }),
      T(t, 2.2, 1.7 + i * 1.6, 10.4, 0.6, { size: 25, bold: true, step: i }),
      T(d, 2.2, 2.3 + i * 1.6, 10.4, 0.5, { size: 17, step: i }),
    ]),
  ],
  notes: "Cerramos con tres ideas. Primero, agregar agentes no mejora por sí solo: en preguntas simples el Naive RAG empata y es mucho más rápido. Segundo, lo que más rinde es la verificación ejecutable: correr código y tests. Tercero, en producción conviene enrutar y reservar el grafo para las consultas que lo necesitan.",
});

S.push({ kind: "section", num: "?", icon: "FaComments", title: "¿Preguntas?", sub: "Gracias", notes: "Abrir preguntas." });
S.push({ kind: "close", notes: "" });

// Versión corta (unos 15 minutos): las escenas clave en orden; la completa queda para responder preguntas.
const CORTA = [
  "cover", "¿Qué problema resolvemos?", "Arquitectura: un grafo de estados", "El ciclo ReAct en una consulta real",
  "Procesamiento de datos", "El Auditor: dos guardrails", "Diseño experimental", "Pipeline de evaluación",
  "Resultado principal", "Consultas multisalto", "¿Las diferencias son reales?", "Análisis de errores",
  "Demo: la aplicación web", "Conclusiones", "¿Preguntas?", "close",
];
const elegir = (k) => S.find((sd) => (sd.title || sd.kind) === k && !(k === "Pipeline de evaluación" && sd.kind === "section"));
const S_CORTA = CORTA.map((k) => { const sd = elegir(k); if (!sd) throw new Error("No existe la escena " + k); return sd; });

module.exports = { C, S: process.env.VERSION === "corta" ? S_CORTA : S };
