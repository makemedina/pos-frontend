(function(){
  "use strict";

  // Si el script ya corrio una vez en esta sesion (el usuario
  // navego a esta pantalla, salio, y volvio), no volvemos a registrar
  // los listeners en document -- solo repintamos sobre el #app nuevo.
  if (window.__prospeccionMounted) {
    window.__prospeccionApi.render();
    return;
  }

  const PROSPECTOS = window.__PROSPECCION_DATA__ || [];

  const CORTES = ["Diezmillo","Bola / pierna","Espaldilla","Falda","Suadero","Costilla",
    "Molida","Chambarete","Cabeza","Rib eye","Arrachera","Chorizo","Tripa","Pollo"];

  const ESTADOS = ["Sin visitar","Interesado","No interesado","Cotización enviada",
    "Muestra entregada","Cliente","Cerrado o no existe"];

  const RUTAS = {
    todas:"Todas", R1:"R1 Jardines", R2:"R2 Paseo Playas", R3:"R3 Malecón",
    R4:"R4 Costa Azul", R5:"R5 Entrada"
  };

  // ---------- almacenamiento ----------
  const mem = {};
  const store = {
    async get(k){
      try{ if(window.storage){ const r = await window.storage.get(k); if(r) return JSON.parse(r.value); } }catch(e){}
      try{ const v = localStorage.getItem(k); if(v!=null) return JSON.parse(v); }catch(e){}
      return k in mem ? mem[k] : null;
    },
    async set(k,v){
      mem[k]=v;
      try{ if(window.storage){ await window.storage.set(k, JSON.stringify(v)); return; } }catch(e){}
      try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){}
    }
  };

  let crm = {};        // { id: {est, contacto, ...} }
  let precios = {};    // { corte: precio }
  const S = { tab:"hoy", ruta:"todas", q:"", prio:"todas", seg:"todas", est:"todas", open:null };

  const $ = s => document.querySelector(s);
  const esc = s => String(s==null?"":s).replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const tel10 = t => String(t||"").replace(/\D/g,"");
  const rec = id => crm[id] || {};
  const estado = id => rec(id).est || "Sin visitar";
  const visitado = id => estado(id) !== "Sin visitar";
  const hoyISO = () => new Date().toISOString().slice(0,10);

  function toast(msg){
    const t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(()=>{ t.hidden = true; }, 2200);
  }

  // ---------- filtros ----------
  function enRuta(p){ return S.ruta==="todas" || p.r===S.ruta; }

  function filtrados(){
    const q = S.q.trim().toLowerCase();
    return PROSPECTOS.filter(p=>{
      if(!enRuta(p)) return false;
      if(S.prio!=="todas" && p.p!==S.prio) return false;
      if(S.seg!=="todas" && p.s!==S.seg) return false;
      if(S.est!=="todas" && estado(p.id)!==S.est) return false;
      if(q && !(p.n+" "+p.c+" "+p.d+" "+p.s).toLowerCase().includes(q)) return false;
      return true;
    });
  }

  const ORDEN = {A:0,B:1,C:2};
  function pendientes(){
    return PROSPECTOS.filter(p => enRuta(p) && !visitado(p.id))
      .sort((a,b)=> ORDEN[a.p]-ORDEN[b.p] || a.r.localeCompare(b.r) || a.n.localeCompare(b.n));
  }

  // ---------- encabezado ----------
  function pintaHeader(){
    const univ = PROSPECTOS.filter(enRuta);
    const done = univ.filter(p=>visitado(p.id)).length;
    $("#hdDone").textContent = done;
    $("#hdTot").textContent = univ.length;
    $("#barFill").style.width = univ.length ? (done/univ.length*100).toFixed(1)+"%" : "0";
    $("#rutas").innerHTML = Object.entries(RUTAS).map(([k,v])=>
      `<button data-ruta="${k}" class="${S.ruta===k?"on":""}">${esc(v)}</button>`).join("");
  }

  // ---------- fila ----------
  function fila(p){
    const e = estado(p.id);
    const cls = e==="Cliente" ? "win"
      : (e==="No interesado"||e==="Cerrado o no existe") ? "dead"
      : visitado(p.id) ? "done" : "";
    return `<button class="row" data-id="${p.id}">
      <span class="pri ${p.p}">${p.p}</span>
      <span class="row-main">
        <span class="row-name">${esc(p.n)}</span>
        <span class="row-sub">${esc(p.s)} · ${esc(p.c)}${p.t?" · "+esc(p.t):""}</span>
      </span>
      <span class="dot ${cls}"></span>
    </button>`;
  }

  // ---------- vista: hoy ----------
  function vistaHoy(){
    const pend = pendientes();
    if(!pend.length){
      return `<div class="empty">Ya cubriste toda esta ruta.<br>Cambia de ruta arriba o revisa
        los seguimientos en Ventas.</div>`;
    }
    const p = pend[0], d = tel10(p.t);
    const sig = pend.slice(1,5);
    return `<div class="stack">
      <div class="next">
        <div class="next-top">
          <div class="next-kicker">Siguiente parada · ${esc(p.r)} · prioridad ${esc(p.p)}</div>
          <div class="next-name">${esc(p.n)}</div>
        </div>
        <div class="next-meta">
          <div>${esc(p.s)}</div>
          <div class="dim">${esc(p.d)}</div>
          <div class="dim">${esc(p.c)} · CP ${esc(p.cp)} · ${esc(p.e)} empleados</div>
        </div>
        <div class="next-acts">
          <button data-call="${d}" ${d?"":"disabled"}>Llamar</button>
          <button data-wa="${d}" ${d?"":"disabled"}>WhatsApp</button>
          <button data-nav="${p.id}">Ir</button>
        </div>
        <button class="next-log" data-id="${p.id}">Registrar visita</button>
      </div>
      ${sig.length ? `<div><h2>Después de esta</h2><div style="margin-top:8px">
        ${sig.map(fila).join("")}</div></div>` : ""}
    </div>`;
  }

  // ---------- vista: lista ----------
  function vistaLista(){
    const segs = [...new Set(PROSPECTOS.map(p=>p.s))].sort();
    const list = filtrados();
    return `<div class="stack">
      <div class="filters">
        <input id="fq" type="search" placeholder="Buscar negocio, calle o giro" value="${esc(S.q)}">
        <div class="three">
          <select id="fp">
            <option value="todas">Toda prioridad</option>
            ${["A","B","C"].map(x=>`<option ${S.prio===x?"selected":""}>${x}</option>`).join("")}
          </select>
          <select id="fe">
            <option value="todas">Todo estatus</option>
            ${ESTADOS.map(x=>`<option ${S.est===x?"selected":""}>${esc(x)}</option>`).join("")}
          </select>
        </div>
        <select id="fs">
          <option value="todas">Todos los giros</option>
          ${segs.map(x=>`<option ${S.seg===x?"selected":""}>${esc(x)}</option>`).join("")}
        </select>
      </div>
      <div>
        <h2>${list.length} ${list.length===1?"negocio":"negocios"}</h2>
        <div style="margin-top:8px">${list.length?list.map(fila).join(""):
          `<div class="empty">Ningún negocio coincide con esos filtros.</div>`}</div>
      </div>
    </div>`;
  }

  // ---------- vista: ventas ----------
  function vistaVentas(){
    const univ = PROSPECTOS.filter(enRuta);
    const cli = univ.filter(p=>estado(p.id)==="Cliente");
    const cot = univ.filter(p=>["Cotización enviada","Muestra entregada","Interesado"].includes(estado(p.id)));
    const kg = arr => arr.reduce((s,p)=> s + (Number(rec(p.id).kg)||0), 0);
    const precioProm = (()=>{
      const v = Object.values(precios).map(Number).filter(x=>x>0);
      return v.length ? v.reduce((a,b)=>a+b,0)/v.length : 0;
    })();
    const hoy = hoyISO();
    const seg = univ.filter(p=>{ const x=rec(p.id).prox; return x && x<=hoy && estado(p.id)!=="Cliente"; })
      .sort((a,b)=> (rec(a.id).prox||"").localeCompare(rec(b.id).prox||""));

    return `<div class="stack">
      <div class="grid2">
        <div class="stat"><b class="num">${cli.length}</b><span>clientes cerrados</span></div>
        <div class="stat"><b class="num">${cot.length}</b><span>en negociación</span></div>
        <div class="stat"><b class="num">${kg(cli).toLocaleString("es-MX")}</b><span>kg/semana cerrados</span></div>
        <div class="stat"><b class="num">${kg(cot).toLocaleString("es-MX")}</b><span>kg/semana en juego</span></div>
      </div>

      ${precioProm>0 ? `<div class="stat">
        <b class="num">$${Math.round(kg(cli)*precioProm).toLocaleString("es-MX")}</b>
        <span>venta semanal estimada, a precio promedio de tu lista</span></div>` : ""}

      <div>
        <h2>Seguimientos vencidos</h2>
        <div style="margin-top:8px">${seg.length ? seg.map(p=>fila(p)).join("")
          : `<div class="empty">Nada pendiente para hoy.</div>`}</div>
      </div>

      <div>
        <h2>Tu lista de precios, por kilo</h2>
        <div style="margin-top:8px">${CORTES.map(c=>`<div class="price">
          <label for="pr-${esc(c)}">${esc(c)}</label>
          <input id="pr-${esc(c)}" class="num" type="number" inputmode="decimal" min="0" step="0.5"
            data-precio="${esc(c)}" value="${precios[c]!=null?esc(precios[c]):""}" placeholder="0">
        </div>`).join("")}</div>
        <p style="font-size:12.5px;color:var(--muted);margin-top:9px">
          Estos precios alimentan la cotización que mandas por WhatsApp desde cada ficha.</p>
      </div>
    </div>`;
  }

  // ---------- vista: datos ----------
  function vistaDatos(){
    const cap = Object.keys(crm).length;
    const motor = window.storage ? "almacenamiento del contenedor"
      : (()=>{ try{ localStorage.setItem("_t","1"); localStorage.removeItem("_t"); return "localStorage del navegador"; }
               catch(e){ return "memoria (se pierde al cerrar)"; } })();
    return `<div class="stack">
      <div class="grid2">
        <div class="stat"><b class="num">${PROSPECTOS.length}</b><span>prospectos cargados</span></div>
        <div class="stat"><b class="num">${cap}</b><span>fichas con captura</span></div>
      </div>
      <div class="stat"><span>Tu captura se guarda en ${esc(motor)}. Exporta seguido si vas
        a cambiar de teléfono.</span></div>
      <button class="save" id="expCsv">Exportar CSV para Excel</button>
      <button class="ghost" id="expJson">Exportar respaldo JSON</button>
      <button class="ghost" id="impJson">Importar respaldo JSON</button>
      <button class="ghost" id="wipe" style="color:var(--brand)">Borrar toda mi captura</button>
      <input type="file" id="file" accept="application/json" hidden>
    </div>`;
  }

  // ---------- ficha ----------
  function abre(id){
    const p = PROSPECTOS.find(x=>x.id===id); if(!p) return;
    S.open = id;
    const r = rec(id), d = tel10(p.t);
    const cortes = r.cortes || [];
    const nav = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;

    $("#sheetBody").innerHTML = `
      <div class="sheet-hd">
        <div>
          <h3>${esc(p.n)}</h3>
          <p>${esc(p.s)} · prioridad ${esc(p.p)} · ruta ${esc(p.r)}</p>
          <p>${esc(p.d)} — ${esc(p.c)}</p>
        </div>
        <button class="x" data-close aria-label="Cerrar">×</button>
      </div>

      ${p.a ? `<div class="alert">${esc(p.a)}</div>` : ""}
      ${p.m ? `<div class="alert">También está en tu lista de Google Maps como “${esc(p.m)}”,
        ahí tienes horario.</div>` : ""}

      <div class="acts">
        <a class="${d?"":"off"}" href="${d?"tel:+52"+d:"#"}">Llamar</a>
        <a class="${d?"":"off"}" href="${d?"https://wa.me/52"+d:"#"}" target="_blank" rel="noopener">WhatsApp</a>
        <a href="${nav}" target="_blank" rel="noopener">Ir en Maps</a>
      </div>

      <label class="fld"><span>Estatus</span>
        <select id="f-est">${ESTADOS.map(x=>
          `<option ${estado(id)===x?"selected":""}>${esc(x)}</option>`).join("")}</select></label>

      <div class="two">
        <label class="fld"><span>Contacto</span>
          <input id="f-contacto" value="${esc(r.contacto||"")}" placeholder="Nombre"></label>
        <label class="fld"><span>Puesto</span>
          <input id="f-puesto" value="${esc(r.puesto||"")}" placeholder="Dueño, chef, compras"></label>
      </div>

      <div class="fld"><span>Cortes que usa</span>
        <div class="chips" id="f-cortes">${CORTES.map(c=>
          `<button type="button" data-corte="${esc(c)}" class="${cortes.includes(c)?"on":""}">${esc(c)}</button>`
        ).join("")}</div></div>

      <div class="two">
        <label class="fld"><span>Kilos por semana</span>
          <input id="f-kg" class="num" type="number" inputmode="decimal" min="0"
            value="${esc(r.kg||"")}" placeholder="0"></label>
        <label class="fld"><span>Precio que paga hoy</span>
          <input id="f-precio" class="num" type="number" inputmode="decimal" min="0" step="0.5"
            value="${esc(r.precio||"")}" placeholder="$ / kg"></label>
      </div>

      <label class="fld"><span>Proveedor actual</span>
        <input id="f-prov" value="${esc(r.prov||"")}" placeholder="¿Quién le surte?"></label>

      <div class="two">
        <label class="fld"><span>Siguiente paso</span>
          <input id="f-sig" value="${esc(r.sig||"")}" placeholder="Llevar muestra"></label>
        <label class="fld"><span>Volver a contactar</span>
          <input id="f-prox" type="date" value="${esc(r.prox||"")}"></label>
      </div>

      <label class="fld"><span>Notas</span>
        <textarea id="f-notas" placeholder="Qué dijo, cuándo recibe, quién decide">${esc(r.notas||"")}</textarea></label>

      <button class="save" id="f-save">Guardar visita</button>
      <button class="ghost" id="f-cot">Armar cotización para WhatsApp</button>
    `;
    $("#sheet").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function cierra(){
    $("#sheet").hidden = true; S.open = null;
    document.body.style.overflow = "";
  }

  async function guarda(){
    const id = S.open; if(!id) return;
    const val = s => { const el = $(s); return el ? el.value.trim() : ""; };
    const cortes = [...document.querySelectorAll("#f-cortes button.on")].map(b=>b.dataset.corte);
    crm[id] = {
      est: val("#f-est"), contacto: val("#f-contacto"), puesto: val("#f-puesto"),
      cortes, kg: val("#f-kg"), precio: val("#f-precio"), prov: val("#f-prov"),
      sig: val("#f-sig"), prox: val("#f-prox"), notas: val("#f-notas"),
      fecha: rec(id).fecha || hoyISO()
    };
    if(crm[id].est === "Sin visitar") crm[id].fecha = "";
    await store.set("carne.crm", crm);
    cierra(); render(); toast("Visita guardada");
  }

  function cotiza(){
    const id = S.open; if(!id) return;
    const p = PROSPECTOS.find(x=>x.id===id);
    const cortes = [...document.querySelectorAll("#f-cortes button.on")].map(b=>b.dataset.corte);
    if(!cortes.length){ toast("Marca primero los cortes que usa"); return; }
    const sin = cortes.filter(c=>!Number(precios[c]));
    if(sin.length === cortes.length){ toast("Pon precios en la pestaña Ventas"); return; }
    const kg = Number($("#f-kg").value) || 0;
    const lineas = cortes.map(c=>{
      const pr = Number(precios[c]) || 0;
      return pr ? `• ${c}: $${pr.toFixed(2)}/kg` : `• ${c}: por confirmar`;
    });
    const conPrecio = cortes.map(c=>Number(precios[c])||0).filter(x=>x>0);
    const prom = conPrecio.reduce((a,b)=>a+b,0)/conPrecio.length;
    let txt = `Buen día`;
    const cont = $("#f-contacto").value.trim();
    if(cont) txt += ` ${cont}`;
    txt += `, le comparto precios para ${p.n}:\n\n${lineas.join("\n")}`;
    if(kg > 0) txt += `\n\nSobre ${kg} kg por semana, sale alrededor de $${Math.round(kg*prom).toLocaleString("es-MX")} semanales.`;
    txt += `\n\nEntrego en Playas con refrigeración. ¿Qué día le acomoda recibir?`;

    const d = tel10(p.t);
    if(d){ window.open(`https://wa.me/52${d}?text=${encodeURIComponent(txt)}`, "_blank", "noopener"); return; }
    navigator.clipboard?.writeText(txt).then(
      ()=>toast("Cotización copiada, pégala en WhatsApp"),
      ()=>toast("No pude copiar. Captura el teléfono primero.")
    );
  }

  // ---------- exportar ----------
  function baja(nombre, texto, tipo){
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([texto], {type:tipo}));
    a.download = nombre; a.click(); URL.revokeObjectURL(a.href);
  }

  function csv(){
    const cab = ["Ruta","Prioridad","Giro","Negocio","Colonia","Direccion","CP","Telefono",
      "Estatus","Fecha visita","Contacto","Puesto","Cortes","Kg semana","Precio que paga",
      "Proveedor actual","Siguiente paso","Volver a contactar","Notas"];
    const q = v => `"${String(v==null?"":v).replace(/"/g,'""')}"`;
    const filas = PROSPECTOS.map(p=>{
      const r = rec(p.id);
      return [p.r,p.p,p.s,p.n,p.c,p.d,p.cp,p.t, estado(p.id), r.fecha||"", r.contacto||"",
        r.puesto||"", (r.cortes||[]).join(" / "), r.kg||"", r.precio||"", r.prov||"",
        r.sig||"", r.prox||"", r.notas||""].map(q).join(",");
    });
    baja("prospeccion_playas.csv", "\uFEFF"+cab.map(q).join(",")+"\n"+filas.join("\n"),
      "text/csv;charset=utf-8");
    toast("CSV descargado");
  }

  // ---------- render ----------
  function render(){
    pintaHeader();
    const v = { hoy:vistaHoy, lista:vistaLista, ventas:vistaVentas, datos:vistaDatos }[S.tab];
    $("#view").innerHTML = v();
    document.querySelectorAll("#tabs button").forEach(b=>
      b.classList.toggle("on", b.dataset.tab === S.tab));
  }

  // ---------- eventos ----------
  document.addEventListener("click", e=>{
    const t = e.target.closest("button, a, [data-close]");
    if(!t) return;

    if(t.hasAttribute("data-close")){ cierra(); return; }
    if(t.dataset.tab){ S.tab = t.dataset.tab; render(); return; }
    if(t.dataset.ruta){ S.ruta = t.dataset.ruta; render(); return; }
    if(t.dataset.corte){ t.classList.toggle("on"); return; }
    if(t.dataset.call){ window.location.href = "tel:+52"+t.dataset.call; return; }
    if(t.dataset.wa){ window.open("https://wa.me/52"+t.dataset.wa, "_blank", "noopener"); return; }
    if(t.dataset.nav){
      const p = PROSPECTOS.find(x=>x.id===Number(t.dataset.nav));
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`,
        "_blank", "noopener");
      return;
    }
    if(t.id === "f-save"){ guarda(); return; }
    if(t.id === "f-cot"){ cotiza(); return; }
    if(t.id === "expCsv"){ csv(); return; }
    if(t.id === "expJson"){
      baja("respaldo_prospeccion.json", JSON.stringify({crm,precios},null,1), "application/json");
      toast("Respaldo descargado"); return;
    }
    if(t.id === "impJson"){ $("#file").click(); return; }
    if(t.id === "wipe"){
      if(!confirm("Se borra toda tu captura de visitas y precios. ¿Seguir?")) return;
      crm = {}; precios = {};
      store.set("carne.crm", crm); store.set("carne.precios", precios);
      render(); toast("Captura borrada"); return;
    }
    if(t.dataset.id){ abre(Number(t.dataset.id)); return; }
  });

  document.addEventListener("input", e=>{
    const el = e.target;
    if(el.id === "fq"){ S.q = el.value; const list = filtrados();
      const box = el.closest(".stack").querySelector(".stack > div:last-child > div");
      if(box){ box.innerHTML = list.length ? list.map(fila).join("")
        : `<div class="empty">Ningún negocio coincide con esos filtros.</div>`;
        el.closest(".stack").querySelector("h2").textContent =
          `${list.length} ${list.length===1?"negocio":"negocios"}`; }
      return; }
    if(el.dataset.precio){
      const v = Number(el.value);
      if(v > 0) precios[el.dataset.precio] = v; else delete precios[el.dataset.precio];
      store.set("carne.precios", precios);
    }
  });

  document.addEventListener("change", e=>{
    const el = e.target;
    if(el.id === "fp"){ S.prio = el.value; render(); }
    if(el.id === "fe"){ S.est = el.value; render(); }
    if(el.id === "fs"){ S.seg = el.value; render(); }
    if(el.id === "file"){
      const f = el.files && el.files[0]; if(!f) return;
      const fr = new FileReader();
      fr.onload = async () => {
        try{
          const d = JSON.parse(fr.result);
          if(d.crm) crm = d.crm;
          if(d.precios) precios = d.precios;
          await store.set("carne.crm", crm); await store.set("carne.precios", precios);
          render(); toast("Respaldo importado");
        }catch(err){ toast("Ese archivo no es un respaldo válido"); }
      };
      fr.readAsText(f); el.value = "";
    }
  });

  document.addEventListener("keydown", e=>{ if(e.key === "Escape" && S.open) cierra(); });

  window.__prospeccionApi = { render };
  window.__prospeccionMounted = true;

  // ---------- arranque ----------
  (async function(){
    crm = (await store.get("carne.crm")) || {};
    precios = (await store.get("carne.precios")) || {};
    render();
  })();
})();
