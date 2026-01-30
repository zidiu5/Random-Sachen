(function() {
    const style = document.createElement('style');
    style.innerHTML = `
        #untis-dashboard { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #020617; color: white; z-index: 999999; padding: 20px; font-family: sans-serif; overflow-y: auto; }
        .grid-container { display: flex; gap: 20px; overflow-x: auto; padding-bottom: 40px; align-items: flex-start; scroll-behavior: smooth; }
        .day-column { background: #1e293b; border-radius: 15px; padding: 15px; min-width: 320px; border: 1px solid #334155; flex-shrink: 0; }
        
        .lesson-box { 
            padding: 10px; border-radius: 8px; border-left: 5px solid var(--border-color); 
            background: #0f172a; display: flex; flex-direction: column; justify-content: center;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); margin-bottom: 2px; position: relative;
        }

        .holiday-box {
            padding: 30px 15px; border-radius: 10px; background: rgba(245, 158, 11, 0.05); 
            border: 2px dashed #f59e0b; text-align: center; color: #f59e0b; font-weight: bold; margin-top: 10px;
        }

        .cancelled { opacity: 0.6; border-left-color: #ef4444 !important; background: #1a1010; }
        .cancelled .subject-tag { text-decoration: line-through; color: #f87171; }

        .break-box { 
            height: var(--break-height); display: flex; align-items: center; justify-content: center;
            font-size: 0.65rem; color: #475569; font-style: italic; border-left: 5px solid transparent;
        }

        .status-badge { font-size: 0.6rem; font-weight: bold; padding: 2px 5px; border-radius: 4px; margin-bottom: 4px; display: inline-block; width: fit-content; }
        .badge-cancelled { background: #7f1d1d; color: #fca5a5; }
        .badge-exam { background: #78350f; color: #fcd34d; }
        .badge-change { background: #065f46; color: #a7f3d0; border: 1px solid #10b981; }

        .res-removed { text-decoration: line-through; color: #f87171; font-size: 0.7rem; }
        .res-added { color: #4ade80; font-weight: bold; }

        .header-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; background: #1e40af; padding: 15px 25px; border-radius: 20px; position: sticky; top: 0; z-index: 10; }
        .nav-controls { display: flex; gap: 10px; }
        
        .btn { cursor: pointer; border: none; color: white; border-radius: 8px; padding: 8px 16px; font-weight: bold; transition: all 0.2s; }
        .btn-next { background: #10b981; }
        .btn-danger { background: #f43f5e; border-radius: 50%; width: 35px; }
        .btn-close { background: #475569; border-radius: 50%; width: 35px; }

        .time-tag { font-size: 0.65rem; color: #94a3b8; font-weight: bold; }
        .subject-tag { font-weight: 800; font-size: 1rem; color: #f8fafc; }
        .info-tag { font-size: 0.7rem; color: #64748b; }
        .info-note { margin-top: 4px; padding: 4px; background: #1e3a8a; border-radius: 4px; font-size: 0.65rem; color: #93c5fd; border-left: 2px solid #3b82f6; }
        
        .loading-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; border-radius: 15px; font-weight: bold; z-index: 20; }
        h3 { margin: 0 0 10px 0; font-size: 1rem; color: #f8fafc; }
    `;
    document.head.appendChild(style);

    const timeToMin = (t) => { if(!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    let lastGrabbedText = ""; 

    async function fetchTooltip(icon) {
        return new Promise((resolve) => {
            icon.scrollIntoView({ block: 'center' });
            icon.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            let attempts = 0;
            const check = setInterval(() => {
                const tooltipInner = document.querySelector('.ant-tooltip:not(.ant-tooltip-hidden) .ant-tooltip-inner');
                const currentText = tooltipInner ? tooltipInner.innerText.trim() : "";
                if (currentText !== "" && (currentText !== lastGrabbedText || attempts > 25)) {
                    clearInterval(check);
                    lastGrabbedText = currentText; 
                    icon.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
                    resolve(currentText);
                } else if (attempts > 35) {
                    clearInterval(check); resolve(null);
                }
                attempts++;
            }, 40);
        });
    }

    async function scanTimetable() {
        const schedule = [];
        const columns = document.querySelectorAll('.timetable-grid--column-container');
        lastGrabbedText = ""; 

        for (const col of columns) {
            const dateStr = col.querySelector('.column-header-print-label-text')?.innerText.trim();
            if (!dateStr) continue;
            
            const lessons = [];
            const holidayLayer = col.querySelector('.holidays');
            const cards = col.querySelectorAll('.timetable-grid-card');

            if (holidayLayer) {
                const title = holidayLayer.querySelector('.timetable-layer--text-title')?.innerText || "Ferien";
                lessons.push({ type: 'holiday', title: title });
            } else if (cards.length === 0) {
                lessons.push({ type: 'holiday', title: "Frei / Wochenende" });
            } else {
                for (const card of cards) {
                    const start = card.querySelector('[data-testid="lesson-card-time-start"]')?.innerText || "";
                    const end = card.querySelector('[data-testid="lesson-card-time-end"]')?.innerText || "";
                    const isCancelled = card.querySelector('.lesson-card.cancelled, [data-testid*="indicator-cancelled"]') !== null;
                    const isExam = card.querySelector('[data-testid*="indicator-exam"]') !== null;
                    const isChange = card.querySelector('.lesson-card-substitution-tag') !== null;
                    const infoIcon = card.querySelector('.lesson-card-icon-info, .lesson-card-icon-info-other');
                    
                    let note = null;
                    if (infoIcon) { note = await fetchTooltip(infoIcon); await new Promise(r => setTimeout(r, 100)); }

                    // FIX: Vertretungs-Logik wieder integriert
                    const getResourcesHTML = (selector) => {
                        const container = card.querySelector(selector);
                        if (!container) return "---";
                        const removed = Array.from(container.querySelectorAll('[data-testid="removed-resource"]')).map(r => `<span class="res-removed">${r.innerText}</span>`);
                        const added = Array.from(container.querySelectorAll('[data-testid="added-resource"]')).map(r => `<span class="res-added">${r.innerText}</span>`);
                        const regular = Array.from(container.querySelectorAll('[data-testid="regular-resource"]')).map(r => r.innerText);
                        let out = [...removed, ...added].join(', ');
                        if (regular.length > 0) out += (out ? ' | ' : '') + regular.join(', ');
                        return out || "---";
                    };

                    lessons.push({
                        type: 'lesson',
                        start, end, startMin: timeToMin(start), endMin: timeToMin(end),
                        duration: timeToMin(end) - timeToMin(start),
                        subject: card.querySelector('[data-testid="lesson-card-subject"]')?.innerText || "---",
                        teachers: getResourcesHTML('[data-testid*="teachers"]'),
                        rooms: getResourcesHTML('[data-testid*="rooms"]'),
                        note, isCancelled, isExam, isChange,
                        color: getComputedStyle(card.querySelector('.lesson-card-color-bar') || card).getPropertyValue('--color').trim()
                    });
                }
            }
            lessons.sort((a,b) => (a.startMin || 0) - (b.startMin || 0));
            schedule.push({ datum: dateStr, stunden: lessons });
        }
        return schedule;
    }

    window.nextWeekAndScan = async function() {
        const btn = document.querySelector('[data-testid="date-picker-with-arrows-next"]');
        if (!btn) return;
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay'; overlay.innerText = 'Lade nächste Woche...';
        document.getElementById('untis-dashboard').appendChild(overlay);
        btn.click();
        await new Promise(r => setTimeout(r, 1500));
        const data = await scanTimetable();
        render(data);
    };

    function render(data) {
        let db = JSON.parse(localStorage.getItem('untis_db') || '{}');
        data.forEach(d => { db[d.datum] = d.stunden; });
        localStorage.setItem('untis_db', JSON.stringify(db));

        const sortedDates = Object.keys(db).sort((a, b) => {
            const [d1, m1] = a.split(' ')[1].split('.');
            const [d2, m2] = b.split(' ')[1].split('.');
            return new Date(2026, m1-1, d1) - new Date(2026, m2-1, d2);
        });

        let html = `
            <div id="untis-dashboard">
                <div class="header-nav">
                    <div><h2 style="margin:0; font-size:1.1rem;">WebUntis Precision Plan</h2><small>Ferien & Freie Tage inkludiert</small></div>
                    <div class="nav-controls">
                        <button class="btn btn-next" onclick="nextWeekAndScan()">➕ Woche laden</button>
                        <button class="btn btn-danger" onclick="localStorage.removeItem('untis_db'); location.reload();">🗑️</button>
                        <button class="btn btn-close" onclick="document.getElementById('untis-dashboard').remove()">✕</button>
                    </div>
                </div>
                <div class="grid-container">`;

        sortedDates.forEach(date => {
            html += `<div class="day-column"><h3>${date}</h3>`;
            const items = db[date] || [];
            items.forEach((item, i) => {
                if (item.type === 'holiday') {
                    html += `<div class="holiday-box">🌴 ${item.title}</div>`;
                } else {
                    if (i > 0 && items[i-1].type === 'lesson') {
                        const breakMin = item.startMin - items[i-1].endMin;
                        if (breakMin > 0) {
                            html += `<div class="break-box" style="--break-height: ${breakMin * 1.2}px">☕ ${breakMin} Min.</div>`;
                        }
                    }

                    const h = item.duration * 1.5;
                    let statusBadge = "";
                    if (item.isCancelled) statusBadge = `<span class="status-badge badge-cancelled">ENTFÄLLT</span>`;
                    else if (item.isExam) statusBadge = `<span class="status-badge badge-exam">PRÜFUNG</span>`;
                    else if (item.isChange) statusBadge = `<span class="status-badge badge-change">VERTRETUNG</span>`;

                    html += `
                        <div class="lesson-box ${item.isCancelled ? 'cancelled' : ''}" style="--border-color: ${item.color}; height: ${h}px;">
                            ${statusBadge}
                            <div class="time-tag">${item.start} - ${item.end}</div>
                            <span class="subject-tag">${item.subject}</span>
                            <div class="info-tag">👤 ${item.teachers} | 🚪 ${item.rooms}</div>
                            ${item.note ? `<div class="info-note">ℹ️ ${item.note}</div>` : ''}
                        </div>`;
                }
            });
            html += `</div>`;
        });

        html += `</div></div>`;
        document.getElementById('untis-dashboard')?.remove();
        document.body.insertAdjacentHTML('beforeend', html);
        const gc = document.querySelector('.grid-container'); if(gc) gc.scrollLeft = gc.scrollWidth;
    }

    scanTimetable().then(render);
})();
