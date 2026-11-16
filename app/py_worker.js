// Ejecuta Python con Pyodide fuera del hilo principal (herramienta ejecutar_python)
importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js");
const listo = loadPyodide();

onmessage = async (e) => {
  const py = await listo;
  const salida = [];
  py.setStdout({ batched: (s) => salida.push(s) });
  py.setStderr({ batched: (s) => salida.push(s) });
  try {
    await py.runPythonAsync(e.data.codigo);
    postMessage({ ok: true, out: salida.join("\n").slice(-1500) });
  } catch (err) {
    const msg = String(err).trim().split("\n").slice(-3).join("\n");
    postMessage({ ok: false, out: (salida.join("\n") + "\n" + msg).trim().slice(-1500) });
  }
};
