// ============================================================
//  AUDIT 4G/5G — Version Complète & Corrigée (basée sur Starlink v3)
//  IPKONEKT / Bouygues Telecom
//  Logos corrects + 2 photos par point de mesure + structure adaptée
// ============================================================

const photoStore = {};
let measureCounter = 0;
let evacPoints = [];
let evacPointCounter = 0;
let cheminementCounter = 1;

// ============================================================
//  ATTENTE DES LIBRAIRIES
// ============================================================
function waitForLibs() {
    return new Promise((resolve) => {
        const check = () => {
            if (typeof window.docx !== 'undefined' &&
                typeof window.saveAs !== 'undefined' &&
                typeof window.Editor !== 'undefined') {
                resolve();
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });
}

// ============================================================
//  INIT
// ============================================================
document.addEventListener("DOMContentLoaded", async () => {
    await waitForLibs();

    const today = new Date().toISOString().slice(0, 10);
    document.getElementById("date_audit").value = today;
    document.getElementById("signataire_date").value = today;

    // Photos classiques (façade, etc.)
    document.querySelectorAll('input[type="file"][data-photo-key]').forEach(input => {
        input.addEventListener("change", handlePhotoUpload);
    });

    // Délégation clics (Annoter + Effacer)
    document.body.addEventListener("click", handleGlobalClick);

    // Points de mesure (3 par défaut)
    initMeasurePoints();
    document.getElementById("addMeasurePointBtn").addEventListener("click", () => addMeasurePoint());

    // Cheminement & Évacuation
    const btnChem = document.getElementById("addCheminementBtn");
    if (btnChem) btnChem.addEventListener("click", addCheminementItem);

    document.getElementById("evacFileInput").addEventListener("change", handleEvacUpload);
    document.getElementById("addEvacPointBtn").addEventListener("click", addEvacPoint);

    // Import JSON
    document.getElementById("importJSONInput").addEventListener("change", importJSON);

    console.log("✅ Audit 4G/5G initialisé avec succès");
});

// ============================================================
//  GESTION GLOBALE DES CLICS (Annoter / Effacer)
// ============================================================
function handleGlobalClick(e) {
    // Annoter
    const annotateBtn = e.target.closest("[data-annotate]");
    if (annotateBtn) {
        const key = annotateBtn.dataset.annotate;
        if (!photoStore[key]) {
            alert("Importez d'abord une photo avant de l'annoter.");
            return;
        }
        window.Editor.open(key, "Photo " + key);
        return;
    }
    // Effacer photo standard
    const clearBtn = e.target.closest("[data-clear]");
    if (clearBtn) {
        const key = clearBtn.dataset.clear;
        delete photoStore[key];
        const preview = document.getElementById("preview_" + key);
        if (preview) {
            preview.src = "";
            preview.classList.remove("shown");
        }
        const fileInput = document.querySelector(`input[data-photo-key="${key}"]`);
        if (fileInput) fileInput.value = "";
        const annBtn = document.querySelector(`[data-annotate="${key}"]`);
        if (annBtn) annBtn.disabled = true;
        return;
    }
    // Effacer photo measure
    const clearMeasure = e.target.closest("[data-clear-measure]");
    if (clearMeasure) {
        const idx = clearMeasure.dataset.clearMeasure;
        const keys = [`mesure_lieu_${idx}`, `mesure_screen_${idx}`];
        keys.forEach(k => {
            delete photoStore[k];
            const prev = document.getElementById(`preview_${k}`);
            if (prev) {
                prev.src = "";
                prev.classList.remove("shown");
            }
        });
        const fileInputs = document.querySelectorAll(`[data-measure-index="${idx}"]`);
        fileInputs.forEach(inp => inp.value = "");
        return;
    }
    // Effacer photo cheminement
    const clearCheminement = e.target.closest("[data-clear-cheminement]");
    if (clearCheminement) {
        const idx = clearCheminement.dataset.clearCheminement;
        const key = `cheminement_${idx}`;
        delete photoStore[key];
        const prev = document.getElementById(`preview_cheminement_${idx}`);
        if (prev) {
            prev.src = "";
            prev.classList.remove("shown");
        }
        const fileInput = document.querySelector(`[data-cheminement-index="${idx}"]`);
        if (fileInput) fileInput.value = "";
        return;
    }
}

// ============================================================
//  GESTION PHOTOS
// ============================================================
async function handlePhotoUpload(e) {
    const key = e.target.dataset.photoKey;
    await processPhoto(e.target.files[0], key);
}

async function processPhoto(file, key) {
    if (!file) return;
    const buf = await file.arrayBuffer();
    const u8 = new Uint8Array(buf);
    const mime = file.type.toLowerCase();
    const type = (mime.includes("jpeg") || mime.includes("jpg")) ? "jpg" : "png";

    const dataUrl = await new Promise(r => {
        const reader = new FileReader();
        reader.onload = ev => r(ev.target.result);
        reader.readAsDataURL(file);
    });

    const dims = await new Promise(r => {
        const img = new Image();
        img.onload = () => r({w: img.naturalWidth, h: img.naturalHeight});
        img.src = dataUrl;
    });

    photoStore[key] = {
        data: u8,
        type,
        name: file.name,
        dataUrl,
        naturalWidth: dims.w,
        naturalHeight: dims.h
    };

    const preview = document.getElementById("preview_" + key);
    if (preview) {
        preview.src = dataUrl;
        preview.classList.add("shown");
    }
}

async function handleMeasurePhoto(e) {
    const index = e.target.dataset.measureIndex;
    const type = e.target.dataset.photoType;
    const key = `mesure_${type}_${index}`;
    await processPhoto(e.target.files[0], key);
}

// ============================================================
//  POINTS DE MESURE — 2 PHOTOS + GRILLE COMPACTE
// ============================================================
function initMeasurePoints() {
    const container = document.getElementById("measurePointsContainer");
    if (container && container.children.length === 0) {
        for (let i = 1; i <= 3; i++) addMeasurePoint(i);
    }
}

function addMeasurePoint(num = null) {
    measureCounter++;
    const count = num || measureCounter;
    const container = document.getElementById("measurePointsContainer");

    const div = document.createElement("div");
    div.className = "measure-point-group";
    div.dataset.point = count;
    div.innerHTML = `
        <h4>Point ${count}</h4>
        <input type="text" class="point-lieu" placeholder="Lieu / Pièce" style="width:100%;margin-bottom:8px;">

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin:12px 0;">
            <div>
                <label>📷 Photo du lieu</label><br>
                <input type="file" accept="image/*" data-measure-index="${count}" data-photo-type="lieu">
                <img id="preview_mesure_lieu_${count}" class="photo-preview">
            </div>
            <div>
                <label>📱 Copie écran mesure</label><br>
                <input type="file" accept="image/*" data-measure-index="${count}" data-photo-type="screen">
                <img id="preview_mesure_screen_${count}" class="photo-preview">
            </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;">
            <input type="text" class="measure-rsrp" placeholder="RSRP (dBm)">
            <input type="text" class="measure-rsrq" placeholder="RSRQ (dB)">
            <input type="text" class="measure-sinr" placeholder="SINR (dB)">
            <input type="text" class="measure-down" placeholder="Débit desc (Mbps)">
            <input type="text" class="measure-up" placeholder="Débit mont (Mbps)">
            <input type="text" class="measure-band" placeholder="Bande / EARFCN">
        </div>
        <div style="margin-top:8px;font-size:0.9rem;color:#666;">
            <strong>Analyse :</strong> <span class="analysis-result">En attente de données</span>
        </div>
    `;
    container.appendChild(div);

    div.querySelectorAll('input[type="file"]').forEach(inp => inp.addEventListener("change", handleMeasurePhoto));

    // Événements pour analyse automatique
    div.querySelectorAll('.measure-rsrp, .measure-rsrq, .measure-sinr').forEach(el => {
        el.addEventListener('input', function() { analyzePoint(div); });
    });
}

function analyzePoint(group) {
    const rsrp = parseFloat(group.querySelector('.measure-rsrp').value);
    const rsrq = parseFloat(group.querySelector('.measure-rsrq').value);
    const sinr = parseFloat(group.querySelector('.measure-sinr').value);
    const resultSpan = group.querySelector('.analysis-result');

    if (isNaN(rsrp) || isNaN(rsrq) || isNaN(sinr)) {
        resultSpan.textContent = "En attente de données";
        return;
    }

    let score = 0;
    if (rsrp >= -75) score += 30;
    else if (rsrp >= -90) score += 20;
    else if (rsrp >= -105) score += 10;
    else if (rsrp >= -115) score += 5;
    else score += 0;

    if (rsrq >= -5) score += 30;
    else if (rsrq >= -10) score += 20;
    else if (rsrq >= -13) score += 10;
    else score += 0;

    if (sinr >= 20) score += 40;
    else if (sinr >= 13) score += 30;
    else if (sinr >= 5) score += 20;
    else if (sinr >= 0) score += 10;
    else score += 0;

    let label, cls;
    if (score >= 80) { label = "Très bonne qualité radio"; cls = "badge-green"; }
    else if (score >= 60) { label = "Bonne qualité radio"; cls = "badge-blue"; }
    else if (score >= 40) { label = "Qualité radio moyenne"; cls = "badge-orange"; }
    else if (score >= 20) { label = "Qualité radio faible"; cls = "badge-red"; }
    else { label = "Signal radio inutilisable"; cls = "badge-dark"; }

    resultSpan.innerHTML = `<span class="radio-quality-badge ${cls}">${label}</span> (score ${score}/100)`;
    group.dataset.analysisPhrase = label;
}

// ============================================================
//  PLAN D'ÉVACUATION
// ============================================================
function handleEvacUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
        const dataUrl = ev.target.result;
        const buf = await file.arrayBuffer();
        const u8 = new Uint8Array(buf);
        const mime = file.type.toLowerCase();
        const type = (mime.includes("jpeg") || mime.includes("jpg")) ? "jpg" : "png";

        const key = "evac_plan";
        const dims = await new Promise(r => {
            const img = new Image();
            img.onload = () => r({w: img.naturalWidth, h: img.naturalHeight});
            img.src = dataUrl;
        });

        photoStore[key] = {
            data: u8,
            type,
            name: file.name,
            dataUrl,
            naturalWidth: dims.w,
            naturalHeight: dims.h
        };

        const container = document.getElementById('evacStageContainer');
        container.style.display = 'block';
        document.getElementById('evacBgImage').src = dataUrl;
        document.getElementById('evacUploadArea').style.display = 'none';

        evacPoints = [];
        document.querySelectorAll('.evac-point').forEach(el => el.remove());
    };
    reader.readAsDataURL(file);
}

