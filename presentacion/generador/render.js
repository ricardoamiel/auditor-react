// Genera, desde contenido.js, dos versiones de la presentación:
//   1) Presentacion_Auditor_ReAct.pptx  (cada clic es una diapositiva más: la animación es el paso de diapositiva)
//   2) Presentacion_Auditor_ReAct.html  (un solo archivo con animaciones por pasos; flechas o clic para avanzar)
// Uso: npm install && npm run build

const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const fa = require("react-icons/fa6");
const sharp = require("sharp");
const { C, S } = require("./contenido");

const ROOT = path.join(__dirname, "..");
const AS = path.join(ROOT, "assets");
const OUT_PPTX = path.join(ROOT, "Presentacion_Auditor_ReAct.pptx");
const OUT_HTML = path.join(ROOT, "Presentacion_Auditor_ReAct.html");
const W = 13.333, H = 7.5, PX = 144; // 1 pulgada = 144 px en un escenario de 1920 x 1080
const FONT = "Arial";
const MARGIN = 4; // pt

// ---------- utilidades comunes ----------
function parse(text) {
  // devuelve líneas, cada una con tramos {t, b}
  return String(text).split("\n").map((ln) => {
    const parts = ln.split(/(\*\*.+?\*\*)/).filter((p) => p !== "");
    return parts.map((p) => (p.startsWith("**") && p.endsWith("**") ? { t: p.slice(2, -2), b: true } : { t: p, b: false }));
  });
}
const maxStep = (els) => els.reduce((m, e) => Math.max(m, e.step || 0), 0);
function iconSvg(name, color) {
  const Comp = fa[name];
  if (!Comp) throw new Error("Ícono inexistente: " + name);
  return renderToStaticMarkup(React.createElement(Comp, { size: 256 })).replace(/currentColor/g, "#" + color);
}
const iconCache = {};
async function iconPng(name, color) {
  const k = name + color;
  if (!iconCache[k]) iconCache[k] = "image/png;base64," + (await sharp(Buffer.from(iconSvg(name, color))).resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()).toString("base64");
  return iconCache[k];
}
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ================= PPTX =================
async function buildPptx(soloFinal) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.title = "Auditor ReAct: sistema multiagente con guardrails";
  pres.author = "Ricardo Amiel Acuña Villogas, Juan Leibniz Aquino Espinoza y Josué Nehemías Velo Poma";
  pres.theme = { headFontFace: FONT, bodyFontFace: FONT };

  pres.defineSlideMaster({ title: "CONTENIDO", background: { color: C.wh }, objects: [{ image: { x: 0, y: 0, w: W, h: H, path: path.join(AS, "fondo_contenido.png") } }] });
  pres.defineSlideMaster({ title: "PORTADA", background: { path: path.join(AS, "fondo_portada.png") }, objects: [] });
  pres.defineSlideMaster({ title: "SECCION", background: { path: path.join(AS, "fondo_seccion.png") }, objects: [] });
  pres.defineSlideMaster({ title: "CIERRE", background: { path: path.join(AS, "fondo_cierre.png") }, objects: [] });

  const runs = (text, base) => {
    const lines = parse(text), out = [];
    lines.forEach((ln, li) => {
      const segs = ln.length ? ln : [{ t: " ", b: false }];
      segs.forEach((s, si) => out.push({ text: s.t, options: { bold: s.b || !!base.bold, breakLine: si === segs.length - 1 && li < lines.length - 1 } }));
    });
    return out;
  };
  const shapeOf = (e) => {
    if (e.shape === "chevron") return pres.shapes.CHEVRON;
    if (e.shape === "diamond") return pres.shapes.DIAMOND;
    if (e.shape === "ellipse") return pres.shapes.OVAL;
    return e.radius ? pres.shapes.ROUNDED_RECTANGLE : pres.shapes.RECTANGLE;
  };

  async function draw(slide, e) {
    if (e.t === "text") {
      slide.addText(e.link ? [{ text: e.text, options: { hyperlink: { url: e.link }, bold: !!e.bold } }] : runs(e.text, e), { x: e.x, y: e.y, w: e.w, h: e.h, fontFace: e.mono ? "Courier New" : FONT, fontSize: e.size || 16, color: e.color || C.ink, bold: !!e.bold, align: e.align || "left", valign: e.valign || "middle", margin: MARGIN, isTextBox: true, fit: "none" });
    } else if (e.t === "box") {
      const o = { x: e.x, y: e.y, w: e.w, h: e.h, shape: shapeOf(e) };
      if (e.radius && !e.shape) o.rectRadius = e.radius;
      o.fill = e.fill === "none" ? { color: C.wh, transparency: 100 } : { color: e.fill || C.cyl };
      o.line = e.line ? { color: e.line, width: e.lw || 1 } : { type: "none" };
      if (e.text) {
        slide.addText(runs(e.text, e), { ...o, fontFace: e.mono ? "Courier New" : FONT, fontSize: e.size || 16, color: e.color || C.ink, bold: !!e.bold, align: e.align || "center", valign: "middle", margin: e.shape === "chevron" ? [18, 2, 2, 2] : MARGIN });
      } else {
        slide.addShape(o.shape, o);
      }
    } else if (e.t === "arrow") {
      const dx = e.x2 - e.x1, dy = e.y2 - e.y1;
      slide.addShape(pres.shapes.LINE, { x: Math.min(e.x1, e.x2), y: Math.min(e.y1, e.y2), w: Math.abs(dx), h: Math.abs(dy), flipH: dx < 0, flipV: dy < 0, line: { color: e.color || C.cyd, width: e.w || 2.5, endArrowType: "triangle" } });
    } else if (e.t === "img") {
      slide.addImage({ path: path.join(AS, e.src), x: e.x, y: e.y, w: e.w, h: e.h, sizing: { type: e.fit || "cover", w: e.w, h: e.h } });
    } else if (e.t === "icon") {
      slide.addShape(pres.shapes.OVAL, { x: e.x, y: e.y, w: e.d, h: e.d, fill: { color: e.bg || C.cy }, line: { type: "none" } });
      const s = e.d * 0.52;
      slide.addImage({ data: await iconPng(e.icon, e.fg || (e.bg === C.ye || e.bg === C.cy ? C.ink : C.wh)), x: e.x + (e.d - s) / 2, y: e.y + (e.d - s) / 2, w: s, h: s });
    }
  }

  let n = 0;
  for (const sd of S) {
    const kind = sd.kind || "content";
    if (kind === "cover") {
      const s = pres.addSlide({ masterName: "PORTADA" });
      for (const e of sd.els) await draw(s, e);
      s.addNotes(sd.notes); n++;
    } else if (kind === "section") {
      const s = pres.addSlide({ masterName: "SECCION" });
      await drawSection(s, sd, draw);
      s.addNotes(sd.notes); n++;
    } else if (kind === "close") {
      pres.addSlide({ masterName: "CIERRE" }); n++;
    } else {
      const ms = maxStep(sd.els);
      for (let st = soloFinal ? ms : 0; st <= ms; st++) {
        const s = pres.addSlide({ masterName: "CONTENIDO" });
        s.addText(sd.title, { x: 2.2, y: 0.32, w: 8.93, h: 0.75, fontFace: FONT, fontSize: sd.title.length > 33 ? 26 : 30, bold: true, color: C.ink, align: "center", valign: "middle", margin: 0, isTextBox: true });
        if (sd.line) s.addText(sd.line, { x: 1.2, y: 1.12, w: 10.93, h: 0.5, fontFace: FONT, fontSize: 18, color: C.gr, align: "center", valign: "middle", margin: 0, isTextBox: true });
        for (const e of sd.els) if ((e.step || 0) <= st) await draw(s, e);
        s.addNotes((ms && !soloFinal ? `[Paso ${st + 1} de ${ms + 1}] ` : "") + sd.notes);
        n++;
      }
    }
  }
  const out = soloFinal ? OUT_PPTX.replace(".pptx", "_sin_pasos.pptx") : OUT_PPTX;
  await pres.writeFile({ fileName: out });
  try { require("child_process").execFileSync("zip", ["-dq", out, "*/"]); } catch (e) {}
  return n;
}

