// ============================================================
//  AUDIT 4G/5G — VERSION COMPLÈTE CORRIGÉE (Style Starlink)
// ============================================================

const photoStore = {};
let measureCounter = 0;
let evacPointCounter = 0;
let cheminementCounter = 1;
let evacPoints = [];

// ATTENTE DES LIBRAIRIES
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

// INIT
document.addEventListener("DOMContentLoaded", async () => {
    await waitForLibs();

    const today = new Date().toISOString().slice(0, 10);
    if(document.getElementById("date_audit")) document.getElementById("date_audit").value = today;
    if(document.getElementById("signataire_date")) document.getElementById("signataire_date").value = today;

    // Gestion globale des clics (Annoter / Effacer)
    document.body.addEventListener("click", handleGlobalClick);

    // Initialisation des points de mesure par défaut
    initMeasurePoints();
    
    const addMPBtn = document.getElementById("addMeasurePointBtn");
    if (addMPBtn) addMPBtn.addEventListener("click", () => addMeasurePoint());

    const btnChem = document.getElementById("addCheminementBtn");
    if (btnChem) btnChem.addEventListener("click", addCheminementItem);

    const evacInput = document.getElementById("evacFileInput");
    if (evacInput) evacInput.addEventListener("change", handleEvacUpload);
    
    const addEvacBtn = document.getElementById("addEvacPointBtn");
    if (addEvacBtn) addEvacBtn.addEventListener("click", addEvacPoint);

    console.log("✅ Audit 4G/5G chargé avec succès");
});

// GESTION CLICS (Annoter / Effacer)
function handleGlobalClick(e) {
    const annBtn = e.target.closest("[data-annotate]");
    if (annBtn) {
        const key = annBtn.dataset.annotate;
        if (!photoStore[key]) return alert("Importez d'abord une photo.");
        if (typeof window.Editor !== 'undefined') {
            window.Editor.open(key, "Photo " + key);
        } else {
            alert("L'éditeur n'est pas prêt.");
        }
        return;
    }

    const clearBtn = e.target.closest("[data-clear]");
    if (clearBtn) {
        const key = clearBtn.dataset.clear;
        delete photoStore[key];
        const preview = document.getElementById("preview_" + key);
        if (preview) { preview.src = ""; preview.classList.remove("shown"); }
        return;
    }
}

// PROCESSUS PHOTO CENTRALISÉ
async function processPhoto(file, key) {
    if (!file) return;
    const buf = await file.arrayBuffer();
    const u8 = new Uint8Array(buf);
    const type = file.type.toLowerCase().includes("png") ? "png" : "jpg";
    const dataUrl = await new Promise(r => {
        const reader = new FileReader();
        reader.onload = ev => r(ev.target.result);
        reader.readAsDataURL(file);
    });

    photoStore[key] = { data: u8, type: type, dataUrl: dataUrl };
    const preview = document.getElementById("preview_" + key);
    if (preview) { preview.src = dataUrl; preview.classList.add("shown"); }
}

// ANALYSE AUTOMATIQUE RADIO
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
    if (rsrp >= -75) score += 30; else if (rsrp >= -90) score += 20; else if (rsrp >= -105) score += 10;
    if (rsrq >= -5) score += 30; else if (rsrq >= -10) score += 20; else if (rsrq >= -13) score += 10;
    if (sinr >= 20) score += 40; else if (sinr >= 13) score += 30; else if (sinr >= 5) score += 20;

    let label = "Signal faible";
    if (score >= 80) label = "Très bonne qualité";
    else if (score >= 60) label = "Bonne qualité";
    else if (score >= 40) label = "Qualité moyenne";

    resultSpan.textContent = `${label} (score ${score}/100)`;
    group.dataset.analysisPhrase = label;
}

