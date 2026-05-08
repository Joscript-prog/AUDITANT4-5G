// ============================================================
//  AUDIT 4G/5G — VERSION COMPLÈTE (Style Starlink)
//  Génération Word identique au template Starlink validé
// ============================================================

const photoStore = {};
let measureCounter = 0;
let evacPointCounter = 0;
let cheminementCounter = 0;
let evacPoints = [];

// ---------- Couleurs / constantes du style Starlink ----------
const COLOR_TITLE       = "1F3864"; // bleu marine titres
const COLOR_SUBTITLE    = "2E75B6"; // bleu sous-titres 2.1 -
const COLOR_TABLE_LABEL = "F2F2F2"; // gris clair (libellés)
const COLOR_PHOTO_BG    = "DEEBF7"; // bleu pâle (bandeau photo)
const COLOR_PHOTO_BORDER= "BDD7EE";
const COLOR_BORDER      = "BFBFBF";
const COLOR_FOOTER      = "808080";
const COLOR_WHITE       = "FFFFFF";

// ---------- ATTENTE DES LIBRAIRIES ----------
function waitForLibs() {
    return new Promise((resolve) => {
        const check = () => {
            if (typeof window.docx !== 'undefined' && typeof window.saveAs !== 'undefined') {
                resolve();
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });
}

// ---------- INIT ----------
document.addEventListener("DOMContentLoaded", async () => {
    await waitForLibs();

    const today = new Date().toISOString().slice(0, 10);
    const dateAudit = document.getElementById("date_audit");
    const sigDate = document.getElementById("signataire_date");
    if (dateAudit && !dateAudit.value) dateAudit.value = today;
    if (sigDate && !sigDate.value) sigDate.value = today;

    document.body.addEventListener("click", handleGlobalClick);

    initMeasurePoints();

    const addMPBtn = document.getElementById("addMeasurePointBtn");
    if (addMPBtn) addMPBtn.addEventListener("click", () => addMeasurePoint());

    const btnChem = document.getElementById("addCheminementBtn");
    if (btnChem) btnChem.addEventListener("click", () => addCheminementItem());

    const evacInput = document.getElementById("evacFileInput");
    if (evacInput) evacInput.addEventListener("change", handleEvacUpload);

    const addEvacBtn = document.getElementById("addEvacPointBtn");
    if (addEvacBtn) addEvacBtn.addEventListener("click", addEvacPoint);

    // Au moins un cheminement par défaut
    if (document.getElementById("cheminementContainer") &&
        document.getElementById("cheminementContainer").children.length === 0) {
        addCheminementItem();
    }

    console.log("✅ Audit 4G/5G chargé avec succès");
});

// ---------- CLIC GLOBAL (Annoter / Effacer / Supprimer) ----------
function handleGlobalClick(e) {
    const annBtn = e.target.closest("[data-annotate]");
    if (annBtn) {
        const key = annBtn.dataset.annotate;
        if (!photoStore[key]) {
            alert("Importez d'abord une photo.");
            return;
        }
        if (typeof window.Editor !== 'undefined' && window.Editor.open) {
            window.Editor.open(key, "Photo " + key);
        } else {
            alert("L'éditeur d'annotation n'est pas chargé.");
        }
        return;
    }

    const clearBtn = e.target.closest("[data-clear]");
    if (clearBtn) {
        const key = clearBtn.dataset.clear;
        delete photoStore[key];
        const preview = document.getElementById("preview_" + key);
        if (preview) {
            preview.src = "";
            preview.classList.remove("shown");
        }
        const ann = document.querySelector(`[data-annotate="${key}"]`);
        if (ann) ann.disabled = true;
        return;
    }

    const delMP = e.target.closest("[data-del-measure]");
    if (delMP) {
        const group = delMP.closest('.measure-point-group');
        if (group && confirm("Supprimer ce point de mesure ?")) {
            const num = group.dataset.point;
            delete photoStore[`mesure_lieu_${num}`];
            delete photoStore[`mesure_screen_${num}`];
            group.remove();
        }
        return;
    }

    const delChem = e.target.closest("[data-del-chem]");
    if (delChem) {
        const item = delChem.closest('.cheminement-item');
        if (item && confirm("Supprimer ce cheminement ?")) {
            const idx = item.dataset.idx;
            delete photoStore[`cheminement_${idx}`];
            item.remove();
        }
        return;
    }
}

// ---------- TRAITEMENT PHOTO (centralisé) ----------
async function processPhoto(file, key) {
    if (!file) return;
    try {
        const buf = await file.arrayBuffer();
        const u8 = new Uint8Array(buf);
        const type = file.type.toLowerCase().includes("png") ? "png" : "jpg";
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = ev => resolve(ev.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        photoStore[key] = { data: u8, type: type, dataUrl: dataUrl };
        const preview = document.getElementById("preview_" + key);
        if (preview) {
            preview.src = dataUrl;
            preview.classList.add("shown");
        }
    } catch (err) {
        console.error("Erreur photo :", err);
        alert("Impossible de lire cette image.");
    }
}

// ============================================================
//  MATRICE D'INTERPRÉTATION OFFICIELLE (RSRP × SNR)
//  Selon grille fournie par le client.
// ============================================================
const QUALITY_MATRIX = {
    excellent: { // RSRP >= -85 dBm
        ">15":  { label: "Optimal",      color: "#16a34a" },
        "5-15": { label: "Très bon",     color: "#16a34a" },
        "0-5":  { label: "Correct",      color: "#f59e0b" },
        "<0":   { label: "Dégradé",      color: "#6b7280" }
    },
    bon: {       // -85 à -100 dBm
        ">15":  { label: "Très bon",     color: "#16a34a" },
        "5-15": { label: "Bon",          color: "#16a34a" },
        "0-5":  { label: "Acceptable",   color: "#f59e0b" },
        "<0":   { label: "Problématique",color: "#6b7280" }
    },
    faible: {    // -100 à -115 dBm
        ">15":  { label: "Bon",          color: "#16a34a" },
        "5-15": { label: "Acceptable",   color: "#f59e0b" },
        "0-5":  { label: "Limite",       color: "#6b7280" },
        "<0":   { label: "Très dégradé", color: "#dc2626" }
    },
    critique: {  // < -115 dBm
        ">15":  { label: "Utilisable",   color: "#6b7280" },
        "5-15": { label: "Limite",       color: "#6b7280" },
        "0-5":  { label: "Critique",     color: "#dc2626" },
        "<0":   { label: "Inutilisable", color: "#dc2626" }
    }
};

function classifyRSRP(rsrp) {
    if (isNaN(rsrp)) return null;
    if (rsrp >= -85)  return "excellent";
    if (rsrp >= -100) return "bon";
    if (rsrp >= -115) return "faible";
    return "critique";
}

function classifySNR(snr) {
    if (isNaN(snr)) return null;
    if (snr > 15) return ">15";
    if (snr >= 5) return "5-15";
    if (snr >= 0) return "0-5";
    return "<0";
}

function evaluateQuality(rsrp, snr) {
    const r = classifyRSRP(rsrp);
    const s = classifySNR(snr);
    if (!r || !s) return null;
    return QUALITY_MATRIX[r][s];
}

// ---------- ANALYSE AUTOMATIQUE D'UN POINT ----------
function analyzePoint(group) {
    const rsrp = parseFloat(group.querySelector('.measure-rsrp').value);
    const snr  = parseFloat(group.querySelector('.measure-sinr').value); // SINR = SNR ici
    const resultSpan = group.querySelector('.analysis-result');
    if (!resultSpan) return;

    const q = evaluateQuality(rsrp, snr);
    if (!q) {
        resultSpan.textContent = "En attente de données (RSRP + SNR requis)";
        resultSpan.style.background = "#e5e7eb";
        resultSpan.style.color = "#374151";
        group.dataset.analysisLabel = "";
        return;
    }
    resultSpan.textContent = q.label;
    resultSpan.style.background = q.color;
    resultSpan.style.color = "#ffffff";
    group.dataset.analysisLabel = q.label;
    group.dataset.analysisColor = q.color;
}

// ---------- POINTS DE MESURE DYNAMIQUES ----------
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
    if (!container) return;

    const div = document.createElement("div");
    div.className = "measure-point-group";
    div.dataset.point = count;
    div.innerHTML = `
        <div class="mp-header">
            <h4>📍 Point de mesure ${count}</h4>
            <button class="btn-delete" data-del-measure title="Supprimer ce point">🗑</button>
        </div>
        <input type="text" class="point-lieu mp-field" placeholder="Lieu / Pièce (ex: Bureau Direction, Local Technique RDC...)">

        <div class="mp-photos">
            <div class="mp-photo-block">
                <label class="mp-photo-label">📷 Photo du lieu</label>
                <input type="file" accept="image/*" data-measure-index="${count}" data-photo-type="lieu">
                <img id="preview_mesure_lieu_${count}" class="photo-preview">
                <div class="mp-photo-actions">
                    <button class="annotate-btn" data-annotate="mesure_lieu_${count}" disabled>✏ Annoter</button>
                    <button class="clear-btn" data-clear="mesure_lieu_${count}">🗑 Effacer</button>
                </div>
            </div>
            <div class="mp-photo-block">
                <label class="mp-photo-label">📱 Copie écran mesure</label>
                <input type="file" accept="image/*" data-measure-index="${count}" data-photo-type="screen">
                <img id="preview_mesure_screen_${count}" class="photo-preview">
                <div class="mp-photo-actions">
                    <button class="annotate-btn" data-annotate="mesure_screen_${count}" disabled>✏ Annoter</button>
                    <button class="clear-btn" data-clear="mesure_screen_${count}">🗑 Effacer</button>
                </div>
            </div>
        </div>

        <div class="mp-measures">
            <div class="mp-measure-cell">
                <label>RSRP <span class="unit">(dBm)</span></label>
                <input type="number" step="0.1" class="measure-rsrp" placeholder="ex: -82">
            </div>
            <div class="mp-measure-cell">
                <label>RSRQ <span class="unit">(dB)</span></label>
                <input type="number" step="0.1" class="measure-rsrq" placeholder="ex: -10">
            </div>
            <div class="mp-measure-cell">
                <label>SNR / SINR <span class="unit">(dB)</span></label>
                <input type="number" step="0.1" class="measure-sinr" placeholder="ex: 18">
            </div>
            <div class="mp-measure-cell">
                <label>↓ Débit desc. <span class="unit">(Mbps)</span></label>
                <input type="number" step="0.1" class="measure-down" placeholder="ex: 120">
            </div>
            <div class="mp-measure-cell">
                <label>↑ Débit mont. <span class="unit">(Mbps)</span></label>
                <input type="number" step="0.1" class="measure-up" placeholder="ex: 35">
            </div>
            <div class="mp-measure-cell">
                <label>Bande / Techno</label>
                <input type="text" class="measure-band" placeholder="ex: B7 4G+ / n78 5G">
            </div>
        </div>

        <div class="mp-analysis">
            <strong>🎯 Qualité globale :</strong>
            <span class="analysis-result">En attente de données (RSRP + SNR requis)</span>
        </div>
    `;
    container.appendChild(div);

    div.querySelectorAll('input[type="file"]').forEach(inp => {
        inp.addEventListener("change", async (e) => {
            const index = e.target.dataset.measureIndex;
            const type = e.target.dataset.photoType;
            const key = `mesure_${type}_${index}`;
            await processPhoto(e.target.files[0], key);
            const annBtn = div.querySelector(`[data-annotate="${key}"]`);
            if (annBtn) annBtn.disabled = false;
        });
    });

    div.querySelectorAll('input.measure-rsrp, input.measure-sinr').forEach(inp => {
        inp.addEventListener('input', () => analyzePoint(div));
    });
}

// ---------- PLAN D'ÉVACUATION ----------
function handleEvacUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
        const dataUrl = ev.target.result;
        const buf = await file.arrayBuffer();
        photoStore['evac_plan'] = {
            data: new Uint8Array(buf),
            type: file.type.includes("png") ? "png" : "jpg",
            dataUrl: dataUrl
        };
        const stage = document.getElementById('evacStageContainer');
        const upArea = document.getElementById('evacUploadArea');
        const bgImg = document.getElementById('evacBgImage');
        if (stage) stage.style.display = 'block';
        if (bgImg) bgImg.src = dataUrl;
        if (upArea) upArea.style.display = 'none';
    };
    reader.readAsDataURL(file);
}