// Diapositiva separadora al estilo de las lectures: [ 01. ] ícono y título
function sectionEls(sd) {
  return [
    { t: "box", text: "", x: 1.0, y: 2.35, w: 0.06, h: 2.8, fill: C.wh },
    { t: "box", text: "", x: 1.0, y: 2.35, w: 0.35, h: 0.06, fill: C.wh },
    { t: "box", text: "", x: 1.0, y: 5.09, w: 0.35, h: 0.06, fill: C.wh },
    { t: "box", text: "", x: 4.0, y: 2.35, w: 0.06, h: 2.8, fill: C.wh },
    { t: "box", text: "", x: 3.71, y: 2.35, w: 0.35, h: 0.06, fill: C.wh },
    { t: "box", text: "", x: 3.71, y: 5.09, w: 0.35, h: 0.06, fill: C.wh },
    { t: "text", text: sd.num, x: 1.1, y: 2.75, w: 2.85, h: 2.0, size: 80, bold: true, color: C.wh, align: "center" },
    { t: "icon", icon: sd.icon, x: 4.55, y: 3.3, d: 0.9, bg: C.ink, fg: C.wh },
    { t: "text", text: sd.title, x: 5.7, y: 2.85, w: 7.0, h: 1.1, size: 40, bold: true, color: C.ink },
    { t: "text", text: sd.sub, x: 5.7, y: 3.95, w: 7.0, h: 0.8, size: 18, color: C.ink },
  ];
}
async function drawSection(s, sd, draw) { for (const e of sectionEls(sd)) await draw(s, e); }