// POINTS DE MESURE DYNAMIQUES
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
    if(!container) return;

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
                <button class="annotate-btn" data-annotate="mesure_lieu_${count}" disabled>✏ Annoter</button>
            </div>
            <div>
                <label>📱 Copie écran mesure</label><br>
                <input type="file" accept="image/*" data-measure-index="${count}" data-photo-type="screen">
                <img id="preview_mesure_screen_${count}" class="photo-preview">
                <button class="annotate-btn" data-annotate="mesure_screen_${count}" disabled>✏ Annoter</button>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px;">
            <input type="text" class="measure-rsrp" placeholder="RSRP (dBm)">
            <input type="text" class="measure-rsrq" placeholder="RSRQ (dB)">
            <input type="text" class="measure-sinr" placeholder="SINR (dB)">
            <input type="text" class="measure-down" placeholder="↓ Desc (Mbps)">
            <input type="text" class="measure-up" placeholder="↑ Mont (Mbps)">
            <input type="text" class="measure-band" placeholder="Bande">
        </div>
        <div style="margin-top:8px;"><strong>Analyse :</strong> <span class="analysis-result">En attente</span></div>
    `;
    container.appendChild(div);

    div.querySelectorAll('input[type="file"]').forEach(inp => {
        inp.addEventListener("change", async (e) => {
            const index = e.target.dataset.measureIndex;
            const type = e.target.dataset.photoType;
            const key = `mesure_${type}_${index}`;
            await processPhoto(e.target.files[0], key);
            div.querySelector(`[data-annotate="${key}"]`).disabled = false;
        });
    });

    div.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('input', () => analyzePoint(div));
    });
}

// PLAN D'ÉVACUATION
function handleEvacUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
        const dataUrl = ev.target.result;
        const buf = await file.arrayBuffer();
        photoStore['evac_plan'] = { data: new Uint8Array(buf), type: file.type.includes("png") ? "png" : "jpg", dataUrl: dataUrl };
        document.getElementById('evacStageContainer').style.display = 'block';
        document.getElementById('evacBgImage').src = dataUrl;
        document.getElementById('evacUploadArea').style.display = 'none';
    };
    reader.readAsDataURL(file);
}

function addEvacPoint() {
    const container = document.getElementById('evacStageWrap');
    if (!container || !document.getElementById('evacBgImage').src) return alert("Importez un plan.");
    evacPointCounter++;
    const div = document.createElement('div');
    div.className = 'evac-point';
    div.style.left = '50%'; div.style.top = '50%';
    div.innerHTML = `<div style="position:absolute;bottom:100%;left:50%;transform:translateX(-50%);background:white;padding:2px;font-weight:bold;font-size:12px;border:1px solid black;">P${evacPointCounter}</div>`;
    container.appendChild(div);
    evacPoints.push({ pointId: evacPointCounter });
}

// CHEMINEMENT
function addCheminementItem() {
    const container = document.getElementById('cheminementContainer');
    const idx = cheminementCounter++;
    const div = document.createElement('div');
    div.className = 'cheminement-item';
    div.innerHTML = `
        <div class="photo-upload">
            <div class="photo-upload-label">
                📷 Photo Cheminement ${idx}
                <input type="file" accept="image/*">
                <button class="annotate-btn" data-annotate="cheminement_${idx}" disabled>✏ Annoter</button>
            </div>
            <img class="photo-preview" id="preview_cheminement_${idx}">
        </div>
        <textarea class="cheminement-comment" placeholder="Description du cheminement..."></textarea>
    `;
    container.appendChild(div);
    div.querySelector('input').addEventListener('change', async (e) => {
        await processPhoto(e.target.files[0], `cheminement_${idx}`);
        div.querySelector('.annotate-btn').disabled = false;
    });
}

// GÉNÉRATION WORD COMPLÈTE
async function generateDocument() {
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, Header, Footer, AlignmentType, WidthType, BorderStyle, VerticalAlign } = window.docx;

    const b64 = (s) => {
        const bin = atob(s);
        const res = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) res[i] = bin.charCodeAt(i);
        return res;
    };

    const val = (id) => document.getElementById(id)?.value || "—";
    const P = (txt, opts = {}) => new Paragraph({ 
        alignment: opts.align || AlignmentType.LEFT,
        children: [new TextRun({ text: txt, bold: opts.bold, size: opts.size || 20, color: opts.color || "000000", font: "Calibri" })] 
    });

    const cell = (content, width = 4680) => new TableCell({
        width: { size: width, type: WidthType.DXA },
        children: [typeof content === "string" ? P(content) : content]
    });

    const children = [];

    // EN-TÊTE
    children.push(P("RAPPORT D'AUDIT - INSTALLATION ANTENNE 4G/5G", { bold: true, size: 32, color: "1F3864" }));
    children.push(P(`Date de l'audit : ${val("date_audit")}`));
    children.push(P(""));

    // 1. INFOS ADMINISTRATIVES
    children.push(P("1. INFORMATIONS ADMINISTRATIVES", { bold: true, size: 26, color: "1F3864" }));
    children.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        rows: [
            new TableRow({ children: [ cell("Raison sociale", 3120), cell(val("raison_sociale"), 6240) ] }),
            new TableRow({ children: [ cell("Adresse", 3120), cell(val("adresse"), 6240) ] }),
            new TableRow({ children: [ cell("Contact site", 3120), cell(val("contact_nom"), 6240) ] })
        ]
    }));
    children.push(P(""));

    // 2. INFOS TECHNIQUES
    children.push(P("2. INFORMATIONS TECHNIQUES CLIENT", { bold: true, size: 26, color: "1F3864" }));
    children.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        rows: [
            new TableRow({ children: [ cell("Localisation baie", 3120), cell(val("localisation_baie"), 6240) ] }),
            new TableRow({ children: [ cell("Nb prises élec.", 3120), cell(val("nb_prises"), 6240) ] })
        ]
    }));
    children.push(P(""));

    // 3. MESURES RADIO (CÔTE À CÔTE)
    children.push(P("3. MESURES RADIO 4G/5G", { bold: true, size: 26, color: "1F3864" }));
    document.querySelectorAll('.measure-point-group').forEach((group, idx) => {
        const num = idx + 1;
        const keyLieu = `mesure_lieu_${num}`;
        const keyScreen = `mesure_screen_${num}`;
        const lieuTxt = group.querySelector('.point-lieu').value || `Point ${num}`;
        
        children.push(P(`\nPoint ${num} : ${lieuTxt}`, { bold: true, color: "2E75B6" }));

        // Tableau des valeurs radio
        children.push(new Table({
            width: { size: 9360, type: WidthType.DXA },
            rows: [
                new TableRow({ children: [ cell("RSRP", 2340), cell(group.querySelector('.measure-rsrp').value || "—"), cell("RSRQ", 2340), cell(group.querySelector('.measure-rsrq').value || "—") ] }),
                new TableRow({ children: [ cell("SINR", 2340), cell(group.querySelector('.measure-sinr').value || "—"), cell("Bande", 2340), cell(group.querySelector('.measure-band').value || "—") ] })
            ]
        }));
        children.push(P(`Analyse : ${group.querySelector('.analysis-result').textContent}`));

        // Photos côte à côte
        if (photoStore[keyLieu] || photoStore[keyScreen]) {
            children.push(new Table({
                width: { size: 9360, type: WidthType.DXA },
                borders: { top: {style: BorderStyle.NONE}, bottom: {style: BorderStyle.NONE}, left: {style: BorderStyle.NONE}, right: {style: BorderStyle.NONE}, insideHorizontal: {style: BorderStyle.NONE}, insideVertical: {style: BorderStyle.NONE} },
                rows: [
                    new TableRow({
                        children: [
                            new TableCell({
                                width: { size: 4680, type: WidthType.DXA },
                                children: photoStore[keyLieu] ? [ P("📷 Photo lieu:", {bold:true}), new Paragraph({ children: [new ImageRun({ data: photoStore[keyLieu].data, transformation: { width: 230, height: 170 }, type: photoStore[keyLieu].type })] }) ] : []
                            }),
                            new TableCell({
                                width: { size: 4680, type: WidthType.DXA },
                                children: photoStore[keyScreen] ? [ P("📱 Écran mesure:", {bold:true}), new Paragraph({ children: [new ImageRun({ data: photoStore[keyScreen].data, transformation: { width: 230, height: 170 }, type: photoStore[keyScreen].type })] }) ] : []
                            })
                        ]
                    })
                ]
            }));
        }
    });

    // 4. PLAN D'ÉVACUATION
    children.push(P("\n4. PLAN D'ÉVACUATION", { bold: true, size: 26, color: "1F3864" }));
    if (photoStore['evac_plan']) {
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: photoStore['evac_plan'].data, transformation: { width: 500, height: 350 }, type: photoStore['evac_plan'].type })] }));
        if(evacPoints.length > 0) children.push(P(`Nombre de points positionnés : ${evacPoints.length}`));
    }

    // 5. CHEMINEMENT
    children.push(P("\n5. CHEMINEMENT CÂBLE / INSTALLATION", { bold: true, size: 26, color: "1F3864" }));
    document.querySelectorAll('.cheminement-item').forEach((item, idx) => {
        const key = `cheminement_${idx + 1}`;
        const comm = item.querySelector('.cheminement-comment').value;
        if (photoStore[key]) {
            children.push(new Paragraph({ children: [new ImageRun({ data: photoStore[key].data, transformation: { width: 400, height: 280 }, type: photoStore[key].type })] }));
        }
        if (comm) children.push(P(`Commentaire : ${comm}`, { italics: true }));
    });

    // 6. SYNTHÈSE
    children.push(P("\n6. SYNTHÈSE ET OBSERVATIONS", { bold: true, size: 26, color: "1F3864" }));
    children.push(P(val("observations")));

    // DOCUMENT FINAL AVEC PIED DE PAGE ET LOGOS
    const doc = new Document({
        sections: [{
            properties: { page: { margin: { top: 1440, right: 1080, bottom: 1080, left: 1080 } } },
            headers: {
                default: new Header({
                    children: [new Table({
                        width: { size: 9360, type: WidthType.DXA },
                        borders: { top: {style: BorderStyle.NONE}, bottom: {style: BorderStyle.NONE}, left: {style: BorderStyle.NONE}, right: {style: BorderStyle.NONE}, insideHorizontal: {style: BorderStyle.NONE}, insideVertical: {style: BorderStyle.NONE} },
                        rows: [new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ children: [new ImageRun({ data: b64(LOGO_IPKONEKT_B64), transformation: { width: 56, height: 50 } })] })] }),
                                new TableCell({ verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "RAPPORT D'AUDIT 4G/5G", bold: true, size: 24, color: "1F3864" })] })] }),
                                new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new ImageRun({ data: b64(LOGO_BOUYGUES_B64), transformation: { width: 56, height: 56 } })] })] })
                            ]
                        })]
                    })]
                })
            },
            footers: {
                default: new Footer({
                    children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: "Document confidentiel — Usage interne IPKONEKT / Bouygues Telecom", italics: true, size: 16, color: "888888" })] })]
                })
            },
            children: children
        }]
    });

    Packer.toBlob(doc).then(blob => {
        saveAs(blob, `Audit_4G5G_${val("raison_sociale")}.docx`);
    });
}

// EXPOSITION FONCTIONS GLOBALES
window.closeEditor = () => window.Editor?.close();
window.saveAnnotation = () => window.Editor?.save();
window.generateDocument = generateDocument;
window.resetForm = () => { if(confirm("Réinitialiser ?")) location.reload(); };