function addEvacPoint() {
    const wrap = document.getElementById('evacStageWrap');
    const bgImg = document.getElementById('evacBgImage');
    if (!wrap || !bgImg || !bgImg.src) {
        alert("Importez d'abord un plan d'évacuation.");
        return;
    }
    evacPointCounter++;
    const pid = evacPointCounter;
    const dot = document.createElement('div');
    dot.className = 'evac-point';
    dot.dataset.pid = pid;
    dot.style.left = '50%';
    dot.style.top = '50%';
    dot.innerHTML = `
        <div class="evac-pin">P${pid}</div>
    `;
    // Drag & drop
    makeDraggable(dot, wrap);
    wrap.appendChild(dot);
    evacPoints.push({ pointId: pid });
}

function makeDraggable(el, container) {
    let isDown = false, startX = 0, startY = 0, origLeft = 0, origTop = 0;
    el.addEventListener('mousedown', (e) => {
        if (e.target.classList && e.target.classList.contains('evac-pin-del')) return;
        isDown = true;
        startX = e.clientX; startY = e.clientY;
        const rect = container.getBoundingClientRect();
        origLeft = el.offsetLeft;
        origTop = el.offsetTop;
        e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        el.style.left = (origLeft + dx) + 'px';
        el.style.top = (origTop + dy) + 'px';
    });
    document.addEventListener('mouseup', () => { isDown = false; });
}