function addEvacPoint() {
    const container = document.getElementById('evacStageWrap');
    if (!container.querySelector('#evacBgImage')?.src) {
        alert("Veuillez d'abord importer un plan.");
        return;
    }
    evacPointCounter++;
    const div = document.createElement('div');
    div.className = 'evac-point';
    div.style.position = 'absolute';
    div.style.width = '40px';
    div.style.height = '40px';
    div.style.borderRadius = '50%';
    div.style.background = 'rgba(0,100,0,0.4)';
    div.style.boxShadow = '0 0 20px rgba(0,0,0,0.3)';
    div.style.cursor = 'move';
    div.style.pointerEvents = 'auto';
    div.style.transform = 'translate(-50%, -50%)';
    div.style.left = '50%';
    div.style.top = '50%';
    div.dataset.point = evacPointCounter;

    const label = document.createElement('div');
    label.style.position = 'absolute';
    label.style.bottom = '100%';
    label.style.left = '50%';
    label.style.transform = 'translateX(-50%)';
    label.style.background = 'rgba(255,255,255,0.9)';
    label.style.padding = '2px 6px';
    label.style.borderRadius = '4px';
    label.style.fontWeight = 'bold';
    label.style.fontSize = '12px';
    label.style.whiteSpace = 'nowrap';
    label.textContent = `P${evacPointCounter}`;
    div.appendChild(label);

    // Drag
    let isDragging = false, startX, startY, origLeft, origTop;
    div.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.evac-point')) {
            isDragging = true;
            const rect = div.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            origLeft = parseFloat(div.style.left);
            origTop = parseFloat(div.style.top);
            div.setPointerCapture(e.pointerId);
        }
    });
    div.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const dx = (e.clientX - startX) / container.getBoundingClientRect().width * 100;
        const dy = (e.clientY - startY) / container.getBoundingClientRect().height * 100;
        div.style.left = (origLeft + dx) + '%';
        div.style.top = (origTop + dy) + '%';
    });
    div.addEventListener('pointerup', (e) => {
        if (isDragging) {
            isDragging = false;
            div.releasePointerCapture(e.pointerId);
        }
    });

    updateEvacPointColor(div, evacPointCounter);
    container.appendChild(div);
    evacPoints.push({ el: div, pointId: evacPointCounter });
}

