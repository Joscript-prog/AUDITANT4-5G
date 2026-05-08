// ============================================================
//  AUDIT 4G/5G — VERSION FINALE
//  Basée sur Starlink v3 + adaptations complètes
//  IPKONEKT / Bouygues Telecom
// ============================================================

const photoStore = {};
let measureCounter = 0;
let evacPointCounter = 0;
let cheminementCounter = 1;
let evacPoints = [];

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

    // Photos principales
    document.querySelectorAll('input[type="file"][data-photo-key]').forEach(input => {
        input.addEventListener("change", handlePhotoUpload);
    });

    // Gestion globale des clics
    document.body.addEventListener("click", handleGlobalClick);

    // Points de mesure
    initMeasurePoints();
    document.getElementById("addMeasurePointBtn").addEventListener("click", () => addMeasurePoint());

    // Cheminement
    const btnChem = document.getElementById("addCheminementBtn");
    if (btnChem) btnChem.addEventListener("click", addCheminementItem);

    // Plan d'évacuation
    document.getElementById("evacFileInput").addEventListener("change", handleEvacUpload);
    document.getElementById("addEvacPointBtn").addEventListener("click", addEvacPoint);

    // Import JSON
    const importInput = document.getElementById("importJSONInput");
    if (importInput) importInput.addEventListener("change", importJSON);

    // Réinitialisation
    document.querySelector('button.btn-secondary[onclick="resetForm()"]')?.addEventListener('click', resetForm);
    // Export JSON
    document.querySelector('button.btn-secondary[onclick="exportJSON()"]')?.addEventListener('click', exportJSON);

    console.log("✅ Audit 4G/5G chargé et prêt");
});

// ============================================================
//  GESTION GLOBALE DES CLICS (Annoter / Effacer)
// ============================================================
function handleGlobalClick(e) {
    // Annoter (toutes photos)
    const annBtn = e.target.closest("[data-annotate]");
    if (annBtn) {
        const key = annBtn.dataset.annotate;
        if (!photoStore[key]) return alert("Importez d'abord une photo.");
        window.Editor.open(key, "Photo " + key);
        return;
    }
    // Effacer (photos classiques)
    const clearBtn = e.target.closest("[data-clear]");
    if (clearBtn) {
        const key = clearBtn.dataset.clear;
        delete photoStore[key];
        const preview = document.getElementById("preview_" + key);
        if (preview) preview.classList.remove("shown");
        const fileInput = document.querySelector(`input[data-photo-key="${key}"]`);
        if (fileInput) fileInput.value = "";
        const annButton = document.querySelector(`[data-annotate="${key}"]`);
        if (annButton) annButton.disabled = true;
        return;
    }
    // Effacer (photos mesure)
    const clearMeasure = e.target.closest("[data-clear-measure]");
    if (clearMeasure) {
        const idx = clearMeasure.dataset.clearMeasure;
        const keys = [`mesure_lieu_${idx}`, `mesure_screen_${idx}`];
        keys.forEach(k => {
            delete photoStore[k];
            const preview = document.getElementById(`preview_${k}`);
            if (preview) {
                preview.src = "";
                preview.classList.remove("shown");
            }
        });
        document.querySelectorAll(`[data-measure-index="${idx}"]`).forEach(inp => inp.value = "");
        return;
    }
}