// ---------- CHEMINEMENT ----------
function addCheminementItem() {
    const container = document.getElementById('cheminementContainer');
    if (!container) return;
    cheminementCounter++;
    const idx = cheminementCounter;
    const div = document.createElement('div');
    div.className = 'cheminement-item';
    div.dataset.idx = idx;
    div.innerHTML = `
        <div class="chem-header">
            <strong>📷 Photo Cheminement ${idx}</strong>
            <button class="btn-delete" data-del-chem title="Supprimer">🗑</button>
        </div>
        <input type="file" accept="image/*">
        <img class="photo-preview" id="preview_cheminement_${idx}">
        <div class="chem-actions">
            <button class="annotate-btn" data-annotate="cheminement_${idx}" disabled>✏ Annoter</button>
            <button class="clear-btn" data-clear="cheminement_${idx}">🗑 Effacer</button>
        </div>
        <textarea class="cheminement-comment" placeholder="Description du cheminement (point de pénétration, longueur estimée, type de support, étanchéité...)"></textarea>
    `;
    container.appendChild(div);
    div.querySelector('input[type="file"]').addEventListener('change', async (e) => {
        await processPhoto(e.target.files[0], `cheminement_${idx}`);
        const annBtn = div.querySelector('.annotate-btn');
        if (annBtn) annBtn.disabled = false;
    });
}