function updateEvacPointColor(div, pointIdx) {
    const group = document.querySelector(`.measure-point-group[data-point="${pointIdx}"]`);
    if (!group) {
        div.style.background = 'rgba(150,150,150,0.4)';
        return;
    }
    const resultSpan = group.querySelector('.analysis-result');
    if (!resultSpan) return;
    const text = resultSpan.textContent;
    let color;
    if (text.includes('Très bonne')) color = 'rgba(40,167,69,0.6)';
    else if (text.includes('Bonne')) color = 'rgba(0,123,255,0.6)';
    else if (text.includes('Moyenne')) color = 'rgba(253,126,20,0.6)';
    else if (text.includes('Faible')) color = 'rgba(220,53,69,0.6)';
    else color = 'rgba(108,117,125,0.6)';
    div.style.background = color;
}

// ============================================================
//  CHEMINEMENT
// ============================================================
function addCheminementItem() {
    const container = document.getElementById('cheminementContainer');
    if (!container) return;
    const idx = cheminementCounter++;
    const div = document.createElement('div');
    div.className = 'cheminement-item';
    div.innerHTML = `
        <div class="photo-upload">
            <div class="photo-upload-label">
                📷 Photo ${idx}
                <input type="file" accept="image/*" data-cheminement-index="${idx}">
                <button class="annotate-btn" data-annotate-cheminement="${idx}" disabled>✏ Annoter</button>
                <button class="clear-photo" data-clear-cheminement="${idx}">✕</button>
            </div>
            <img class="photo-preview" id="preview_cheminement_${idx}">
        </div>
        <div class="field-row">
            <label>Commentaire</label>
            <textarea class="cheminement-comment" rows="2" placeholder="Description du cheminement..."></textarea>
        </div>
    `;
    container.appendChild(div);

    const fileInput = div.querySelector('input[type="file"]');
    fileInput.addEventListener('change', async function() {
        const idx2 = this.dataset.cheminementIndex;
        const key = `cheminement_${idx2}`;
        await processPhoto(this.files[0], key);
        const annBtn = div.querySelector(`[data-annotate-cheminement="${idx2}"]`);
        if (annBtn) annBtn.disabled = false;
    });

    // Annoter
    const annBtn = div.querySelector(`[data-annotate-cheminement="${idx}"]`);
    annBtn.addEventListener('click', function() {
        const idx2 = this.dataset.annotateCheminement;
        const key = `cheminement_${idx2}`;
        if (!photoStore[key]) {
            alert("Importez d'abord une photo.");
            return;
        }
        window.Editor.open(key, `Cheminement ${idx2}`);
    });
}