// ================= HTML =================
async function buildHtml() {
  const b64 = (f, mime) => `data:${mime};base64,` + fs.readFileSync(path.join(AS, f)).toString("base64");
  const BG = {
    content: b64("fondo_contenido.png", "image/png"),
    cover: b64("fondo_portada.jpg", "image/jpeg"),
    section: b64("fondo_seccion.jpg", "image/jpeg"),
    close: b64("fondo_cierre.jpg", "image/jpeg"),
  };
  const imgs = {};
  const img = (f) => (imgs[f] = imgs[f] || b64(f, f.endsWith(".png") ? "image/png" : "image/jpeg"));
  const px = (v) => Math.round(v * PX);
  const html = (text) => parse(text).map((ln) => ln.map((s) => (s.b ? `<b>${esc(s.t)}</b>` : esc(s.t))).join("")).join("<br>");

  function el(e) {
    const st = e.step || 0;
    const cls = ["el"];
    const anim = e.anim || (e.t === "arrow" ? "fade" : "up");
    if (st > 0) cls.push("f", "a-" + anim);
    const data = st > 0 ? ` data-s="${st}"` : "";
    const pos = `left:${px(e.x)}px;top:${px(e.y)}px;width:${px(e.w)}px;height:${px(e.h)}px;`;
    if (e.t === "text") {
      const jc = { top: "flex-start", middle: "center", bottom: "flex-end" }[e.valign || "middle"];
      return `<div class="${cls.join(" ")} tx"${data} style="${pos}justify-content:${jc};text-align:${e.align || "left"};font-size:${(e.size || 16) * 2}px;color:#${e.color || C.ink};${e.bold ? "font-weight:700;" : ""}${e.mono ? "font-family:'Courier New',monospace;" : ""}"><div>${e.link ? `<a href="${esc(e.link)}" target="_blank" rel="noopener" style="color:inherit">${esc(e.text)}</a>` : html(e.text)}</div></div>`;
    }
    if (e.t === "box") {
      let st2 = `${pos}font-size:${(e.size || 16) * 2}px;color:#${e.color || C.ink};${e.bold ? "font-weight:700;" : ""}${e.mono ? "font-family:'Courier New',monospace;" : ""}text-align:${e.align || "center"};`;
      st2 += e.fill === "none" ? "background:transparent;" : `background:#${e.fill || C.cyl};`;
      if (e.line) st2 += `box-shadow:inset 0 0 0 ${Math.max(2, Math.round((e.lw || 1) * 2))}px #${e.line};`;
      if (e.shape === "ellipse") st2 += "border-radius:50%;";
      else if (e.shape === "diamond") st2 += "clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);";
      else if (e.shape === "chevron") {
        const w = px(e.w), h = px(e.h), d = Math.round(h / 2);
        st2 += `clip-path:polygon(0 0,${w - d}px 0,${w}px 50%,${w - d}px ${h}px,0 ${h}px,${d}px 50%);padding-left:${d}px;padding-right:${Math.round(d / 2)}px;`;
      } else if (e.radius) st2 += `border-radius:${px(e.radius)}px;`;
      if (e.anim === "left") cls.push("grow");
      return `<div class="${cls.join(" ")} bx"${data} style="${st2}">${e.text ? `<span>${html(e.text)}</span>` : ""}</div>`;
    }
    if (e.t === "arrow") {
      const x1 = px(e.x1), y1 = px(e.y1), x2 = px(e.x2), y2 = px(e.y2);
      const minx = Math.min(x1, x2) - 20, miny = Math.min(y1, y2) - 20, w = Math.abs(x2 - x1) + 40, h = Math.abs(y2 - y1) + 40;
      const col = "#" + (e.color || C.cyd), sw = (e.w || 2.5) * 2;
      const ang = Math.atan2(y2 - y1, x2 - x1), L = 10 + sw * 2.2, Wd = 6 + sw * 1.3;
      const ex = x2 - minx, ey = y2 - miny;
      const bx = ex - Math.cos(ang) * L, by = ey - Math.sin(ang) * L;
      const p1 = [bx + Math.sin(ang) * Wd, by - Math.cos(ang) * Wd], p2 = [bx - Math.sin(ang) * Wd, by + Math.cos(ang) * Wd];
      return `<svg class="${cls.join(" ")}"${data} style="left:${minx}px;top:${miny}px;width:${w}px;height:${h}px" viewBox="0 0 ${w} ${h}"><line x1="${x1 - minx}" y1="${y1 - miny}" x2="${bx}" y2="${by}" stroke="${col}" stroke-width="${sw}" stroke-linecap="round"/><polygon points="${ex},${ey} ${p1.join(",")} ${p2.join(",")}" fill="${col}"/></svg>`;
    }
    if (e.t === "img") {
      return `<div class="${cls.join(" ")} im${e.fit === "contain" ? " contain" : ""}"${data} style="${pos}background-image:url(${img(e.src)})"></div>`;
    }
    if (e.t === "icon") {
      const fg = e.fg || (e.bg === C.ye || e.bg === C.cy ? C.ink : C.wh);
      const d = px(e.d);
      return `<div class="${cls.join(" ")} ic"${data} style="left:${px(e.x)}px;top:${px(e.y)}px;width:${d}px;height:${d}px;background:#${e.bg || C.cy}"><div style="width:${Math.round(d * 0.52)}px;height:${Math.round(d * 0.52)}px">${iconSvg(e.icon, fg)}</div></div>`;
    }
    return "";
  }

  const scenes = S.map((sd, i) => {
    const kind = sd.kind || "content";
    let inner = "";
    if (kind === "content") {
      inner += `<div class="el tx ttl" style="left:${px(2.2)}px;top:${px(0.32)}px;width:${px(8.93)}px;height:${px(0.75)}px;${sd.title.length > 33 ? "font-size:52px;" : ""}">${esc(sd.title)}</div>`;
      if (sd.line) inner += `<div class="el tx sub" style="left:${px(1.2)}px;top:${px(1.12)}px;width:${px(10.93)}px;height:${px(0.5)}px">${esc(sd.line)}</div>`;
      inner += sd.els.map(el).join("");
    } else if (kind === "cover") inner += sd.els.map((e, k) => el({ ...e })).join("");
    else if (kind === "section") inner += sectionEls(sd).map(el).join("");
    const bg = kind === "content" ? `background:#fff url(${BG.content}) center/cover no-repeat` : `background:url(${BG[kind]}) center/cover no-repeat`;
    return `<section class="sc k-${kind}" data-max="${kind === "content" ? maxStep(sd.els) : 0}" style="${bg}">${inner}<aside class="nt">${esc(sd.notes || "")}</aside></section>`;
  });

  const page = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Auditor ReAct</title>
<style>
:root{--cy:#${C.cy};--ink:#${C.ink};--gr:#${C.gr}}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden;background:#0d1114}
body{font-family:Arial,"Liberation Sans",Helvetica,sans-serif;-webkit-font-smoothing:antialiased}
#stage{position:fixed;left:0;top:0;width:1920px;height:1080px;transform-origin:0 0}
.sc{position:absolute;inset:0;overflow:hidden;opacity:0;visibility:hidden;transform:scale(1.015);transition:opacity .55s ease,transform .7s cubic-bezier(.2,.8,.2,1),visibility 0s linear .55s}
.sc.on{opacity:1;visibility:visible;transform:none;transition:opacity .55s ease,transform .7s cubic-bezier(.2,.8,.2,1)}
.el{position:absolute}
.tx{display:flex;flex-direction:column;padding:8px;line-height:1.17;color:var(--ink)}
.ttl{justify-content:center;text-align:center;font-size:60px;font-weight:700;padding:0}
.sub{justify-content:center;text-align:center;font-size:36px;color:var(--gr);padding:0}
.bx{display:flex;align-items:center;justify-content:center;padding:8px;line-height:1.17}
.bx span{width:100%}
.im{background-size:cover;background-position:center;border-radius:6px}
.im.contain{background-size:contain;background-repeat:no-repeat}
.ic{border-radius:50%;display:flex;align-items:center;justify-content:center}
.ic svg{width:100%;height:100%;display:block}
svg.el{overflow:visible}
/* revelado por pasos */
.f{opacity:0;transition:opacity .5s ease,transform .6s cubic-bezier(.2,.8,.2,1)}
.f.a-up{transform:translateY(26px)}
.f.a-pop{transform:scale(.85)}
.f.a-fade{transform:none}
.f.a-left{transform:scaleX(0);transform-origin:left center}
.f.in{opacity:1;transform:none}
.sc.on .grow:not(.f){animation:grow .9s cubic-bezier(.2,.8,.2,1) both .3s}
@keyframes grow{from{transform:scaleX(0);transform-origin:left}to{transform:scaleX(1);transform-origin:left}}
.sc.on.k-section .el,.sc.on.k-cover .el{animation:rise .7s cubic-bezier(.2,.8,.2,1) both}
.sc.on.k-section .el:nth-child(n+7),.sc.on.k-cover .el:nth-child(n+2){animation-delay:.15s}
.sc.on.k-section .el:nth-child(n+9),.sc.on.k-cover .el:nth-child(n+3){animation-delay:.3s}
@keyframes rise{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
.nt{display:none}
#hud{position:fixed;right:14px;bottom:10px;font:500 13px/1 Arial,sans-serif;color:rgba(255,255,255,.55);z-index:9;user-select:none}
#notes{position:fixed;left:0;right:0;bottom:0;max-height:34vh;overflow:auto;background:rgba(20,24,28,.94);color:#f3f3f3;font:400 17px/1.45 Arial,sans-serif;padding:16px 22px;z-index:10;display:none;border-top:3px solid var(--cy)}
#notes b{color:var(--cy)}
#help{position:fixed;left:14px;bottom:10px;font:400 12px/1 Arial,sans-serif;color:rgba(255,255,255,.4);z-index:9}
</style></head><body>
<div id="stage">${scenes.join("\n")}</div>
<div id="hud"></div><div id="help">→ avanzar · ← retroceder · N notas · F pantalla completa</div><div id="notes"></div>
<script>
(function(){
  var stage=document.getElementById('stage'),sc=[].slice.call(document.querySelectorAll('.sc')),hud=document.getElementById('hud'),notes=document.getElementById('notes');
  var i=0,s=0;
  function fit(){var k=Math.min(innerWidth/1920,innerHeight/1080);stage.style.transform='translate('+((innerWidth-1920*k)/2)+'px,'+((innerHeight-1080*k)/2)+'px) scale('+k+')';}
  function max(n){return +sc[n].getAttribute('data-max')||0}
  function paint(){
    sc.forEach(function(e,k){e.classList.toggle('on',k===i)});
    [].forEach.call(sc[i].querySelectorAll('.f'),function(e){e.classList.toggle('in',+e.getAttribute('data-s')<=s)});
    hud.textContent=(i+1)+' / '+sc.length+(max(i)?'  ·  paso '+(s+1)+' de '+(max(i)+1):'');
    notes.innerHTML='<b>Guion:</b> '+sc[i].querySelector('.nt').innerHTML;
    try{history.replaceState(null,'','#'+(i+1))}catch(e){}
  }
  function next(){if(s<max(i))s++;else if(i<sc.length-1){i++;s=0}paint()}
  function prev(){if(s>0)s--;else if(i>0){i--;s=max(i)}paint()}
  addEventListener('keydown',function(e){
    if(['ArrowRight','ArrowDown','PageDown',' ','Enter'].indexOf(e.key)>=0){e.preventDefault();next()}
    else if(['ArrowLeft','ArrowUp','PageUp','Backspace'].indexOf(e.key)>=0){e.preventDefault();prev()}
    else if(e.key==='Home'){i=0;s=0;paint()}
    else if(e.key==='End'){i=sc.length-1;s=0;paint()}
    else if(e.key==='n'||e.key==='N'){notes.style.display=notes.style.display==='block'?'none':'block'}
    else if(e.key==='f'||e.key==='F'){if(!document.fullscreenElement)document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen();else document.exitFullscreen()}
  });
  addEventListener('click',function(e){if(e.target.closest('#notes')||e.target.closest('a'))return;(e.clientX<innerWidth*0.25?prev:next)()});
  addEventListener('resize',fit);
  var h=parseInt((location.hash||'').slice(1),10);if(h>0&&h<=sc.length)i=h-1;
  fit();paint();
})();
</script></body></html>`;
  fs.writeFileSync(OUT_HTML, page);
}

(async () => {
  const n = await buildPptx(false);
  const nf = await buildPptx(true);
  await buildHtml();
  const steps = S.reduce((a, sd) => a + ((sd.kind || "content") === "content" ? maxStep(sd.els) : 0), 0);
  console.log(`Escenas: ${S.length} · Clics de animación: ${steps} · Diapositivas PPTX: ${n} (con pasos) y ${nf} (sin pasos)`);
  console.log("Listo: PPTX con pasos, PPTX sin pasos y HTML");
})().catch((e) => { console.error(e); process.exit(1); });