// ============================================================
//  GÉNÉRATION WORD — STYLE STARLINK
// ============================================================
async function generateDocument() {
    const {
        Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        ImageRun, Header, Footer, AlignmentType, WidthType, BorderStyle,
        VerticalAlign, ShadingType, HeightRule
    } = window.docx;

    const b64 = (s) => {
        const bin = atob(s);
        const res = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) res[i] = bin.charCodeAt(i);
        return res;
    };

    const val = (id) => {
        const el = document.getElementById(id);
        return el && el.value ? el.value : "";
    };

    // ---------- helpers de style ----------

    // Bordure grise standard
    const stdBorder = { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER };
    const stdBorders = {
        top: stdBorder, bottom: stdBorder, left: stdBorder, right: stdBorder,
        insideHorizontal: stdBorder, insideVertical: stdBorder
    };
    const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
    const noBorders = {
        top: noBorder, bottom: noBorder, left: noBorder, right: noBorder,
        insideHorizontal: noBorder, insideVertical: noBorder
    };

    // Paragraphe simple
    const P = (txt, opts = {}) => new Paragraph({
        alignment: opts.align || AlignmentType.LEFT,
        spacing: opts.spacing || { before: 60, after: 60 },
        children: [new TextRun({
            text: txt || "",
            bold: opts.bold || false,
            italics: opts.italics || false,
            size: opts.size || 20,
            color: opts.color || "000000",
            font: "Calibri"
        })]
    });

    // Titre de section "1. Titre" avec ligne dessous
    const sectionTitle = (num, txt) => new Paragraph({
        spacing: { before: 360, after: 120 },
        border: {
            bottom: { style: BorderStyle.SINGLE, size: 12, color: COLOR_TITLE, space: 4 }
        },
        children: [
            new TextRun({ text: `${num}.   `, bold: true, size: 28, color: COLOR_TITLE, font: "Calibri" }),
            new TextRun({ text: txt, bold: true, size: 28, color: COLOR_TITLE, font: "Calibri" })
        ]
    });

    // Sous-titre "2.1 - Texte"
    const subTitle = (num, txt) => new Paragraph({
        spacing: { before: 240, after: 80 },
        children: [
            new TextRun({ text: `${num} - ${txt}`, italics: true, bold: true, size: 22, color: COLOR_SUBTITLE, font: "Calibri" })
        ]
    });

    // Cellule "libellé" (gris clair, gras)
    const labelCell = (txt, width) => new TableCell({
        width: { size: width, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        shading: { fill: COLOR_TABLE_LABEL, type: ShadingType.CLEAR, color: "auto" },
        margins: { top: 100, bottom: 100, left: 140, right: 140 },
        borders: stdBorders,
        children: [new Paragraph({
            children: [new TextRun({ text: txt, bold: true, size: 20, font: "Calibri" })]
        })]
    });

    // Cellule "valeur" (fond blanc)
    const valueCell = (txt, width, opts = {}) => new TableCell({
        width: { size: width, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 100, bottom: 100, left: 140, right: 140 },
        borders: stdBorders,
        children: [new Paragraph({
            children: [new TextRun({
                text: txt || "",
                size: 20,
                font: "Calibri",
                color: opts.color || "000000",
                bold: opts.bold || false
            })]
        })]
    });

    // Cellule contenant un Paragraph déjà construit (pour ImageRun, etc.)
    const customCell = (children, width, opts = {}) => new TableCell({
        width: { size: width, type: WidthType.DXA },
        verticalAlign: opts.valign || VerticalAlign.CENTER,
        margins: opts.margins || { top: 100, bottom: 100, left: 140, right: 140 },
        borders: opts.borders || stdBorders,
        shading: opts.shading,
        columnSpan: opts.columnSpan,
        children: children
    });

    // Tableau simple à 2 colonnes (libellé / valeur) — style Starlink
    const kvTable = (rows) => new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3120, 6240],
        rows: rows.map(r => new TableRow({
            children: [labelCell(r[0], 3120), valueCell(r[1], 6240)]
        }))
    });

    // Bandeau photo (titre bleu pâle + image centrée)
    const photoBanner = (title, photoKey, opts = {}) => {
        const w = opts.width || 8400;
        const photo = photoStore[photoKey];
        const titleCell = new TableCell({
            width: { size: w, type: WidthType.DXA },
            shading: { fill: COLOR_PHOTO_BG, type: ShadingType.CLEAR, color: "auto" },
            margins: { top: 100, bottom: 100, left: 200, right: 200 },
            borders: {
                top: { style: BorderStyle.SINGLE, size: 6, color: COLOR_PHOTO_BORDER },
                bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR_PHOTO_BORDER },
                left: { style: BorderStyle.SINGLE, size: 6, color: COLOR_PHOTO_BORDER },
                right: { style: BorderStyle.SINGLE, size: 6, color: COLOR_PHOTO_BORDER }
            },
            children: [new Paragraph({
                children: [new TextRun({ text: `📷 ${title}`, bold: true, size: 22, color: COLOR_TITLE, font: "Calibri" })]
            })]
        });
        const photoCell = new TableCell({
            width: { size: w, type: WidthType.DXA },
            margins: { top: 200, bottom: 200, left: 200, right: 200 },
            verticalAlign: VerticalAlign.CENTER,
            borders: {
                top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR_PHOTO_BORDER },
                left: { style: BorderStyle.SINGLE, size: 6, color: COLOR_PHOTO_BORDER },
                right: { style: BorderStyle.SINGLE, size: 6, color: COLOR_PHOTO_BORDER }
            },
            children: photo ? [
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new ImageRun({
                        data: photo.data,
                        transformation: { width: opts.imgW || 380, height: opts.imgH || 280 },
                        type: photo.type
                    })]
                })
            ] : [
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 600, after: 600 },
                    children: [new TextRun({ text: "(Photo non fournie)", italics: true, size: 18, color: "999999", font: "Calibri" })]
                })
            ]
        });
        return new Table({
            width: { size: w, type: WidthType.DXA },
            columnWidths: [w],
            rows: [
                new TableRow({ children: [titleCell] }),
                new TableRow({ children: [photoCell] })
            ]
        });
    };

    // ---------- CONSTRUCTION DU DOCUMENT ----------
    const children = [];

    // === BANDEAU TITRE PRINCIPAL ===
    children.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [9360],
        rows: [new TableRow({
            children: [new TableCell({
                width: { size: 9360, type: WidthType.DXA },
                shading: { fill: COLOR_TITLE, type: ShadingType.CLEAR, color: "auto" },
                margins: { top: 240, bottom: 80, left: 200, right: 200 },
                borders: stdBorders,
                children: [
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({
                            text: "RAPPORT D'AUDIT - INSTALLATION ANTENNE 4G/5G",
                            bold: true, size: 32, color: COLOR_WHITE, font: "Calibri"
                        })]
                    }),
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 60, after: 240 },
                        children: [new TextRun({
                            text: "Bouygues Telecom │ IPKONEKT",
                            size: 22, color: COLOR_WHITE, font: "Calibri"
                        })]
                    })
                ]
            })]
        })]
    }));
    children.push(P("", { spacing: { before: 60, after: 60 } }));

    // === TABLEAU RÉFÉRENCE / AUDITEUR / DATE (3 colonnes) ===
    children.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3120, 3120, 3120],
        rows: [
            new TableRow({
                children: [
                    labelCell("Référence commande", 3120),
                    labelCell("Auditeur / Intervenant", 3120),
                    labelCell("Date d'audit", 3120)
                ]
            }),
            new TableRow({
                children: [
                    valueCell(val("ref_commande"), 3120),
                    valueCell(val("auditeur"), 3120),
                    valueCell(val("date_audit"), 3120)
                ]
            })
        ]
    }));

    // === SECTION 1 : INFOS ADMIN ===
    children.push(sectionTitle(1, "Informations administratives du client"));

    const cp = val("code_postal");
    const ville = val("ville");
    const tel = val("contact_tel");
    const mail = val("contact_mail");

    // Cellule "valeur" qui couvre 3 colonnes (utilisée pour fusionner avec la ligne CP/Ville)
    const wideValueCell = (txt) => new TableCell({
        width: { size: 6240, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        columnSpan: 3,
        margins: { top: 100, bottom: 100, left: 140, right: 140 },
        borders: stdBorders,
        children: [new Paragraph({
            children: [new TextRun({ text: txt || "", size: 20, font: "Calibri" })]
        })]
    });

    children.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3120, 1560, 1560, 3120],
        rows: [
            new TableRow({ children: [labelCell("Raison sociale du site audité", 3120), wideValueCell(val("raison_sociale"))] }),
            new TableRow({ children: [labelCell("Adresse", 3120), wideValueCell(val("adresse"))] }),
            new TableRow({ children: [
                labelCell("Code postal", 3120),
                valueCell("CP : " + cp, 1560),
                labelCell("Ville", 1560),
                valueCell(ville, 3120)
            ]}),
            new TableRow({ children: [labelCell("Horaire d'ouverture du site", 3120), wideValueCell(val("horaire"))] }),
            new TableRow({ children: [labelCell("Procédure d'accès", 3120), wideValueCell(val("procedure_acces"))] }),
            new TableRow({ children: [labelCell("Téléphone site", 3120), wideValueCell(val("tel_site"))] }),
            new TableRow({ children: [labelCell("Nom du contact client sur site", 3120), wideValueCell(val("contact_nom"))] }),
            new TableRow({ children: [labelCell("Fonction", 3120), wideValueCell(val("contact_fonction"))] }),
            new TableRow({ children: [
                labelCell("Téléphone / Mail contact", 3120),
                valueCell(tel, 1560),
                labelCell("Mail", 1560),
                valueCell(mail, 3120)
            ]})
        ]
    }));

    // === SECTION 2 : INFOS TECHNIQUES BAIE ===
    children.push(sectionTitle(2, "Informations techniques – Baie / Local technique"));
    children.push(kvTable([
        ["Localisation de la baie", val("localisation_baie")],
        ["Nombre de prises électriques disponibles", val("nb_prises")]
    ]));

    // === SECTION 3 : MESURES RADIO 4G/5G ===
    children.push(sectionTitle(3, "Mesures radio 4G/5G – Points relevés"));

    // Légende matrice
    children.push(P("Grille de lecture officielle appliquée automatiquement :", { italics: true, color: "555555", spacing: { before: 60, after: 100 } }));
    children.push(buildMatrixTable(window.docx));
    children.push(P("", { spacing: { before: 120, after: 60 } }));

    const measureGroups = document.querySelectorAll('.measure-point-group');
    measureGroups.forEach((group, idx) => {
        const num = idx + 1;
        const keyLieu = `mesure_lieu_${num}`;
        const keyScreen = `mesure_screen_${num}`;
        const lieuTxt = (group.querySelector('.point-lieu')?.value || "").trim() || `Point ${num}`;

        children.push(subTitle(`3.${num}`, `Point ${num} – ${lieuTxt}`));

        // Tableau valeurs (4 colonnes : RSRP / RSRQ / SNR / Bande, puis Down / Up)
        const rsrp = group.querySelector('.measure-rsrp')?.value || "—";
        const rsrq = group.querySelector('.measure-rsrq')?.value || "—";
        const sinr = group.querySelector('.measure-sinr')?.value || "—";
        const down = group.querySelector('.measure-down')?.value || "—";
        const up   = group.querySelector('.measure-up')?.value   || "—";
        const band = group.querySelector('.measure-band')?.value || "—";

        children.push(new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [1560, 1560, 1560, 1560, 1560, 1560],
            rows: [
                new TableRow({ children: [
                    labelCell("RSRP (dBm)", 1560),
                    labelCell("RSRQ (dB)", 1560),
                    labelCell("SNR (dB)", 1560),
                    labelCell("↓ Desc. (Mbps)", 1560),
                    labelCell("↑ Mont. (Mbps)", 1560),
                    labelCell("Bande / Techno", 1560)
                ]}),
                new TableRow({ children: [
                    valueCell(rsrp, 1560),
                    valueCell(rsrq, 1560),
                    valueCell(sinr, 1560),
                    valueCell(down, 1560),
                    valueCell(up, 1560),
                    valueCell(band, 1560)
                ]})
            ]
        }));

        // Analyse colorée
        const label = group.dataset.analysisLabel || "";
        const colorHex = (group.dataset.analysisColor || "#6b7280").replace("#","");
        if (label) {
            children.push(P("", { spacing: { before: 80, after: 0 } }));
            children.push(new Table({
                width: { size: 9360, type: WidthType.DXA },
                columnWidths: [3120, 6240],
                rows: [new TableRow({ children: [
                    labelCell("🎯 Qualité globale (matrice RSRP × SNR)", 3120),
                    new TableCell({
                        width: { size: 6240, type: WidthType.DXA },
                        verticalAlign: VerticalAlign.CENTER,
                        shading: { fill: colorHex.toUpperCase(), type: ShadingType.CLEAR, color: "auto" },
                        margins: { top: 100, bottom: 100, left: 140, right: 140 },
                        borders: stdBorders,
                        children: [new Paragraph({
                            children: [new TextRun({ text: label, bold: true, size: 22, color: "FFFFFF", font: "Calibri" })]
                        })]
                    })
                ]})]
            }));
        }

        // Photos côte à côte (bandeaux séparés)
        const hasL = !!photoStore[keyLieu];
        const hasS = !!photoStore[keyScreen];
        if (hasL || hasS) {
            children.push(P("", { spacing: { before: 120, after: 60 } }));
            children.push(new Table({
                width: { size: 9360, type: WidthType.DXA },
                columnWidths: [4680, 4680],
                borders: noBorders,
                rows: [new TableRow({
                    children: [
                        new TableCell({
                            width: { size: 4680, type: WidthType.DXA },
                            margins: { top: 0, bottom: 0, left: 60, right: 60 },
                            borders: noBorders,
                            children: [hasL ? photoBannerInner("Photo du lieu", keyLieu, 4560) : P("(Pas de photo lieu)", { italics: true, color: "999999" })]
                        }),
                        new TableCell({
                            width: { size: 4680, type: WidthType.DXA },
                            margins: { top: 0, bottom: 0, left: 60, right: 60 },
                            borders: noBorders,
                            children: [hasS ? photoBannerInner("Copie écran mesure", keyScreen, 4560) : P("(Pas de copie écran)", { italics: true, color: "999999" })]
                        })
                    ]
                })]
            }));
        }
    });

    // Helper : bandeau photo "intérieur" (utilisé pour côte à côte)
    function photoBannerInner(title, key, w) {
        const photo = photoStore[key];
        return new Table({
            width: { size: w, type: WidthType.DXA },
            columnWidths: [w],
            rows: [
                new TableRow({ children: [new TableCell({
                    width: { size: w, type: WidthType.DXA },
                    shading: { fill: COLOR_PHOTO_BG, type: ShadingType.CLEAR, color: "auto" },
                    margins: { top: 80, bottom: 80, left: 140, right: 140 },
                    borders: {
                        top: { style: BorderStyle.SINGLE, size: 6, color: COLOR_PHOTO_BORDER },
                        bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR_PHOTO_BORDER },
                        left: { style: BorderStyle.SINGLE, size: 6, color: COLOR_PHOTO_BORDER },
                        right: { style: BorderStyle.SINGLE, size: 6, color: COLOR_PHOTO_BORDER }
                    },
                    children: [new Paragraph({
                        children: [new TextRun({ text: `📷 ${title}`, bold: true, size: 20, color: COLOR_TITLE, font: "Calibri" })]
                    })]
                })]}),
                new TableRow({ children: [new TableCell({
                    width: { size: w, type: WidthType.DXA },
                    margins: { top: 120, bottom: 120, left: 120, right: 120 },
                    verticalAlign: VerticalAlign.CENTER,
                    borders: {
                        top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR_PHOTO_BORDER },
                        left: { style: BorderStyle.SINGLE, size: 6, color: COLOR_PHOTO_BORDER },
                        right: { style: BorderStyle.SINGLE, size: 6, color: COLOR_PHOTO_BORDER }
                    },
                    children: [new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new ImageRun({
                            data: photo.data,
                            transformation: { width: 250, height: 200 },
                            type: photo.type
                        })]
                    })]
                })]})
            ]
        });
    }

    // === SECTION 4 : PLAN D'ÉVACUATION ===
    children.push(sectionTitle(4, "Plan d'évacuation – Localisation des points de mesure"));
    if (photoStore['evac_plan']) {
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 120, after: 120 },
            children: [new ImageRun({
                data: photoStore['evac_plan'].data,
                transformation: { width: 500, height: 350 },
                type: photoStore['evac_plan'].type
            })]
        }));
        if (evacPoints.length > 0) {
            children.push(P(`Nombre de points positionnés sur le plan : ${evacPoints.length}`, { italics: true, color: "555555" }));
        }
    } else {
        children.push(P("(Aucun plan d'évacuation fourni)", { italics: true, color: "999999" }));
    }

    // === SECTION 5 : CHEMINEMENT ===
    children.push(sectionTitle(5, "Cheminement câble & installation"));
    const chemItems = document.querySelectorAll('.cheminement-item');
    if (chemItems.length === 0) {
        children.push(P("(Aucun cheminement renseigné)", { italics: true, color: "999999" }));
    }
    chemItems.forEach((item) => {
        const idx = item.dataset.idx;
        const key = `cheminement_${idx}`;
        const comm = item.querySelector('.cheminement-comment')?.value || "";
        if (photoStore[key]) {
            children.push(P("", { spacing: { before: 200, after: 60 } }));
            children.push(photoBanner(`Cheminement ${idx}`, key, { width: 9360, imgW: 380, imgH: 280 }));
        }
        if (comm) {
            children.push(P(`Commentaire : ${comm}`, { italics: true, spacing: { before: 80, after: 80 } }));
        }
    });

    // === SECTION 6 : SYNTHÈSE ===
    children.push(sectionTitle(6, "Synthèse de l'intervention"));
    children.push(kvTable([
        ["Heure de début d'intervention", val("heure_debut")],
        ["Heure de fin d'intervention", val("heure_fin")],
        ["Durée totale à prévoir", val("duree_totale")],
        ["Nombre de techniciens", val("nb_techniciens")]
    ]));

    children.push(P("", { spacing: { before: 200, after: 80 } }));
    children.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [9360],
        rows: [
            new TableRow({ children: [labelCell("Observations / Réserves / Points à lever", 9360)] }),
            new TableRow({ children: [valueCell(val("observations"), 9360)] })
        ]
    }));

    // === SIGNATURE ===
    children.push(P("", { spacing: { before: 240, after: 60 } }));
    children.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [9360],
        rows: [
            new TableRow({ children: [labelCell("Signature technicien / auditeur", 9360)] }),
            new TableRow({ children: [valueCell(
                `Nom : ${val("signataire_nom") || "_______________________________"}      Date : ${val("signataire_date")}`,
                9360
            )] })
        ]
    }));

    // ---------- DOCUMENT FINAL ----------
    const doc = new Document({
        styles: {
            default: { document: { run: { font: "Calibri", size: 20 } } }
        },
        sections: [{
            properties: {
                page: {
                    size: { width: 12240, height: 15840 },
                    margin: { top: 1440, right: 1440, bottom: 1080, left: 1440 }
                }
            },
            headers: {
                default: new Header({
                    children: [new Table({
                        width: { size: 9360, type: WidthType.DXA },
                        columnWidths: [3120, 3120, 3120],
                        borders: noBorders,
                        rows: [new TableRow({
                            children: [
                                new TableCell({
                                    width: { size: 3120, type: WidthType.DXA },
                                    verticalAlign: VerticalAlign.CENTER,
                                    borders: noBorders,
                                    children: [new Paragraph({
                                        children: [new ImageRun({
                                            data: b64(LOGO_IPKONEKT_B64),
                                            transformation: { width: 60, height: 54 }
                                        })]
                                    })]
                                }),
                                new TableCell({
                                    width: { size: 3120, type: WidthType.DXA },
                                    verticalAlign: VerticalAlign.CENTER,
                                    borders: noBorders,
                                    children: [new Paragraph({
                                        alignment: AlignmentType.CENTER,
                                        children: []
                                    })]
                                }),
                                new TableCell({
                                    width: { size: 3120, type: WidthType.DXA },
                                    verticalAlign: VerticalAlign.CENTER,
                                    borders: noBorders,
                                    children: [new Paragraph({
                                        alignment: AlignmentType.RIGHT,
                                        children: [new ImageRun({
                                            data: b64(LOGO_BOUYGUES_B64),
                                            transformation: { width: 60, height: 60 }
                                        })]
                                    })]
                                })
                            ]
                        })]
                    })]
                })
            },
            footers: {
                default: new Footer({
                    children: [new Paragraph({
                        alignment: AlignmentType.LEFT,
                        children: [new TextRun({
                            text: "Document confidentiel — Usage interne IPKONEKT / Bouygues Telecom",
                            italics: true, size: 16, color: COLOR_FOOTER, font: "Calibri"
                        })]
                    })]
                })
            },
            children: children
        }]
    });

    Packer.toBlob(doc).then(blob => {
        const safeName = (val("raison_sociale") || "Site").replace(/[^a-zA-Z0-9_-]/g, "_");
        saveAs(blob, `Audit_4G5G_${safeName}_${val("date_audit")}.docx`);
    });
}

