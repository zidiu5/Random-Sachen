(function() {
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes blueFlow { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        .blue-flow-text { background: linear-gradient(270deg, #3b82f6, #60a5fa, #93c5fd, #3b82f6); background-size: 600% 600%; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: blueFlow 3s ease infinite; font-weight: 900 !important; }
        .menu-btn { cursor: pointer; padding: 5px; display: flex; flex-direction: column; gap: 4px; width: 25px; }
        .menu-btn div { height: 3px; background: white; border-radius: 2px; }
        .nav-overlay { position: absolute; top: 50px; left: 10px; background: #1e293b; border-radius: 15px; padding: 10px; display: none; z-index: 100000; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155; }
        .nav-item { padding: 10px 20px; cursor: pointer; border-radius: 8px; font-size: 0.9rem; color: white; }
        .nav-item:hover { background: #334155; }
        .stat-card { background: #1e293b; border-radius: 20px; padding: 20px; text-align: center; border: 1px solid #334155; position: relative; margin-bottom: 15px; width: 100%; box-sizing: border-box; }
        #noten-app-v8 * { box-sizing: border-box; font-family: sans-serif; }
        input::placeholder { color: #64748b; font-size: 0.7rem; }
    `;
    document.head.appendChild(style);

    let currentView = 'faecher';
    window.showLines = true;
    let originalData = [];
    let fachDaten = [];
    let openFaecher = new Set();
    let rescueResults = {};
    window.lastSimNote = window.lastSimNote || ""; 

    const parseNote = (str) => {
        if (!str) return null;
        str = str.trim().replace(',', '.');
        if (!str || !/\d/.test(str)) return null;
        if (str.includes('/')) { let p = str.split('/'); return (parseFloat(p[0]) + parseFloat(p[1])) / 2; }
        if (str.includes('+')) return parseFloat(str) + 0.25;
        if (str.includes('-')) return parseFloat(str) - 0.25;
        return parseFloat(str);
    };

    const getGradeColor = (val) => {
        if (val >= 9.65) return '#60a5fa';
        if (val >= 7.5) return '#2dd4bf'; 
        if (val >= 6.5) return '#d4d447'; 
        if (val >= 6.0) return '#fbbf24'; 
        if (val >= 5.0) return '#f97316';
        return '#f43f5e';
    };

    console.log("Masterpiece v8: Scanne Daten...");
    document.querySelectorAll('mat-expansion-panel-header').forEach(h => h.click());

    setTimeout(() => {
        const panels = document.querySelectorAll('mat-expansion-panel');
        panels.forEach(panel => {
            const titleEl = panel.querySelector('mat-panel-title');
            if (!titleEl) return;
            
            let noten = [];
            const rows = panel.querySelectorAll('.grade-row');
            if (rows && rows.length > 0) {
                rows.forEach(row => {
                    const spans = row.querySelectorAll('span');
                    if (spans && spans.length >= 3) {
                        let noteText = spans[spans.length - 1].innerText.trim();
                        let wert = parseNote(noteText);
                        if (wert !== null) noten.push({ 
                            thema: spans[1].innerText.trim().toLowerCase(), 
                            label: noteText, 
                            value: wert,
                            datum: spans[0].innerText.trim()
                        });
                    }
                });
            }
            if (noten.length > 0) {
                const fachObj = { fach: titleEl.innerText.trim(), noten: noten, simNoten: [] };
                fachDaten.push(fachObj);
                originalData.push(JSON.parse(JSON.stringify(fachObj)));
            }
        });
        document.querySelectorAll('mat-expansion-panel-header').forEach(h => h.click());
        renderApp();
    }, 100);

    const generatePie = (counts) => {
        let total = Object.values(counts).reduce((a, b) => a + b, 0);
        if (total === 0) return '<div style="padding:20px;">Keine Daten</div>';
        let currentAngle = -90;
        let elements = [];
        const colors = { '4': '#f43f5e', '5': '#f97316', '6': '#fbbf24', '7': '#d4d447', '8': '#2dd4bf', '9': '#6366f1', '10': '#3b82f6' };
        Object.keys(counts).forEach(grade => {
            if (counts[grade] === 0) return;
            let angle = (counts[grade] / total) * 360;
            let midAngle = currentAngle + angle / 2;
            let x1 = 50 + 35 * Math.cos(currentAngle * Math.PI / 180);
            let y1 = 50 + 35 * Math.sin(currentAngle * Math.PI / 180);
            currentAngle += angle;
            let x2 = 50 + 35 * Math.cos(currentAngle * Math.PI / 180);
            let y2 = 50 + 35 * Math.sin(currentAngle * Math.PI / 180);
            elements.push(`<path d="M 50 50 L ${x1} ${y1} A 35 35 0 ${angle > 180 ? 1 : 0} 1 ${x2} ${y2} Z" fill="${colors[grade]}" stroke="#020617" stroke-width="0.8"/>`);
            if (window.showLines) {
                let lx2 = 50 + 44 * Math.cos(midAngle * Math.PI / 180);
                let ly2 = 50 + 44 * Math.sin(midAngle * Math.PI / 180);
                elements.push(`<line x1="${50+36*Math.cos(midAngle*Math.PI/180)}" y1="${50+36*Math.sin(midAngle*Math.PI/180)}" x2="${lx2}" y2="${ly2}" stroke="white" stroke-width="0.5" opacity="0.6" />`);
                elements.push(`<text x="${50+48*Math.cos(midAngle*Math.PI/180)}" y="${50+48*Math.sin(midAngle*Math.PI/180)}" fill="white" font-size="4" font-weight="bold" text-anchor="middle" dominant-baseline="middle">${grade}</text>`);
            }
        });
        return `<svg viewBox="0 0 100 100" style="width:280px; max-width:100%;">${elements.join('')}</svg>`;
    };

    window.renderApp = () => {
        let allValues = [];
        let sumFaecher = 0, faecherAnzahl = 0;
        fachDaten.forEach(f => {
            const af = [...(f.noten || []), ...(f.simNoten || [])];
            if(af.length > 0) {
                let s = (af.reduce((a,b)=>a+b.value,0)/af.length);
                sumFaecher += s; faecherAnzahl++;
                af.forEach(n => allValues.push(n.value));
            }
        });
        const sNoten = allValues.length > 0 ? (allValues.reduce((a,b)=>a+b,0) / allValues.length).toFixed(2) : "0.00";
        const sFaecher = faecherAnzahl > 0 ? (sumFaecher / faecherAnzahl).toFixed(2) : "0.00";

        const header = `<div style="background:linear-gradient(135deg, #1e40af, #3b82f6); padding:20px; border-radius:25px; margin-bottom:20px; text-align:center; width:100%;">
            <div style="display:flex; justify-content:space-around; align-items:center;">
                <div style="flex:1;"><div style="font-size:0.6rem; opacity:0.8; color:white;">ALLE NOTEN</div><div style="font-size:1.8rem; font-weight:900; color:white;">${sNoten}</div></div>
                <div style="width:1px; height:30px; background:rgba(255,255,255,0.2);"></div>
                <div style="flex:1;"><div style="font-size:0.6rem; opacity:0.8; color:white;">FÄCHER SCHNITT</div><div style="font-size:1.8rem; font-weight:900; color:white;">${sFaecher}</div></div>
            </div>
            <button onclick="resetApp()" style="background:rgba(255,255,255,0.2); border:none; color:white; padding:10px; border-radius:12px; font-size:0.75rem; margin-top:10px; width:100%; cursor:pointer;">Reset Simulation</button>
        </div>`;

        let html = `<div style="width:100%; margin:auto;">
            <div style="display:flex; justify-content:space-between; margin-bottom:15px; align-items:center;">
                <div class="menu-btn" onclick="let m=document.getElementById('nav-menu'); m.style.display=m.style.display==='block'?'none':'block'"><div></div><div></div><div></div></div>
                <button onclick="document.getElementById('noten-app-v8').remove()" style="background:#f43f5e; border:none; color:white; border-radius:50%; width:30px; height:30px; font-weight:bold; display:flex; justify-content:center; align-items:center; cursor:pointer;">✕</button>
            </div>
            <div id="nav-menu" class="nav-overlay">
                <div class="nav-item" onclick="window.setView('faecher')">📚 Fächer</div>
                <div class="nav-item" onclick="window.setView('stats')">📊 Statistik</div>
            </div> ${header}`;

        if (currentView === 'stats') {
            let dist = { '4':0, '5':0, '6':0, '7':0, '8':0, '9':0, '10':0 };
            allValues.forEach(v => { let b=Math.floor(v); if(b<4)b=4; if(b>10)b=10; dist[b]++; });
            html += `<div class="stat-card">
                <button onclick="window.showLines=!window.showLines; renderApp();" style="position:absolute; right:10px; top:10px; background:#334155; border:none; color:white; padding:6px; border-radius:6px; font-size:0.6rem; cursor:pointer;">Lines: ${window.showLines?'ON':'OFF'}</button>
                <div style="display:flex; justify-content:center;">${generatePie(dist)}</div>
            </div>`;
        } else {
            fachDaten.forEach((f, fIdx) => {
                const allN = [...(f.noten||[]).map(n => ({...n, sim: false})), ...(f.simNoten||[]).map(n => ({...n, sim: true}))];
                let s = allN.length > 0 ? (allN.reduce((a, b) => a + b.value, 0) / allN.length) : 0;
                const isOpen = openFaecher.has(fIdx);
                
                html += `<div style="background:#1e293b; border-radius:18px; margin-bottom:10px; border:1px solid ${isOpen ? '#3b82f6' : '#334155'}; overflow:hidden; width:100%;">
                    <div onclick="toggleFach(${fIdx})" style="padding:15px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                        <span style="font-weight:bold; font-size:0.95rem; color:white;">${f.fach}</span>
                        <span style="font-weight:900; color:${getGradeColor(s)}; font-size:1.2rem;">${s>0?s.toFixed(2):'---'}</span>
                    </div>
                    <div style="display:${isOpen ? 'block' : 'none'}; padding:0 15px 15px 15px; background:#0f172a;">
                        ${allN.map((n, ni) => `
                            <div style="display:flex; align-items:center; padding:10px 0; border-bottom:1px solid #1e293b; font-size:0.85rem;">
                                <span style="flex:1; color:${n.sim ? '#2dd4bf' : '#94a3b8'}">${n.sim ? '★ Simuliert' : n.thema}</span>
                                <b style="margin-right:15px; color:${getGradeColor(n.value)}">${n.label}</b>
                                <span onclick="event.stopPropagation(); removeNote(${fIdx}, ${ni}, ${n.sim})" style="color:#f43f5e; cursor:pointer; font-weight:bold; padding:5px;">✕</span>
                            </div>`).join('')}
                        
                        <div style="display:flex; gap:8px; margin-top:15px;">
                            <input type="text" id="input-${fIdx}" value="${window.lastSimNote}" placeholder="Note..." oninput="window.lastSimNote=this.value" style="flex:1; background:#1e293b; border:1px solid #334155; color:white; padding:12px; border-radius:10px; outline:none; font-size:1rem;">
                            <button onclick="addNote(${fIdx})" style="background:#3b82f6; border:none; color:white; padding:0 20px; border-radius:10px; font-weight:bold; cursor:pointer;">+</button>
                        </div>

                        <div style="margin-top:12px; background: #1e293b; padding: 10px; border-radius: 12px; border: 1px solid #334155;">
                            <div style="font-size: 0.65rem; color: #94a3b8; margin-bottom: 8px; text-align: center; font-weight: bold;">🎯 RETTUNGS-RECHNER</div>
                            <div style="display:flex; gap:5px;">
                                <input type="number" id="target-${fIdx}" placeholder="Ziel (z.B. 6.0)" step="0.1" style="flex:1.2; background:#0f172a; border:1px solid #475569; color:white; border-radius:8px; padding:8px; font-size:0.8rem;">
                                <input type="number" id="res-${fIdx}" placeholder="Anz." style="flex:1; background:#0f172a; border:1px solid #475569; color:white; border-radius:8px; padding:8px; font-size:0.8rem;">
                                <button onclick="doRescue(${fIdx})" style="flex:1; background:#6366f1; border:none; color:white; border-radius:8px; font-size:0.8rem; font-weight:bold; cursor:pointer;">Go</button>
                            </div>
                            ${rescueResults[fIdx] ? `<div style="margin-top:10px; font-size:0.85rem; text-align:center; color:${rescueResults[fIdx].color}; font-weight:bold; border-top: 1px solid #334155; padding-top: 8px;">${rescueResults[fIdx].msg}</div>` : ''}
                        </div>
                    </div>
                </div>`;
            });
        }
        const container = document.getElementById('noten-app-v8') || document.createElement('div');
        if(!container.id) { 
            container.id = "noten-app-v8"; 
            container.style = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:#020617; color:white; z-index:2147483647; padding:15px; overflow-y:auto; font-family:sans-serif; box-sizing:border-box;"; 
            document.body.appendChild(container); 
        }
        container.innerHTML = html;
    };

    window.setView = (v) => { currentView = v; renderApp(); };
    window.toggleFach = (idx) => { openFaecher.has(idx) ? openFaecher.delete(idx) : openFaecher.add(idx); renderApp(); };
    window.addNote = (idx) => { const val = parseNote(window.lastSimNote); if (val !== null) { fachDaten[idx].simNoten.push({ thema: 'simuliert', label: window.lastSimNote, value: val }); renderApp(); } };
    window.removeNote = (fIdx, nIdx, isSim) => { if (isSim) { fachDaten[fIdx].simNoten.splice(nIdx - fachDaten[fIdx].noten.length, 1); } else { fachDaten[fIdx].noten.splice(nIdx, 1); } renderApp(); };
    window.resetApp = () => { fachDaten = JSON.parse(JSON.stringify(originalData)); rescueResults = {}; renderApp(); };
    
    window.doRescue = (idx) => {
        const count = parseInt(document.getElementById(`res-${idx}`).value) || 1;
        const target = parseFloat(document.getElementById(`target-${idx}`).value) || 6.0;
        const f = fachDaten[idx]; 
        const all = [...f.noten, ...f.simNoten];
        const currentSum = all.reduce((a,b) => a + b.value, 0);
        const needed = (target * (all.length + count) - currentSum) / count;
        
        if (needed > 10) {
            rescueResults[idx] = {msg: `Unmöglich 💀 (Schnitt ${needed.toFixed(2)} nötig)`, color: "#f43f5e"};
        } else if (needed <= 4) {
            rescueResults[idx] = {msg: `Easy! Schon erreicht ✅`, color: "#2dd4bf"};
        } else {
            rescueResults[idx] = {msg: `${count}x Note ${needed.toFixed(2)} für Ziel ${target.toFixed(1)}`, color: "#fbbf24"};
        }
        renderApp();
    };
})();