// ============================================================
//  UTILITAIRES
// ============================================================
function val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
}

function radioValue(name) {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : "";
}

function showStatus(msg, type = "") {
    const s = document.getElementById("status");
    if (s) {
        s.textContent = msg;
        s.className = "status " + type;
    }
}

function formatDateFR(isoDate) {
    if (!isoDate) return "";
    const parts = isoDate.split("-");
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function buildFilename() {
    const ref = (val("ref_commande") || "").replace(/[^a-zA-Z0-9_-]/g, "_");
    const raison = (val("raison_sociale") || "Site").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0,30);
    const date = val("date_audit") || new Date().toISOString().slice(0,10);
    let parts = ["AUDIT_4G5G"];
    if (ref) parts.push(ref);
    if (raison) parts.push(raison);
    parts.push(date);
    return parts.join("_") + ".docx";
}

function resetForm() {
    if (!confirm("Réinitialiser tout le formulaire ? Les photos importées seront perdues.")) return;
    document.querySelectorAll("input, textarea, select").forEach(el => {
        if (el.type === "checkbox" || el.type === "radio") el.checked = false;
        else el.value = "";
    });
    Object.keys(photoStore).forEach(k => delete photoStore[k]);
    document.querySelectorAll(".photo-preview").forEach(p => {
        p.src = "";
        p.classList.remove("shown");
    });
    document.querySelectorAll(".annotate-btn, [data-annotate-measure], [data-annotate-cheminement]").forEach(b => b.disabled = true);
    document.querySelectorAll(".measure-point-group").forEach(el => el.remove());
    measureCounter = 0;
    initMeasurePoints();
    document.getElementById('evacStageContainer').style.display = 'none';
    document.getElementById('evacUploadArea').style.display = 'block';
    document.querySelectorAll('.evac-point').forEach(el => el.remove());
    evacPoints = [];
    evacPointCounter = 0;
    document.querySelectorAll('.cheminement-item').forEach(el => el.remove());
    cheminementCounter = 1;
    addCheminementItem();
    showStatus("Formulaire réinitialisé.", "success");
}