// ---------- TABLEAU MATRICE D'INTERPRÉTATION (dans le Word) ----------
function buildMatrixTable(docxLib) {
    const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, BorderStyle, ShadingType, VerticalAlign } = docxLib;

    const stdBorder = { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER };
    const stdBorders = {
        top: stdBorder, bottom: stdBorder, left: stdBorder, right: stdBorder,
        insideHorizontal: stdBorder, insideVertical: stdBorder
    };

    // Cell helper
    const mc = (txt, w, opts = {}) => new TableCell({
        width: { size: w, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        borders: stdBorders,
        shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
        children: [new Paragraph({
            alignment: opts.align || "center",
            children: [new TextRun({
                text: txt,
                size: opts.size || 18,
                bold: opts.bold || false,
                color: opts.color || "000000",
                font: "Calibri"
            })]
        })]
    });

    const rsrpRows = [
        { label: "≥ −85 dBm (Excellent)",   k: "excellent" },
        { label: "−85 à −100 dBm (Bon)",    k: "bon" },
        { label: "−100 à −115 dBm (Faible)", k: "faible" },
        { label: "< −115 dBm (Critique)",   k: "critique" }
    ];
    const snrCols = [
        { label: "SNR > 15", k: ">15" },
        { label: "SNR 5 à 15", k: "5-15" },
        { label: "SNR 0 à 5", k: "0-5" },
        { label: "SNR < 0", k: "<0" }
    ];

    const W_LABEL = 3000;
    const W_COL = 1590;
    const TOTAL = W_LABEL + W_COL * 4; // 9360

    // Header row
    const headerCells = [
        mc("RSRP (Puissance)", W_LABEL, { fill: COLOR_TITLE, color: "FFFFFF", bold: true })
    ];
    snrCols.forEach(c => headerCells.push(mc(c.label, W_COL, { fill: COLOR_TITLE, color: "FFFFFF", bold: true })));
    const rows = [new TableRow({ children: headerCells })];

    // Body rows
    rsrpRows.forEach(r => {
        const cells = [mc(r.label, W_LABEL, { fill: COLOR_TABLE_LABEL, bold: true, align: "left" })];
        snrCols.forEach(c => {
            const q = QUALITY_MATRIX[r.k][c.k];
            const fill = q.color.replace("#", "").toUpperCase();
            cells.push(mc(q.label, W_COL, { fill: fill, color: "FFFFFF", bold: true }));
        });
        rows.push(new TableRow({ children: cells }));
    });

    return new Table({
        width: { size: TOTAL, type: WidthType.DXA },
        columnWidths: [W_LABEL, W_COL, W_COL, W_COL, W_COL],
        rows: rows
    });
}