// ============================================================
//  PROCESSUS PHOTO (Centralisé)
// ============================================================
async function handlePhotoUpload(e) {
    const key = e.target.dataset.photoKey;
    if (!e.target.files[0]) return;
    await processPhoto(e.target.files[0], key);
    // Activer le bouton annoter correspondant
    const annBtn = document.querySelector(`[data-annotate="${key}"]`);
    if (annBtn) annBtn.disabled = false;
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

// ============================================================
//  POINTS DE MESURE
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
        <input type="text" class="point-lieu" id="mesure_lieu_${count}" placeholder="Lieu / Pièce" style="width:100%;margin-bottom:8px;">

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin:12px 0;">
            <div>
                <label>📷 Photo du lieu</label><br>
                <input type="file" accept="image/*" data-measure-index="${count}" data-photo-type="lieu">
                <img id="preview_mesure_lieu_${count}" class="photo-preview">
                <button class="annotate-btn" data-annotate="mesure_lieu_${count}" disabled style="margin-top:5px;">✏ Annoter</button>
            </div>
            <div>
                <label>📱 Copie écran mesure</label><br>
                <input type="file" accept="image/*" data-measure-index="${count}" data-photo-type="screen">
                <img id="preview_mesure_screen_${count}" class="photo-preview">
                <button class="annotate-btn" data-annotate="mesure_screen_${count}" disabled style="margin-top:5px;">✏ Annoter</button>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px;">
            <input type="text" class="measure-rsrp" id="mesure_rsrp_${count}" placeholder="RSRP (dBm)">
            <input type="text" class="measure-rsrq" id="mesure_rsrq_${count}" placeholder="RSRQ (dB)">
            <input type="text" class="measure-sinr" id="mesure_sinr_${count}" placeholder="SINR (dB)">
            <input type="text" class="measure-down" id="mesure_desc_${count}" placeholder="↓ Desc (Mbps)">
            <input type="text" class="measure-up" id="mesure_mont_${count}" placeholder="↑ Mont (Mbps)">
            <input type="text" class="measure-band" id="mesure_bande_${count}" placeholder="Bande">
        </div>
        <div style="margin-top:8px;"><strong>Analyse :</strong> <span class="analysis-result">En attente</span></div>
    `;
    container.appendChild(div);

    // Gestion événements
    div.querySelectorAll('input[type="file"]').forEach(inp => inp.addEventListener("change", handleMeasurePhoto));
    div.querySelectorAll('.measure-rsrp, .measure-rsrq, .measure-sinr').forEach(el => {
        el.addEventListener('input', () => analyzePoint(div));
    });
}


async function handleMeasurePhoto(e) {
    const index = e.target.dataset.measureIndex;
    const type = e.target.dataset.photoType;
    const key = `mesure_${type}_${index}`;
    await processPhoto(e.target.files[0], key);
    // Activer le bouton annoter
    // Le bouton annoter pour les mesures est géré différemment car ce sont des blocs dynamiques
    // On peut activer le bouton globlal via window.Editor et la clé
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

    let label;
    if (score >= 80) label = "Très bonne qualité";
    else if (score >= 60) label = "Bonne qualité";
    else if (score >= 40) label = "Qualité moyenne";
    else if (score >= 20) label = "Qualité faible";
    else label = "Signal inutilisable";

    resultSpan.textContent = `${label} (score ${score}/100)`;
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
    if (text.includes('Très bonne qualité')) color = 'rgba(40,167,69,0.6)';
    else if (text.includes('Bonne qualité')) color = 'rgba(0,123,255,0.6)';
    else if (text.includes('Qualité moyenne')) color = 'rgba(253,126,20,0.6)';
    else if (text.includes('Qualité faible')) color = 'rgba(220,53,69,0.6)';
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

    // Gestion événements
    const fileInput = div.querySelector('input[type="file"]');
    fileInput.addEventListener('change', async function() {
        const idx2 = this.dataset.cheminementIndex;
        const key = `cheminement_${idx2}`;
        await processPhoto(this.files[0], key);
        const annBtn = div.querySelector(`[data-annotate-cheminement="${idx2}"]`);
        if (annBtn) annBtn.disabled = false;
    });

    // Annotation
    const annBtn = div.querySelector(`[data-annotate-cheminement="${idx}"]`);
    annBtn.addEventListener('click', function() {
        const idx2 = this.dataset.annotateCheminement;
        const key = `cheminement_${idx2}`;
        if (!photoStore[key]) return alert("Importez d'abord une photo.");
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
            lieu: group.querySelector('.point-lieu').value || '',
            rsrp: group.querySelector('.measure-rsrp').value || '',
            rsrq: group.querySelector('.measure-rsrq').value || '',
            sinr: group.querySelector('.measure-sinr').value || '',
            down: group.querySelector('.measure-down').value || '',
            up: group.querySelector('.measure-up').value || '',
            band: group.querySelector('.measure-band').value || '',
            analysis: group.querySelector('.analysis-result').textContent || '',
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

// ============================================================
//  GÉNÉRATION WORD — COMPLÈTE
// ============================================================
async function generateDocument() {
    showStatus("Génération du document en cours...", "loading");
    try {
        const docxLib = window.docx || docx;
        const {
            Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
            ImageRun, Header, AlignmentType, WidthType, BorderStyle, ShadingType
        } = docxLib;

        const COLOR_PRIMARY = "1F3864";
        const COLOR_ACCENT = "2E75B6";
        const COLOR_BORDER = "BFBFBF";
        const FONT = "Calibri";

        function P(text, opts = {}) {
            return new Paragraph({
                children: [
                    new TextRun({
                        text: text || "",
                        bold: opts.bold || false,
                        size: opts.size || 22,
                        color: opts.color || "000000",
                        font: FONT
                    })
                ]
            });
        }

        function cell(content, width) {
            return new TableCell({
                borders: { top: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER }, bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER }, left: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER }, right: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER } },
                width: { size: width || 4680, type: WidthType.DXA },
                children: [typeof content === "string" ? P(content, { size: 20 }) : content]
            });
        }

        function makeRepeatingHeader() {
            return new Header({
                children: [new Table({
                    width: { size: 9360, type: WidthType.DXA },
                    rows: [new TableRow({
                        children: [
                            new TableCell({
                                children: [
                                    new Paragraph({
                                        children: [
                                            new ImageRun({
                                                data: b64ToUint8Array(LOGO_IPKONEKT_B64),
                                                transformation: { width: 110, height: 55 }
                                            })
                                        ]
                                    })
                                ]
                            }),
                            new TableCell({
                                children: [
                                    new Paragraph({
                                        alignment: AlignmentType.CENTER,
                                        children: [
                                            new TextRun({
                                                text: "RAPPORT D'AUDIT - INSTALLATION ANTENNE 4G/5G",
                                                bold: true,
                                                size: 28,
                                                color: COLOR_PRIMARY,
                                                font: FONT
                                            })
                                        ]
                                    })
                                ]
                            }),
                            new TableCell({
                                children: [
                                    new Paragraph({
                                        alignment: AlignmentType.RIGHT,
                                        children: [
                                            new ImageRun({
                                                data: b64ToUint8Array(LOGO_BOUYGUES_B64),
                                                transformation: { width: 130, height: 55 }
                                            })
                                        ]
                                    })
                                ]
                            })
                        ]
                    })]
                })]
            });
        }

         // Construction du document
        const children = [];
        children.push(P("RAPPORT D'AUDIT - INSTALLATION ANTENNE 4G/5G", { bold: true, size: 32, color: COLOR_PRIMARY }));
        children.push(P(`Date : ${formatDateFR(val("date_audit"))}`));
        children.push(P(""));

        // Informations client
        children.push(P("1. INFORMATIONS ADMINISTRATIVES", { bold: true, size: 26, color: COLOR_PRIMARY }));
        const infosTable = new Table({
            width: { size: 9360, type: WidthType.DXA },
            rows: [
                new TableRow({ children: [cell("Raison sociale", 3120), cell(val("raison_sociale") || "—", 6240)] }),
                new TableRow({ children: [cell("Adresse", 3120), cell(val("adresse") || "—", 6240)] }),
                new TableRow({ children: [cell("Code postal / Ville", 3120), cell(`${val("code_postal") || ""} ${val("ville") || ""}`, 6240)] }),
                new TableRow({ children: [cell("Horaire d'ouverture", 3120), cell(val("horaire") || "—", 6240)] }),
                new TableRow({ children: [cell("Procédure d'accès", 3120), cell(val("procedure_acces") || "—", 6240)] }),
                new TableRow({ children: [cell("Téléphone site", 3120), cell(val("tel_site") || "—", 6240)] }),
                new TableRow({ children: [cell("Contact", 3120), cell(`${val("contact_nom") || ""} - ${val("contact_fonction") || ""}\n${val("contact_tel") || ""} / ${val("contact_mail") || ""}`, 6240)] })
            ]
        });
        children.push(infosTable);
        children.push(P(""));

        // Informations techniques
        children.push(P("2. INFORMATIONS TECHNIQUES CLIENT", { bold: true, size: 26, color: COLOR_PRIMARY }));
        const techTable = new Table({
            width: { size: 9360, type: WidthType.DXA },
            rows: [
                new TableRow({ children: [cell("Bâtiment classé", 3120), cell(radioValue("classe") || "—", 6240)] }),
                new TableRow({ children: [cell("Localisation baie", 3120), cell(val("localisation_baie") || "—", 6240)] }),
                new TableRow({ children: [cell("Nbr prises électriques", 3120), cell(val("nb_prises") || "—", 6240)] }),
                new TableRow({ children: [cell("Prise RJ45 disponible", 3120), cell(radioValue("rj45") || "—", 6240)] }),
                new TableRow({ children: [cell("Devis desserte nécessaire", 3120), cell(radioValue("devis_desserte") || "—", 6240)] })
            ]
        });
        children.push(techTable);
        children.push(P(""));

        // Mesures
        children.push(P("3. MESURES RADIO 4G/5G", { bold: true, size: 26, color: COLOR_PRIMARY }));
        document.querySelectorAll('.measure-point-group').forEach((group, idx) => {
            const num = idx + 1;
            const lieu = group.querySelector('.point-lieu').value || `Point ${num}`;
            const rsrp = group.querySelector('.measure-rsrp').value || "—";
            const rsrq = group.querySelector('.measure-rsrq').value || "—";
            const sinr = group.querySelector('.measure-sinr').value || "—";
            const down = group.querySelector('.measure-down').value || "—";
            const up = group.querySelector('.measure-up').value || "—";
            const band = group.querySelector('.measure-band').value || "—";
            const analysis = group.querySelector('.analysis-result').textContent || "En attente";

            children.push(P(`Point ${num} — ${lieu}`, { bold: true, size: 22, color: COLOR_ACCENT }));
            const mesureTable = new Table({
                width: { size: 9360, type: WidthType.DXA },
                rows: [
                    new TableRow({ tableHeader: true, children: [cell("Paramètre", 4680), cell("Valeur", 4680)] }),
                    new TableRow({ children: [cell("RSRP (dBm)", 4680), cell(rsrp, 4680)] }),
                    new TableRow({ children: [cell("RSRQ (dB)", 4680), cell(rsrq, 4680)] }),
                    new TableRow({ children: [cell("SINR (dB)", 4680), cell(sinr, 4680)] }),
                    new TableRow({ children: [cell("Débit descendant (Mbps)", 4680), cell(down, 4680)] }),
                    new TableRow({ children: [cell("Débit montant (Mbps)", 4680), cell(up, 4680)] }),
                    new TableRow({ children: [cell("Bande", 4680), cell(band, 4680)] })
                ]
            });
            children.push(mesureTable);
            children.push(P("Analyse : " + analysis));

            // Photos
            const keyLieu = `mesure_lieu_${num}`;
            if (photoStore[keyLieu]) {
                children.push(P("Photo du lieu :", { bold: true }));
                children.push(new Paragraph({
                    children: [
                        new ImageRun({
                            data: photoStore[keyLieu].data,
                            transformation: { width: 400, height: 300 },
                            type: photoStore[keyLieu].type
                        })
                    ]
                }));
            }
            const keyScreen = `mesure_screen_${num}`;
            if (photoStore[keyScreen]) {
                children.push(P("Copie écran :", { bold: true }));
                children.push(new Paragraph({
                    children: [
                        new ImageRun({
                            data: photoStore[keyScreen].data,
                            transformation: { width: 400, height: 300 },
                            type: photoStore[keyScreen].type
                        })
                    ]
                }));
            }
            children.push(P(""));
        });

        // Plan d'évacuation
        children.push(P("4. PLAN D'ÉVACUATION", { bold: true, size: 26, color: COLOR_PRIMARY }));
        if (photoStore['evac_plan']) {
            children.push(P("Plan importé :", { bold: true }));
            children.push(new Paragraph({
                children: [
                    new ImageRun({
                        data: photoStore['evac_plan'].data,
                        transformation: { width: 500, height: 350 },
                        type: photoStore['evac_plan'].type
                    })
                ]
            }));
        }
        if (evacPoints.length > 0) {
            children.push(P("Points positionnés :"));
            evacPoints.forEach(p => {
                const group = document.querySelector(`.measure-point-group[data-point="${p.pointId}"]`);
                const lieu = group ? group.querySelector('.point-lieu').value : `Point ${p.pointId}`;
                const analysis = group ? group.querySelector('.analysis-result').textContent : "";
                children.push(P(`• Point ${p.pointId} — ${lieu} : ${analysis}`));
            });
        } else {
            children.push(P("Aucun point positionné.", { italics: true }));
        }
        children.push(P(""));

        // Cheminement
        children.push(P("5. CHEMINEMENT CÂBLE / INSTALLATION", { bold: true, size: 26, color: COLOR_PRIMARY }));
        const cheminementItems = document.querySelectorAll('.cheminement-item');
        if (cheminementItems.length === 0) {
            children.push(P("Aucune photo de cheminement ajoutée.", { italics: true }));
        } else {
            cheminementItems.forEach((item, idx) => {
                const key = `cheminement_${idx + 1}`;
                const comment = item.querySelector('.cheminement-comment').value || "";
                if (photoStore[key]) {
                    children.push(P(`Photo ${idx + 1}`, { bold: true }));
                    children.push(new Paragraph({
                        children: [
                            new ImageRun({
                                data: photoStore[key].data,
                                transformation: { width: 450, height: 280 },
                                type: photoStore[key].type
                            })
                        ]
                    }));
                }
                if (comment) {
                    children.push(P("Commentaire : " + comment, { italics: true }));
                }
                children.push(P(""));
            });
        }

        // Synthèse
        children.push(P("6. SYNTHÈSE DE L'INTERVENTION", { bold: true, size: 26, color: COLOR_PRIMARY }));
        const synthTable = new Table({
            width: { size: 9360, type: WidthType.DXA },
            rows: [
                new TableRow({ children: [cell("Heure début", 3120), cell(val("heure_debut") || "—", 6240)] }),
                new TableRow({ children: [cell("Heure fin", 3120), cell(val("heure_fin") || "—", 6240)] }),
                new TableRow({ children: [cell("Durée", 3120), cell(val("duree_totale") || "—", 6240)] }),
                new TableRow({ children: [cell("Techniciens", 3120), cell(val("nb_techniciens") || "—", 6240)] }),
                new TableRow({ children: [cell("Nacelle à prévoir", 3120), cell(radioValue("nacelle_prevoir") || "—", 6240)] }),
                new TableRow({ children: [cell("Échelle nécessaire", 3120), cell(radioValue("echelle_prevoir") || "—", 6240)] })
            ]
        });
        children.push(synthTable);
        children.push(P(""));

        // Observations
        children.push(P("Observations / Réserves / Points à lever", { bold: true, size: 22, color: COLOR_ACCENT }));
        children.push(P(val("observations") || "Aucune observation."));

        // Signature
        children.push(P("Signature technicien / auditeur", { bold: true, size: 22, color: COLOR_ACCENT }));
        children.push(P(`Nom : ${val("signataire_nom") || "_______________________________"}`));
        children.push(P(`Date : ${formatDateFR(val("signataire_date")) || "_______________________________"}`));

        // Assemblage final
        const doc = new Document({
            sections: [{
                properties: {
                    page: {
                        margin: { top: 1440, right: 1080, bottom: 1080, left: 1080 }
                    }
                },
                headers: { default: makeRepeatingHeader() },
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


// Exposition des fonctions de l'éditeur pour le HTML
function closeEditor() {
    if (window.Editor && typeof window.Editor.close === 'function') {
        window.Editor.close();
    }
}

function saveAnnotation() {
    if (window.Editor && typeof window.Editor.save === 'function') {
        window.Editor.save();
    }
}



// Exposition des fonctions globales
window.generateDocument = generateDocument;
window.resetForm = resetForm;
window.exportJSON = exportJSON;
window.importJSON = importJSON;