function exportJSON() {
    const data = collectFormData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildFilename().replace('.docx', '.json');
    a.click();
    URL.revokeObjectURL(url);
}

function importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            populateForm(data);
            showStatus("Données importées avec succès.", "success");
        } catch (err) {
            showStatus("Erreur lors de l'import : " + err.message, "error");
        }
    };
    reader.readAsText(file);
    event.target.value = "";
}

function collectFormData() {
    const data = {
        ref_commande: val("ref_commande"),
        auditeur: val("auditeur"),
        date_audit: val("date_audit"),
        raison_sociale: val("raison_sociale"),
        adresse: val("adresse"),
        code_postal: val("code_postal"),
        ville: val("ville"),
        horaire: val("horaire"),
        procedure_acces: val("procedure_acces"),
        tel_site: val("tel_site"),
        contact_nom: val("contact_nom"),
        contact_fonction: val("contact_fonction"),
        contact_tel: val("contact_tel"),
        contact_mail: val("contact_mail"),
        classe: radioValue("classe"),
        localisation_baie: val("localisation_baie"),
        nb_prises: val("nb_prises"),
        rj45: radioValue("rj45"),
        devis_desserte: radioValue("devis_desserte"),
        mesure_points: [],
        heure_debut: val("heure_debut"),
        heure_fin: val("heure_fin"),
        duree_totale: val("duree_totale"),
        nb_techniciens: val("nb_techniciens"),
        nacelle_prevoir: radioValue("nacelle_prevoir"),
        echelle_prevoir: radioValue("echelle_prevoir"),
        observations: val("observations"),
        signataire_nom: val("signataire_nom"),
        signataire_date: val("signataire_date"),
    };

    document.querySelectorAll('.measure-point-group').forEach(group => {
        const point = {
            lieu: group.querySelector('.point-lieu').value,
            rsrp: group.querySelector('.measure-rsrp').value,
            rsrq: group.querySelector('.measure-rsrq').value,
            sinr: group.querySelector('.measure-sinr').value,
            down: group.querySelector('.measure-down').value,
            up: group.querySelector('.measure-up').value,
            band: group.querySelector('.measure-band').value,
            analysis: group.querySelector('.analysis-result').textContent,
        };
        data.mesure_points.push(point);
    });

    return data;
}

function populateForm(data) {
    for (const [key, value] of Object.entries(data)) {
        if (key === 'mesure_points') continue;
        const el = document.getElementById(key);
        if (el) {
            if (el.type === 'radio') {
                const radio = document.querySelector(`input[name="${key}"][value="${value}"]`);
                if (radio) radio.checked = true;
            } else {
                el.value = value || '';
            }
        }
    }
    document.querySelectorAll('.measure-point-group').forEach(el => el.remove());
    measureCounter = 0;
    data.mesure_points.forEach((p, idx) => {
        addMeasurePoint(idx + 1);
        const group = document.querySelector(`.measure-point-group[data-point="${idx+1}"]`);
        if (group) {
            group.querySelector('.point-lieu').value = p.lieu || '';
            group.querySelector('.measure-rsrp').value = p.rsrp || '';
            group.querySelector('.measure-rsrq').value = p.rsrq || '';
            group.querySelector('.measure-sinr').value = p.sinr || '';
            group.querySelector('.measure-down').value = p.down || '';
            group.querySelector('.measure-up').value = p.up || '';
            group.querySelector('.measure-band').value = p.band || '';
            analyzePoint(group);
        }
    });
}