// ---------- EXPOSITION GLOBALE ----------
window.closeEditor = () => window.Editor?.close();
window.saveAnnotation = () => window.Editor?.save();
window.generateDocument = generateDocument;
window.resetForm = () => { if (confirm("Réinitialiser tout le formulaire ?")) location.reload(); };

// ---------- EXPORT / IMPORT JSON ----------
function collectFormData() {
    const data = {
        version: "audit-4g5g-v1",
        exportedAt: new Date().toISOString(),
        fields: {},
        radios: {},      // boutons radio (name -> value)
        measurePoints: [],
        cheminements: [],
        evacPoints: evacPoints,
        photos: {}       // dataUrl pour pouvoir restaurer (optionnel et lourd)
    };

    // Tous les inputs / textareas / selects avec un id
    document.querySelectorAll("input[id], textarea[id], select[id]").forEach(el => {
        if (el.type === "file") return; // les fichiers ne s'exportent pas comme texte
        if (el.type === "radio" || el.type === "checkbox") return;
        data.fields[el.id] = el.value;
    });

    // Radios groupés par name
    document.querySelectorAll('input[type="radio"]:checked').forEach(el => {
        if (el.name) data.radios[el.name] = el.value;
    });

    // Points de mesure
    document.querySelectorAll('.measure-point-group').forEach(group => {
        const num = group.dataset.point;
        data.measurePoints.push({
            num: num,
            lieu: group.querySelector('.point-lieu')?.value || "",
            rsrp: group.querySelector('.measure-rsrp')?.value || "",
            rsrq: group.querySelector('.measure-rsrq')?.value || "",
            sinr: group.querySelector('.measure-sinr')?.value || "",
            down: group.querySelector('.measure-down')?.value || "",
            up:   group.querySelector('.measure-up')?.value   || "",
            band: group.querySelector('.measure-band')?.value || "",
            analysisLabel: group.dataset.analysisLabel || "",
            analysisColor: group.dataset.analysisColor || ""
        });
    });

    // Cheminements
    document.querySelectorAll('.cheminement-item').forEach(item => {
        data.cheminements.push({
            idx: item.dataset.idx,
            comment: item.querySelector('.cheminement-comment')?.value || ""
        });
    });

    // Photos (dataUrl en base64)
    Object.keys(photoStore).forEach(k => {
        data.photos[k] = {
            type: photoStore[k].type,
            dataUrl: photoStore[k].dataUrl
        };
    });

    return data;
}

