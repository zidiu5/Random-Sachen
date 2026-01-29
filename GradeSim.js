(function() {
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes blueFlow { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        .blue-flow-text { background: linear-gradient(270deg, #3b82f6, #60a5fa, #93c5fd, #3b82f6); background-size: 600% 600%; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: blueFlow 3s ease infinite; font-weight: 900 !important; }
        .menu-btn { cursor: pointer; padding: 5px; display: flex; flex-direction: column; gap: 4px; width: 25px; }
        .menu-btn div { height: 3px; background: white; border-radius: 2px; }
        .nav-overlay { position: absolute; top: 50px; left: 20px; background: #1e293b; border-radius: 15px; padding: 10px; display: none; z-index: 100000; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155; }
        .nav-item { padding: 10px 20px; cursor: pointer; border-radius: 8px; font-size: 0.9rem; }
        .nav-item:hover { background: #334155; }
        .stat-card { background: #1e293b; border-radius: 20px; padding: 20px; text-align: center; border: 1px solid #334155; position: relative; margin-bottom: 15px; }
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
        if (val >= 9.65) return 'SPECIAL';
        if (val >= 7.5) return '#2dd4bf'; 
        if (val >= 6.5) return '#d4d447'; 
        if (val >= 6.0) return '#fbbf24'; 
        if (val >= 5.0) return '#f97316';
        return '#f43f5e';
    };

    document.querySelectorAll('mat-expansion-panel-header').forEach(h => h.click());
    setTimeout(() => {
        document.querySelectorAll('mat-expansion-panel').forEach(panel => {
            const titleEl = panel.querySelector('mat-panel-title');
            if (!titleEl) return;
            let noten = [];
            panel.querySelectorAll('.grade-row').forEach(row => {
                const spans = row.querySelectorAll('span');
                if (spans.length >= 3) {
                    let noteText = spans[spans.length - 1].innerText.trim();
                    let datumText = spans[0].innerText.trim(); // Datum ist meist im ersten Span
                    let wert = parseNote(noteText);
                    if (wert !== null) noten.push({ 
                        thema: spans[1].innerText.trim().toLowerCase(), 
                        label: noteText, 
                        value: wert,
                        datum: datumText
                    });
                }
            });
            if (noten.length > 0) {
                const fachObj = { fach: titleEl.innerText.trim(), noten: noten, simNoten: [] };
                fachDaten.push(fachObj);
                originalData.push(JSON.parse(JSON.stringify(fachObj)));
            }
            panel.querySelector('mat-expansion-panel-header').click();
        });
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
            const af = [...f.noten, ...f.simNoten];
            if(af.length > 0) {
                let s = (af.reduce((a,b)=>a+b.value,0)/af.length);
                sumFaecher += s; faecherAnzahl++;
                af.forEach(n => allValues.push(n.value));
            }
        });
        const sNoten = allValues.length > 0 ? (allValues.reduce((a,b)=>a+b,0) / allValues.length).toFixed(2) : "0.00";
        const sFaecher = faecherAnzahl > 0 ? (sumFaecher / faecherAnzahl).toFixed(2) : "0.00";

        const header = `<div style="background:linear-gradient(135deg, #1e40af, #3b82f6); padding:20px; border-radius:25px; margin-bottom:20px; text-align:center;">
            <div style="display:flex; justify-content:space-around; align-items:center;">
                <div style="flex:1;"><div style="font-size:0.6rem; opacity:0.8;">ALLE NOTEN</div><div style="font-size:1.8rem; font-weight:900;">${sNoten}</div></div>
                <div style="width:1px; height:30px; background:rgba(255,255,255,0.2);"></div>
                <div style="flex:1;"><div style="font-size:0.6rem; opacity:0.8;">FÄCHER SCHNITT</div><div style="font-size:1.8rem; font-weight:900;">${sFaecher}</div></div>
            </div>
            <button onclick="resetApp()" style="background:rgba(255,255,255,0.2); border:none; color:white; padding:5px; border-radius:8px; font-size:0.65rem; margin-top:10px; width:100%; cursor:pointer;">Reset Simulation</button>
        </div>`;

        let html = `<div style="max-width:500px; margin:auto;">
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <div class="menu-btn" onclick="let m=document.getElementById('nav-menu'); m.style.display=m.style.display==='block'?'none':'block'"><div></div><div></div><div></div></div>
                <button onclick="document.getElementById('noten-app-v8').remove()" style="background:#f43f5e; border:none; color:white; border-radius:8px; padding:2px 10px; font-weight:bold;">X</button>
            </div>
            <div id="nav-menu" class="nav-overlay">
                <div class="nav-item" onclick="window.setView('faecher')">📚 Fächer</div>
                <div class="nav-item" onclick="window.setView('stats')">📊 Statistik</div>
            </div> ${header}`;

        if (currentView === 'stats') {
            let dist = { '4':0, '5':0, '6':0, '7':0, '8':0, '9':0, '10':0 };
            allValues.forEach(v => { let b=Math.floor(v); if(b<4)b=4; if(b>10)b=10; dist[b]++; });
            html += `<div class="stat-card">
                <button onclick="window.showLines=!window.showLines; renderApp();" style="position:absolute; right:10px; top:10px; background:#334155; border:none; color:white; padding:4px; border-radius:4px; font-size:0.6rem;">Lines: ${window.showLines?'ON':'OFF'}</button>
                <div style="display:flex; justify-content:center;">${generatePie(dist)}</div>
            </div>`;
        } else {
            fachDaten.forEach((f, fIdx) => {
                const allN = [...f.noten.map(n => ({...n, sim: false})), ...f.simNoten.map(n => ({...n, sim: true}))];
                let s = allN.length > 0 ? (allN.reduce((a, b) => a + b.value, 0) / allN.length) : 0;
                const isOpen = openFaecher.has(fIdx);
                
                // Tendenz-Berechnung
                let mitarbeitNote = allN.find(n => n.thema.includes('mitarbeit'));
                let tendenzHtml = "";
                if (!isOpen && mitarbeitNote) {
                    let nk = s % 1;
                    if (mitarbeitNote.value > s || mitarbeitNote.value >= 7) {
                        tendenzHtml = nk > 0.4 ? `<span style="color:#2dd4bf; font-size:0.6rem;">↑ Aufrundung</span>` : `<span style="color:#f43f5e; font-size:0.6rem;">↓ Abrundung</span>`;
                    } else {
                        tendenzHtml = nk >= 0.85 ? `<span style="color:#2dd4bf; font-size:0.6rem;">↑ Aufrundung</span>` : `<span style="color:#f43f5e; font-size:0.6rem;">↓ Abrundung</span>`;
                    }
                }

                html += `<div style="background:#1e293b; border-radius:18px; margin-bottom:10px; border:1px solid ${isOpen ? '#3b82f6' : '#334155'}; overflow:hidden;">
                    <div onclick="toggleFach(${fIdx})" style="padding:15px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                        <div style="display:flex; flex-direction:column;"><span style="font-weight:bold;">${f.fach}</span>${tendenzHtml}</div>
                        <span style="font-weight:900; color:${getGradeColor(s)==='SPECIAL'?'#60a5fa':getGradeColor(s)}; font-size:1.2rem;">${s>0?s.toFixed(2):'---'}</span>
                    </div>
                    <div style="display:${isOpen ? 'block' : 'none'}; padding:0 15px 15px 15px; background:#0f172a;">
                        ${allN.map((n, ni) => n.sim ? `
                            <div style="display:flex; align-items:center; padding:8px 0; border-bottom:1px solid #2d3a4f; font-size:0.8rem; color:#2dd4bf;">
                                <span style="flex:1;">★ Simuliert:</span>
                                <b style="margin-right:15px;">${n.label}</b>
                                <span onclick="event.stopPropagation(); removeNote(${fIdx}, ${ni}, true)" style="color:#ef4444; cursor:pointer; font-weight:bold; font-size:1.1rem;">✕</span>
                            </div>` : `
                            <div style="display:flex; align-items:center; padding:8px 0; border-bottom:1px solid #1e293b; font-size:0.8rem;">
                                <span style="flex:1; color:#94a3b8; font-size:0.75rem;">${n.thema}</span>
                                <span style="color:#475569; font-size:0.65rem; margin-right:10px;">${n.datum || ''}</span>
                                <b style="margin-right:15px; color:${getGradeColor(n.value)==='SPECIAL'?'#60a5fa':getGradeColor(n.value)}">${n.label}</b>
                                <span onclick="event.stopPropagation(); removeNote(${fIdx}, ${ni}, false)" style="color:#f43f5e; cursor:pointer; font-weight:bold; font-size:1.1rem;">✕</span>
                            </div>`).join('')}
                        <div style="display:flex; gap:8px; margin-top:12px;">
                            <input type="text" id="input-${fIdx}" value="${window.lastSimNote}" placeholder="Note..." oninput="window.lastSimNote=this.value" style="flex:1; background:#1e293b; border:1px solid #334155; color:white; padding:8px; border-radius:8px; outline:none;">
                            <button onclick="addNote(${fIdx})" style="background:#3b82f6; border:none; color:white; padding:0 15px; border-radius:8px; cursor:pointer;">+</button>
                        </div>
                        <div style="margin-top:10px; display:flex; gap:5px;">
                            <input type="number" id="res-${fIdx}" placeholder="Anz." style="width:50px; background:#0f172a; border:1px solid #334155; color:white; border-radius:5px; padding:5px; font-size:0.7rem;">
                            <button onclick="doRescue(${fIdx})" style="flex:1; background:#6366f1; border:none; color:white; border-radius:5px; font-size:0.7rem; cursor:pointer;">🎯 Rettungs-Schnitt berechnen</button>
                        </div>
                        ${rescueResults[fIdx] ? `<div style="margin-top:5px; font-size:0.7rem; text-align:center; color:${rescueResults[fIdx].color}">${rescueResults[fIdx].msg}</div>` : ''}
                    </div>
                </div>`;
            });
        }
        const container = document.getElementById('noten-app-v8') || document.createElement('div');
        if(!container.id) { container.id = "noten-app-v8"; container.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:#020617; color:white; z-index:99999; padding:15px; overflow-y:auto; font-family:sans-serif;"; document.body.appendChild(container); }
        container.innerHTML = html;
    };

    window.setView = (v) => { currentView = v; renderApp(); };
    window.toggleFach = (idx) => { openFaecher.has(idx) ? openFaecher.delete(idx) : openFaecher.add(idx); renderApp(); };
    window.addNote = (idx) => { const val = parseNote(window.lastSimNote); if (val !== null) { fachDaten[idx].simNoten.push({ thema: 'simuliert', label: window.lastSimNote, value: val }); renderApp(); } };
    window.removeNote = (fIdx, nIdx, isSim) => { if (isSim) fachDaten[fIdx].simNoten.splice(nIdx - fachDaten[fIdx].noten.length, 1); else fachDaten[fIdx].noten.splice(nIdx, 1); renderApp(); };
    window.resetApp = () => { fachDaten = JSON.parse(JSON.stringify(originalData)); rescueResults = {}; renderApp(); };
    window.doRescue = (idx) => {
        const count = parseInt(document.getElementById(`res-${idx}`).value) || 1;
        const f = fachDaten[idx]; const all = [...f.noten, ...f.simNoten];
        const target = 6.0; 
        const needed = (target * (all.length + count) - all.reduce((a,b)=>a+b.value,0)) / count;
        rescueResults[idx] = needed > 10 ? {msg:"Unmöglich 💀", color:"#f43f5e"} : {msg:`${count}x Note ${needed.toFixed(2)} nötig`, color:"#fbbf24"};
        renderApp();
    };
})();