// ============================================================
//  GÉNÉRATION WORD — COMPLÈTE
// ============================================================
async function generateDocument() {
    showStatus("Génération du document en cours...", "loading");

    try {
        const docxLib = window.docx || docx;
        const {
            Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
            ImageRun, Header, Footer, AlignmentType, BorderStyle, WidthType,
            ShadingType, VerticalAlign, TabStopType
        } = docxLib;

        const COLOR_PRIMARY = "1F3864";
        const COLOR_ACCENT = "2E75B6";
        const COLOR_HEADER_BG = "2E5481";
        const COLOR_TABLE_HEADER = "DEEAF6";
        const COLOR_BORDER = "BFBFBF";
        const COLOR_TEXT = "222222";
        const FONT = "Calibri";

        const border = { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER };
        const borders = { top: border, bottom: border, left: border, right: border };

        function P(text, opts = {}) {
            return new Paragraph({
                alignment: opts.align || AlignmentType.LEFT,
                spacing: opts.spacing || { before: 0, after: 80 },
                children: [new TextRun({ text: text || "", bold: opts.bold || false, size: opts.size || 20, color: opts.color || COLOR_TEXT, font: FONT })]
            });
        }
        function emptyP() { return new Paragraph({ children: [new TextRun({ text: "" })] }); }
        function cell(content, opts = {}) {
            return new TableCell({
                borders,
                width: { size: opts.width || 4680, type: WidthType.DXA },
                children: [typeof content === "string" ? P(content) : content]
            });
        }

        function makePhotoBlock(label, photoKey) {
            const photo = photoStore[photoKey];
            if (!photo) return null;
            const ratio = Math.min(400 / (photo.naturalWidth || 400), 260 / (photo.naturalHeight || 260));
            const w = Math.round((photo.naturalWidth || 400) * ratio);
            const h = Math.round((photo.naturalHeight || 260) * ratio);

            return new Table({
                width: { size: 9360, type: WidthType.DXA },
                rows: [new TableRow({
                    children: [new TableCell({
                        borders,
                        children: [
                            P("📷 " + label, { bold: true, color: COLOR_PRIMARY }),
                            new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: photo.data, transformation: { width: w, height: h }, type: photo.type })] })
                        ]
                    })]
                })]
            });
        }

        function makeRepeatingHeader() {
            return new Header({
                children: [new Table({
                    width: { size: 9360, type: WidthType.DXA },
                    rows: [new TableRow({
                        children: [
                            new TableCell({ children: [new Paragraph({ children: [new ImageRun({ data: b64ToUint8Array(LOGO_IPKONEKT_B64), transformation: { width: 110, height: 55 } })] })] }),
                            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "RAPPORT D'AUDIT - INSTALLATION ANTENNE 4G/5G", bold: true, size: 28, color: COLOR_PRIMARY })] })] }),
                            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new ImageRun({ data: b64ToUint8Array(LOGO_BOUYGUES_B64), transformation: { width: 130, height: 55 } })] })] })
                        ]
                    })]
                })]
            });
        }

        const children = [];

        // Bandeau titre
        children.push(makeRepeatingHeader());

        // En-tête
        const refTable = new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [3120, 3120, 3120],
            rows: [
                new TableRow({
                    tableHeader: true,
                    children: [
                        cell("Référence commande", { width: 3120, shading: COLOR_TABLE_HEADER }),
                        cell("Auditeur / Intervenant", { width: 3120, shading: COLOR_TABLE_HEADER }),
                        cell("Date d'audit", { width: 3120, shading: COLOR_TABLE_HEADER })
                    ]
                }),
                new TableRow({
                    children: [
                        cell(val("ref_commande") || "—"),
                        cell(val("auditeur") || "—"),
                        cell(formatDateFR(val("date_audit")) || "—")
                    ]
                })
            ]
        });
        children.push(refTable);

        // SECTION 1
        children.push(P("1. Informations administratives du client", { bold: true, size: 26, color: COLOR_PRIMARY }));
        const tableInfos = new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [3120, 1560, 1560, 3120],
            rows: [
                new TableRow({ children: [cell("Raison sociale du site audité", { width: 3120 }), cell(val("raison_sociale") || "—", { width: 6240, columnSpan: 3 })] }),
                new TableRow({ children: [cell("Adresse", { width: 3120 }), cell(val("adresse") || "—", { width: 6240, columnSpan: 3 })] }),
                new TableRow({ children: [cell("Code postal", { width: 3120 }), cell("CP : " + (val("code_postal") || "—"), { width: 1560 }), cell("Ville", { width: 1560, shading: COLOR_TABLE_HEADER }), cell(val("ville") || "—", { width: 3120 })] }),
                new TableRow({ children: [cell("Horaire d'ouverture du site", { width: 3120 }), cell(val("horaire") || "—", { width: 6240, columnSpan: 3 })] }),
                new TableRow({ children: [cell("Procédure d'accès", { width: 3120 }), cell(val("procedure_acces") || "—", { width: 6240, columnSpan: 3 })] }),
                new TableRow({ children: [cell("Téléphone du site", { width: 3120 }), cell(val("tel_site") || "—", { width: 6240, columnSpan: 3 })] }),
                new TableRow({ children: [cell("Nom du contact client sur site", { width: 3120 }), cell(val("contact_nom") || "—", { width: 6240, columnSpan: 3 })] }),
                new TableRow({ children: [cell("Fonction", { width: 3120 }), cell(val("contact_fonction") || "—", { width: 6240, columnSpan: 3 })] }),
                new TableRow({ children: [cell("Téléphone / Mail contact", { width: 3120 }), cell(val("contact_tel") || "—", { width: 1560 }), cell("Mail", { width: 1560, shading: COLOR_TABLE_HEADER }), cell(val("contact_mail") || "—", { width: 3120 })] })
            ]
        });
        children.push(tableInfos);

        // SECTION 2
        children.push(P("2. Informations techniques client", { bold: true, size: 26, color: COLOR_PRIMARY }));
        const tableTech = new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [3120, 6240],
            rows: [
                new TableRow({ children: [cell("Le bâtiment est-il classé ?", { width: 3120 }), cell(radioValue("classe") || "—", { width: 6240 })] }),
                new TableRow({ children: [cell("Localisation de la baie informatique", { width: 3120 }), cell(val("localisation_baie") || "—", { width: 6240 })] }),
                new TableRow({ children: [cell("Nombre de prises électriques disponibles", { width: 3120 }), cell(val("nb_prises") || "—", { width: 6240 })] }),
                new TableRow({ children: [cell("Présence d'une prise RJ45 à l'emplacement optimal", { width: 3120 }), cell(radioValue("rj45") || "—", { width: 6240 })] }),
                new TableRow({ children: [cell("Si non, devis desserte à prévoir", { width: 3120 }), cell(radioValue("devis_desserte") || "—", { width: 6240 })] })
            ]
        });
        children.push(tableTech);

        // SECTION 3 - Mesures
        children.push(P("3. Mesures radio 4G/5G", { bold: true, size: 26, color: COLOR_PRIMARY }));
        children.push(P("Les tests sont réalisés avec l'application Network Cell Info Lite."));
        children.push(P("3 points de mesures à réaliser :"));
        children.push(P("• Emplacement souhaité par le client"));
        children.push(P("• Emplacement préconisé par le technicien"));
        children.push(P("• À l'extérieur du bâtiment"));

        document.querySelectorAll('.measure-point-group').forEach((group, idx) => {
            const num = idx + 1;
            const lieu = group.querySelector('.point-lieu').value || `Point ${num}`;
            const rsrp = group.querySelector('.measure-rsrp').value || "";
            const rsrq = group.querySelector('.measure-rsrq').value || "";
            const sinr = group.querySelector('.measure-sinr').value || "";
            const down = group.querySelector('.measure-down').value || "";
            const up = group.querySelector('.measure-up').value || "";
            const band = group.querySelector('.measure-band').value || "";
            const analysis = group.querySelector('.analysis-result').textContent || "";

            children.push(P(`Mesure ${num} — ${lieu}`, { bold: true, size: 22, color: COLOR_ACCENT }));
            const tableMesure = new Table({
                width: { size: 9360, type: WidthType.DXA },
                columnWidths: [4680, 4680],
                rows: [
                    new TableRow({ tableHeader: true, children: [cell("Paramètre", { width: 4680 }), cell("Valeur", { width: 4680 })] }),
                    new TableRow({ children: [cell("RSRP (dBm)", { width: 4680 }), cell(rsrp || "—", { width: 4680 })] }),
                    new TableRow({ children: [cell("RSRQ (dB)", { width: 4680 }), cell(rsrq || "—", { width: 4680 })] }),
                    new TableRow({ children: [cell("SINR (dB)", { width: 4680 }), cell(sinr || "—", { width: 4680 })] }),
                    new TableRow({ children: [cell("Débit descendant (Mbps)", { width: 4680 }), cell(down || "—", { width: 4680 })] }),
                    new TableRow({ children: [cell("Débit montant (Mbps)", { width: 4680 }), cell(up || "—", { width: 4680 })] }),
                    new TableRow({ children: [cell("Bande", { width: 4680 }), cell(band || "—", { width: 4680 })] })
                ]
            });
            children.push(tableMesure);
            children.push(P("Analyse : " + analysis));

            const key1 = `mesure_lieu_${num}`;
            if (photoStore[key1]) {
                const pb = makePhotoBlock(`Photo du lieu - Point ${num}`, key1);
                if (pb) children.push(pb);
            }
            const key2 = `mesure_screen_${num}`;
            if (photoStore[key2]) {
                const pb = makePhotoBlock(`Copie écran - Point ${num}`, key2);
                if (pb) children.push(pb);
            }
        });

        // SECTION 4 - Plan d'évacuation
        children.push(P("4. Plan d'évacuation", { bold: true, size: 26, color: COLOR_PRIMARY }));
        if (photoStore['evac_plan']) {
            const pb = makePhotoBlock("Plan d'évacuation", "evac_plan");
            if (pb) children.push(pb);
            children.push(P("Points de mesure positionnés sur le plan :"));
            evacPoints.forEach((p, idx) => {
                const pointNum = p.pointId;
                const group = document.querySelector(`.measure-point-group[data-point="${pointNum}"]`);
                const lieu = group ? group.querySelector('.point-lieu').value : `Point ${pointNum}`;
                const analysis = group ? group.querySelector('.analysis-result').textContent : "";
                children.push(P(`• Point ${pointNum} — ${lieu} : ${analysis}`));
            });
        } else {
            children.push(P("Aucun plan d'évacuation importé.", { italics: true }));
        }

        // SECTION 5 - Cheminement
        children.push(P("5. Cheminement câble / Installation", { bold: true, size: 26, color: COLOR_PRIMARY }));
        const cheminementItems = document.querySelectorAll('.cheminement-item');
        if (cheminementItems.length === 0) {
            children.push(P("Aucune photo de cheminement ajoutée.", { italics: true }));
        } else {
            cheminementItems.forEach((item, idx) => {
                const key = `cheminement_${idx + 1}`;
                const comment = item.querySelector('.cheminement-comment').value || "";
                if (photoStore[key]) {
                    const pb = makePhotoBlock(`Cheminement ${idx + 1}`, key);
                    if (pb) children.push(pb);
                }
                if (comment) {
                    children.push(P("Commentaire : " + comment, { italics: true }));
                }
            });
        }

        // SECTION 6 - Synthèse
        children.push(P("6. Synthèse de l'intervention", { bold: true, size: 26, color: COLOR_PRIMARY }));
        const tableSynth = new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [3120, 6240],
            rows: [
                new TableRow({ children: [cell("Heure de début", { width: 3120 }), cell(val("heure_debut") || "—", { width: 6240 })] }),
                new TableRow({ children: [cell("Heure de fin", { width: 3120 }), cell(val("heure_fin") || "—", { width: 6240 })] }),
                new TableRow({ children: [cell("Durée totale", { width: 3120 }), cell(val("duree_totale") || "—", { width: 6240 })] }),
                new TableRow({ children: [cell("Nombre de techniciens", { width: 3120 }), cell(val("nb_techniciens") || "—", { width: 6240 })] }),
                new TableRow({ children: [cell("Nacelle à prévoir", { width: 3120 }), cell(radioValue("nacelle_prevoir") || "—", { width: 6240 })] }),
                new TableRow({ children: [cell("Besoin d'une échelle", { width: 3120 }), cell(radioValue("echelle_prevoir") || "—", { width: 6240 })] })
            ]
        });
        children.push(tableSynth);

        // Observations
        children.push(P("Observations / Réserves / Points à lever", { bold: true, size: 22, color: COLOR_ACCENT }));
        children.push(P(val("observations") || "Aucune observation."));

        // Signature
        children.push(P("Signature technicien / auditeur", { bold: true, size: 22, color: COLOR_ACCENT }));
        children.push(P("Nom : " + (val("signataire_nom") || "_______________________________")));
        children.push(P("Date : " + (formatDateFR(val("signataire_date")) || "_______________________________")));

        const doc = new Document({
            sections: [{
                properties: {
                    page: {
                        margin: { top: 1440, right: 1080, bottom: 1080, left: 1080 }
                    }
                },
                children: children
            }]
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, buildFilename());
        showStatus("✅ Rapport généré avec succès !", "success");

    } catch (err) {
        console.error(err);
        showStatus("❌ Erreur : " + err.message, "error");
    }
}

function b64ToUint8Array(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

// Exposition globale
window.generateDocument = generateDocument;
window.resetForm = resetForm;
window.exportJSON = exportJSON;
window.importJSON = importJSON;