window.exportJSON = function() {
    try {
        const data = collectFormData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const safeName = (document.getElementById("raison_sociale")?.value || "Audit").replace(/[^a-zA-Z0-9_-]/g, "_");
        const date = document.getElementById("date_audit")?.value || new Date().toISOString().slice(0,10);
        if (typeof saveAs !== "undefined") {
            saveAs(blob, `Audit_4G5G_${safeName}_${date}.json`);
        } else {
            // fallback : créer un lien et cliquer
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Audit_4G5G_${safeName}_${date}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
    } catch (err) {
        console.error("Erreur export JSON :", err);
        alert("Impossible d'exporter le formulaire.");
    }
};

window.importJSON = function(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            applyFormData(data);
            alert("✅ Données importées avec succès.");
        } catch (err) {
            console.error("Erreur import JSON :", err);
            alert("Le fichier n'est pas un export valide.");
        } finally {
            event.target.value = ""; // permet de réimporter le même fichier ensuite
        }
    };
    reader.readAsText(file);
};

function applyFormData(data) {
    if (!data || typeof data !== "object") return;

    // Champs simples
    if (data.fields) {
        Object.keys(data.fields).forEach(id => {
            const el = document.getElementById(id);
            if (el && el.type !== "file") el.value = data.fields[id];
        });
    }

    // Radios
    if (data.radios) {
        Object.keys(data.radios).forEach(name => {
            const v = data.radios[name];
            const el = document.querySelector(`input[type="radio"][name="${name}"][value="${v}"]`);
            if (el) el.checked = true;
        });
    }

    // Photos (restauration depuis dataUrl)
    if (data.photos) {
        Object.keys(data.photos).forEach(k => {
            const p = data.photos[k];
            if (!p || !p.dataUrl) return;
            const u8 = dataUrlToUint8Array(p.dataUrl);
            photoStore[k] = { data: u8, type: p.type || "jpg", dataUrl: p.dataUrl };
            const preview = document.getElementById("preview_" + k);
            if (preview) {
                preview.src = p.dataUrl;
                preview.classList.add("shown");
            }
            // Activer le bouton annoter si présent
            const ann = document.querySelector(`[data-annotate="${k}"]`);
            if (ann) ann.disabled = false;
        });
    }

    // Points de mesure : on vide d'abord, puis on recrée
    const mpContainer = document.getElementById("measurePointsContainer");
    if (mpContainer && data.measurePoints) {
        mpContainer.innerHTML = "";
        measureCounter = 0;
        data.measurePoints.forEach((mp, i) => {
            addMeasurePoint(i + 1);
            // On remplit le dernier groupe créé
            const groups = mpContainer.querySelectorAll('.measure-point-group');
            const grp = groups[groups.length - 1];
            if (grp) {
                if (mp.lieu)  grp.querySelector('.point-lieu').value = mp.lieu;
                if (mp.rsrp)  grp.querySelector('.measure-rsrp').value = mp.rsrp;
                if (mp.rsrq)  grp.querySelector('.measure-rsrq').value = mp.rsrq;
                if (mp.sinr)  grp.querySelector('.measure-sinr').value = mp.sinr;
                if (mp.down)  grp.querySelector('.measure-down').value = mp.down;
                if (mp.up)    grp.querySelector('.measure-up').value   = mp.up;
                if (mp.band)  grp.querySelector('.measure-band').value = mp.band;
                analyzePoint(grp);

                // Activer les boutons annoter pour les photos restaurées
                const num = grp.dataset.point;
                ['lieu', 'screen'].forEach(t => {
                    const key = `mesure_${t}_${num}`;
                    if (photoStore[key]) {
                        const ann = grp.querySelector(`[data-annotate="${key}"]`);
                        if (ann) ann.disabled = false;
                        const prev = document.getElementById(`preview_${key}`);
                        if (prev) {
                            prev.src = photoStore[key].dataUrl;
                            prev.classList.add("shown");
                        }
                    }
                });
            }
        });
    }

    // Cheminements
    const chemContainer = document.getElementById("cheminementContainer");
    if (chemContainer && data.cheminements) {
        chemContainer.innerHTML = "";
        cheminementCounter = 0;
        data.cheminements.forEach(ch => {
            addCheminementItem();
            const items = chemContainer.querySelectorAll('.cheminement-item');
            const item = items[items.length - 1];
            if (item) {
                if (ch.comment) item.querySelector('.cheminement-comment').value = ch.comment;
                const idx = item.dataset.idx;
                const key = `cheminement_${idx}`;
                if (photoStore[key]) {
                    const ann = item.querySelector(`[data-annotate="${key}"]`);
                    if (ann) ann.disabled = false;
                    const prev = document.getElementById(`preview_${key}`);
                    if (prev) {
                        prev.src = photoStore[key].dataUrl;
                        prev.classList.add("shown");
                    }
                }
            }
        });
    }

    // Plan d'évacuation
    if (photoStore['evac_plan']) {
        const stage = document.getElementById('evacStageContainer');
        const upArea = document.getElementById('evacUploadArea');
        const bgImg = document.getElementById('evacBgImage');
        if (stage) stage.style.display = 'block';
        if (bgImg) bgImg.src = photoStore['evac_plan'].dataUrl;
        if (upArea) upArea.style.display = 'none';
    }
}

// Helper : dataUrl → Uint8Array
function dataUrlToUint8Array(dataUrl) {
    const base64 = dataUrl.split(',')[1] || "";
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}
