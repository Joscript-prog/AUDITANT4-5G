// ============================================================
//  AUDIT 4G/5G — Génération du rapport Word
//  IPKONEKT / Bouygues Telecom
//  v1.0 — adaptation du formulaire Starlink
// ============================================================

// Stockage des photos en mémoire
const photoStore = {};
const measurePoints = [];
let evacPoints = [];
let cheminementItems = [];
let measureCounter = 0;
let evacPointCounter = 0;
let cheminementCounter = 1;

// Mapping pour l'éditeur (clé temporaire)
let editingContext = null; // { type, key, pointIndex? }

// ============================================================
//  INIT
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
    // Date par défaut
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById("date_audit").value = today;
    document.getElementById("signataire_date").value = today;

    // Événements photos
    document.querySelectorAll('input[type="file"][data-photo-key]').forEach(input => {
        input.addEventListener("change", handlePhotoUpload);
    });

    // Boutons annoter
    document.querySelectorAll("[data-annotate]").forEach(btn => {
        btn.addEventListener("click", function() {
            const key = this.dataset.annotate;
            if (!photoStore[key]) {
                alert("Importez d'abord une photo avant de l'annoter.");
                return;
            }
            // Déterminer le libellé
            const label = document.querySelector(`[data-photo-key="${key}"]`)?.closest('.photo-upload-label')?.textContent?.trim() || "Photo";
            Editor.open(key, label);
        });
    });

    // Boutons effacer
    document.querySelectorAll("[data-clear]").forEach(btn => {
        btn.addEventListener("click", function() {
            const key = this.dataset.clear;
            delete photoStore[key];
            const prev = document.getElementById("preview_" + key);
            if (prev) {
                prev.src = "";
                prev.classList.remove("shown");
            }
            const fileInput = document.querySelector(`input[data-photo-key="${key}"]`);
            if (fileInput) fileInput.value = "";
            const annBtn = document.querySelector(`[data-annotate="${key}"]`);
            if (annBtn) annBtn.disabled = true;
        });
    });

    // Points de mesure initiaux
    initMeasurePoints();

    // Plan d'évacuation
    document.getElementById("evacFileInput").addEventListener("change", handleEvacUpload);
    document.getElementById("addEvacPointBtn").addEventListener("click", addEvacPoint);

    // Cheminement
    document.getElementById("addCheminementBtn").addEventListener("click", addCheminementItem);
    document.querySelectorAll('.cheminement-photo-input').forEach(input => {
        input.addEventListener("change", handleCheminementPhoto);
    });

    // Ajouter point mesure
    document.getElementById("addMeasurePointBtn").addEventListener("click", addMeasurePoint);

    // Analyse automatique sur changement
    document.querySelectorAll('.measure-rsrp, .measure-rsrq, .measure-sinr').forEach(el => {
        el.addEventListener('input', function() {
            const group = this.closest('.measure-point-group');
            if (group) analyzePoint(group);
        });
    });

    // Import JSON
    document.getElementById("importJSONInput").addEventListener("change", importJSON);

    // Vérifier librairies
    if (window.__libsLoaded) {
        window.__libsLoaded.then(results => {
            const allOK = results.every(r => r === true);
            if (!allOK) {
                showStatus("⚠ Impossible de charger les librairies docx/FileSaver. Vérifiez la console.", "error");
            }
        });
    }
});

// ============================================================
//  GESTION DES PHOTOS
// ============================================================
async function handlePhotoUpload(e) {
    const input = e.target;
    const key = input.dataset.photoKey;
    const file = input.files[0];
    if (!file) {
        delete photoStore[key];
        document.getElementById("preview_" + key).classList.remove("shown");
        return;
    }

    const buf = await file.arrayBuffer();
    const u8 = new Uint8Array(buf);
    const mime = file.type.toLowerCase();
    let type = "png";
    if (mime.includes("jpeg") || mime.includes("jpg")) type = "jpg";
    else if (mime.includes("png")) type = "png";
    else if (mime.includes("gif")) type = "gif";
    else if (mime.includes("bmp")) type = "bmp";
    else if (mime.includes("webp")) type = "png";

    const dataUrl = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = ev => resolve(ev.target.result);
        reader.readAsDataURL(file);
    });

    const dims = await new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve({ w: 4, h: 3 });
        img.src = dataUrl;
    });

    photoStore[key] = {
        data: u8,
        type: type,
        name: file.name,
        dataUrl: dataUrl,
        naturalWidth: dims.w,
        naturalHeight: dims.h,
        annotated: false,
    };

    const preview = document.getElementById("preview_" + key);
    preview.src = dataUrl;
    preview.classList.add("shown");

    const annBtn = document.querySelector(`[data-annotate="${key}"]`);
    if (annBtn) annBtn.disabled = false;
}

// ============================================================
//  POINTS DE MESURE
// ============================================================
function initMeasurePoints() {
    const existing = document.querySelectorAll('.measure-point-group');
    if (existing.length === 0) {
        // Créer 3 points par défaut
        for (let i = 1; i <= 3; i++) {
            addMeasurePoint(i);
        }
    }
}

function addMeasurePoint(forcedIndex) {
    const container = document.getElementById("measurePointsContainer");
    const idx = forcedIndex || measurePoints.length + 1;
    const div = document.createElement("div");
    div.className = "measure-point-group";
    div.dataset.point = idx;
    const labels = ["Emplacement souhaité par le client", "Emplacement préconisé par le technicien", "À l'extérieur du bâtiment"];
    const label = labels[idx - 1] || `Point ${idx}`;
    div.innerHTML = `
        <h3>Point ${idx} — ${label}</h3>
        <div class="field-row">
            <label>Lieu / Pièce</label>
            <input type="text" class="point-lieu" value="${idx === 1 ? 'Local informatique' : ''}">
        </div>
        <div class="photo-upload">
            <div class="photo-upload-label">
                📷 Photo du point ${idx}
                <input type="file" accept="image/*" class="measure-photo-input" data-point="${idx}">
                <button class="annotate-btn" data-annotate-measure="${idx}" disabled>✏ Annoter</button>
                <button class="clear-photo" data-clear-measure="${idx}">✕</button>
            </div>
            <img class="photo-preview" id="preview_measure_${idx}">
        </div>
        <div class="field-row">
            <label>RSRP (dBm)</label>
            <input type="number" class="measure-rsrp" step="1" placeholder="-85">
        </div>
        <div class="field-row">
            <label>RSRQ (dB)</label>
            <input type="number" class="measure-rsrq" step="0.1" placeholder="-10">
        </div>
        <div class="field-row">
            <label>SINR (dB)</label>
            <input type="number" class="measure-sinr" step="0.1" placeholder="15">
        </div>
        <div class="field-row">
            <label>Débit descendant (Mbps)</label>
            <input type="number" class="measure-down" step="0.01" placeholder="50">
        </div>
        <div class="field-row">
            <label>Débit montant (Mbps)</label>
            <input type="number" class="measure-up" step="0.01" placeholder="10">
        </div>
        <div class="field-row">
            <label>Bande (ex: 20, 28, n78...)</label>
            <input type="text" class="measure-band" placeholder="20">
        </div>
        <div class="auto-analysis-box" data-analyze="${idx}">
            <strong>Analyse automatique :</strong> <span class="analysis-result">En attente de données</span>
        </div>
    `;
    container.appendChild(div);
    measurePoints.push(idx);

    // Gestion photo
    const fileInput = div.querySelector('.measure-photo-input');
    fileInput.addEventListener('change', function() {
        const point = this.dataset.point;
        const file = this.files[0];
        if (!file) return;
        const key = `measure_${point}`;
        // Stocker dans photoStore
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const dataUrl = ev.target.result;
            const buf = await file.arrayBuffer();
            const u8 = new Uint8Array(buf);
            const mime = file.type.toLowerCase();
            let type = "png";
            if (mime.includes("jpeg") || mime.includes("jpg")) type = "jpg";
            else if (mime.includes("png")) type = "png";
            else if (mime.includes("gif")) type = "gif";
            else if (mime.includes("bmp")) type = "bmp";
            const dims = await new Promise(resolve2 => {
                const img = new Image();
                img.onload = () => resolve2({ w: img.naturalWidth, h: img.naturalHeight });
                img.onerror = () => resolve2({ w: 4, h: 3 });
                img.src = dataUrl;
            });
            photoStore[key] = {
                data: u8,
                type: type,
                name: file.name,
                dataUrl: dataUrl,
                naturalWidth: dims.w,
                naturalHeight: dims.h,
                annotated: false,
            };
            const preview = document.getElementById(`preview_measure_${point}`);
            if (preview) {
                preview.src = dataUrl;
                preview.classList.add("shown");
            }
            const annBtn = div.querySelector(`[data-annotate-measure="${point}"]`);
            if (annBtn) annBtn.disabled = false;
        };
        reader.readAsDataURL(file);
    });

    // Annoter measure
    const annBtn = div.querySelector(`[data-annotate-measure="${idx}"]`);
    annBtn.addEventListener('click', function() {
        const point = this.dataset.annotateMeasure;
        const key = `measure_${point}`;
        if (!photoStore[key]) {
            alert("Importez d'abord une photo.");
            return;
        }
        Editor.open(key, `Point ${point} - Mesure`);
    });

    // Effacer measure
    const clearBtn = div.querySelector(`[data-clear-measure="${idx}"]`);
    clearBtn.addEventListener('click', function() {
        const point = this.dataset.clearMeasure;
        const key = `measure_${point}`;
        delete photoStore[key];
        const preview = document.getElementById(`preview_measure_${point}`);
        if (preview) {
            preview.src = "";
            preview.classList.remove("shown");
        }
        const fileInput2 = div.querySelector(`.measure-photo-input`);
        if (fileInput2) fileInput2.value = "";
        const annBtn2 = div.querySelector(`[data-annotate-measure="${point}"]`);
        if (annBtn2) annBtn2.disabled = true;
    });

    // Analyse initiale
    analyzePoint(div);
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

    // Algorithme de qualité
    let score = 0;
    // RSRP : -75 = max, -115 = min
    if (rsrp >= -75) score += 30;
    else if (rsrp >= -90) score += 20;
    else if (rsrp >= -105) score += 10;
    else if (rsrp >= -115) score += 5;
    else score += 0;

    // RSRQ : -5 = max, -13 = min
    if (rsrq >= -5) score += 30;
    else if (rsrq >= -10) score += 20;
    else if (rsrq >= -13) score += 10;
    else score += 0;

    // SINR : 20 = max, 0 = min
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

    // Générer phrase technique
    let phrase = "";
    if (score >= 80) phrase = "Le signal présente une excellente qualité radio avec un faible niveau d'interférences.";
    else if (score >= 60) phrase = "La qualité radio est bonne, adaptée à une installation standard.";
    else if (score >= 40) phrase = "La puissance radio est correcte mais la qualité est dégradée par un SINR modéré.";
    else if (score >= 20) phrase = "Le signal est de qualité faible, des mesures d'amélioration sont recommandées.";
    else phrase = "Le signal est inutilisable en raison d'interférences importantes malgré une puissance acceptable.";

    // Ajouter la phrase comme attribut
    group.dataset.analysisPhrase = phrase;
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
        let type = "png";
        if (mime.includes("jpeg") || mime.includes("jpg")) type = "jpg";
        else if (mime.includes("png")) type = "png";
        else if (mime.includes("gif")) type = "gif";
        else if (mime.includes("bmp")) type = "bmp";

        const key = "evac_plan";
        photoStore[key] = {
            data: u8,
            type: type,
            name: file.name,
            dataUrl: dataUrl,
            naturalWidth: 0,
            naturalHeight: 0,
            annotated: false,
        };

        const img = new Image();
        img.onload = () => {
            photoStore[key].naturalWidth = img.naturalWidth;
            photoStore[key].naturalHeight = img.naturalHeight;
            const container = document.getElementById('evacStageContainer');
            container.style.display = 'block';
            const bg = document.getElementById('evacBgImage');
            bg.src = dataUrl;
            // Réinitialiser les points
            evacPoints = [];
            document.querySelectorAll('.evac-point').forEach(el => el.remove());
            document.getElementById('evacUploadArea').style.display = 'none';
        };
        img.src = dataUrl;
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
    div.title = `Point ${evacPointCounter}`;

    // Label
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

    // Événements drag
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

    // Couleur selon l'analyse du point correspondant
    updateEvacPointColor(div, evacPointCounter);

    container.appendChild(div);
    evacPoints.push({ el: div, pointId: evacPointCounter });
}

function updateEvacPointColor(div, pointIdx) {
    // Chercher le point de mesure correspondant
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
    const idx = cheminementCounter++;
    const div = document.createElement('div');
    div.className = 'cheminement-item';
    div.innerHTML = `
        <div class="photo-upload">
            <div class="photo-upload-label">
                📷 Photo ${idx}
                <input type="file" accept="image/*" class="cheminement-photo-input" data-index="${idx}">
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

    // Gestion photo
    const fileInput = div.querySelector('.cheminement-photo-input');
    fileInput.addEventListener('change', function() {
        const idx2 = this.dataset.index;
        const file = this.files[0];
        if (!file) return;
        const key = `cheminement_${idx2}`;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const dataUrl = ev.target.result;
            const buf = await file.arrayBuffer();
            const u8 = new Uint8Array(buf);
            const mime = file.type.toLowerCase();
            let type = "png";
            if (mime.includes("jpeg") || mime.includes("jpg")) type = "jpg";
            else if (mime.includes("png")) type = "png";
            else if (mime.includes("gif")) type = "gif";
            else if (mime.includes("bmp")) type = "bmp";
            const dims = await new Promise(resolve2 => {
                const img = new Image();
                img.onload = () => resolve2({ w: img.naturalWidth, h: img.naturalHeight });
                img.onerror = () => resolve2({ w: 4, h: 3 });
                img.src = dataUrl;
            });
            photoStore[key] = {
                data: u8,
                type: type,
                name: file.name,
                dataUrl: dataUrl,
                naturalWidth: dims.w,
                naturalHeight: dims.h,
                annotated: false,
            };
            const preview = document.getElementById(`preview_cheminement_${idx2}`);
            if (preview) {
                preview.src = dataUrl;
                preview.classList.add("shown");
            }
            const annBtn = div.querySelector(`[data-annotate-cheminement="${idx2}"]`);
            if (annBtn) annBtn.disabled = false;
        };
        reader.readAsDataURL(file);
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
        Editor.open(key, `Cheminement ${idx2}`);
    });

    // Effacer
    const clearBtn = div.querySelector(`[data-clear-cheminement="${idx}"]`);
    clearBtn.addEventListener('click', function() {
        const idx2 = this.dataset.clearCheminement;
        const key = `cheminement_${idx2}`;
        delete photoStore[key];
        const preview = document.getElementById(`preview_cheminement_${idx2}`);
        if (preview) {
            preview.src = "";
            preview.classList.remove("shown");
        }
        const fileInput2 = div.querySelector('.cheminement-photo-input');
        if (fileInput2) fileInput2.value = "";
        const annBtn2 = div.querySelector(`[data-annotate-cheminement="${idx2}"]`);
        if (annBtn2) annBtn2.disabled = true;
    });
}

// Gestion des photos existantes au chargement
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.cheminement-photo-input').forEach(input => {
        input.addEventListener('change', handleCheminementPhoto);
    });
});

function handleCheminementPhoto(e) {
    // Déjà géré dans addCheminementItem
}

// ============================================================
//  UTILITAIRES
// ============================================================
function val(id) {
    const el = document.getElementById(id);
    return el ? (el.value || "").trim() : "";
}

function checkedValues(name) {
    return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(i => i.value);
}

function radioValue(name) {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : "";
}

function formatDateFR(isoDate) {
    if (!isoDate) return "";
    const parts = isoDate.split("-");
    if (parts.length !== 3) return isoDate;
    return parts[2] + "/" + parts[1] + "/" + parts[0];
}

function buildFilename() {
    const ref = (val("ref_commande") || "").replace(/[^a-zA-Z0-9_-]/g, "_");
    const raison = (val("raison_sociale") || "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
    const date = val("date_audit") || new Date().toISOString().slice(0, 10);
    let parts = ["AUDIT_4G5G"];
    if (ref) parts.push(ref);
    if (raison) parts.push(raison);
    parts.push(date);
    return parts.join("_") + ".docx";
}

function showStatus(msg, type) {
    const s = document.getElementById("status");
    s.textContent = msg;
    s.className = "status " + (type || "");
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
    // Réinitialiser points de mesure
    document.querySelectorAll(".measure-point-group").forEach(el => el.remove());
    measurePoints.length = 0;
    measureCounter = 0;
    initMeasurePoints();
    // Plan d'évacuation
    document.getElementById('evacStageContainer').style.display = 'none';
    document.getElementById('evacUploadArea').style.display = 'block';
    document.querySelectorAll('.evac-point').forEach(el => el.remove());
    evacPoints = [];
    evacPointCounter = 0;
    // Cheminement
    document.querySelectorAll('.cheminement-item').forEach(el => el.remove());
    cheminementCounter = 1;
    addCheminementItem();
    showStatus("Formulaire réinitialisé.", "success");
}

// ============================================================
//  EXPORT JSON
// ============================================================
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

// ============================================================
//  IMPORT JSON
// ============================================================
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

    // Points de mesure
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
            analysisPhrase: group.dataset.analysisPhrase || "",
        };
        data.mesure_points.push(point);
    });

    // Cheminement
    data.cheminement = [];
    document.querySelectorAll('.cheminement-item').forEach(item => {
        const comment = item.querySelector('.cheminement-comment').value;
        data.cheminement.push({ comment });
    });

    return data;
}

function populateForm(data) {
    // Champs simples
    for (const [key, value] of Object.entries(data)) {
        if (key === 'mesure_points' || key === 'cheminement') continue;
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

    // Points de mesure
    // Supprimer existants
    document.querySelectorAll('.measure-point-group').forEach(el => el.remove());
    measurePoints.length = 0;
    measureCounter = 0;
    // Recréer
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
            if (p.analysisPhrase) group.dataset.analysisPhrase = p.analysisPhrase;
            analyzePoint(group);
        }
    });

    // Cheminement
    document.querySelectorAll('.cheminement-item').forEach(el => el.remove());
    cheminementCounter = 1;
    if (data.cheminement && data.cheminement.length > 0) {
        data.cheminement.forEach((c, idx) => {
            addCheminementItem();
            const items = document.querySelectorAll('.cheminement-item');
            const item = items[items.length - 1];
            item.querySelector('.cheminement-comment').value = c.comment || '';
        });
    } else {
        addCheminementItem();
    }
}

// ============================================================
//  GÉNÉRATION WORD
// ============================================================
async function generateDocument() {
    showStatus("Génération du document en cours...", "loading");

    try {
        if (typeof window !== "undefined" && window.__libsLoaded) {
            const results = await Promise.race([
                window.__libsLoaded,
                new Promise(r => setTimeout(() => r([false]), 5000))
            ]);
            if (!results.every(r => r === true)) {
                throw new Error("Les librairies docx/FileSaver ne sont pas chargées.");
            }
        }

        if (typeof docx === "undefined" && typeof window !== "undefined" && typeof window.docx === "undefined") {
            throw new Error("La librairie docx n'a pas pu être chargée.");
        }
        const docxLib = (typeof docx !== "undefined") ? docx : window.docx;

        const {
            Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
            ImageRun, Header, Footer, AlignmentType, BorderStyle, WidthType,
            ShadingType, VerticalAlign, TabStopType
        } = docxLib;

        // Constantes
        const COLOR_PRIMARY = "1F3864";
        const COLOR_ACCENT = "2E75B6";
        const COLOR_HEADER_BG = "2E5481";
        const COLOR_TABLE_HEADER = "DEEAF6";
        const COLOR_BORDER = "BFBFBF";
        const COLOR_TEXT = "222222";
        const COLOR_GREY_FOOTER = "888888";
        const FONT = "Calibri";

        const border = { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER };
        const borders = { top: border, bottom: border, left: border, right: border };
        const noBorders = {
            top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }
        };

        function P(text, opts = {}) {
            return new Paragraph({
                alignment: opts.align || AlignmentType.LEFT,
                spacing: opts.spacing || { before: 0, after: 80 },
                children: [
                    new TextRun({
                        text: text || "",
                        bold: opts.bold || false,
                        italics: opts.italics || false,
                        size: opts.size || 20,
                        color: opts.color || COLOR_TEXT,
                        font: FONT
                    })
                ]
            });
        }

        function emptyP() {
            return new Paragraph({ children: [new TextRun({ text: "", font: FONT, size: 20 })] });
        }

        function cell(content, opts = {}) {
            const children = Array.isArray(content) ? content : [content];
            return new TableCell({
                borders,
                width: { size: opts.width || 4680, type: WidthType.DXA },
                shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
                margins: { top: 60, bottom: 60, left: 120, right: 120 },
                verticalAlign: opts.valign || VerticalAlign.CENTER,
                columnSpan: opts.columnSpan || undefined,
                children: children.map(c => typeof c === "string" ? P(c, opts.textOpts) : c)
            });
        }

        function cb(label, checked) {
            const symbol = checked ? "☒ " : "☐ ";
            return new TextRun({
                text: symbol + label,
                bold: checked,
                size: 20,
                color: checked ? COLOR_PRIMARY : COLOR_TEXT,
                font: FONT
            });
        }

        function checkboxParagraph(items) {
            const children = [];
            items.forEach((it, idx) => {
                children.push(cb(it.label, it.checked));
                if (idx < items.length - 1) children.push(new TextRun({ text: "    ", font: FONT }));
            });
            return new Paragraph({ children, spacing: { before: 0, after: 60 } });
        }

        function makePhotoBlock(label, photoKey, opts = {}) {
            const photo = photoStore[photoKey];
            if (!photo) return null;
            const maxW = opts.width || 240;
            const maxH = opts.height || 180;
            const tableWidth = opts.tableWidth || 4400;
            const natW = photo.naturalWidth || maxW;
            const natH = photo.naturalHeight || maxH;
            const ratio = Math.min(maxW / natW, maxH / natH);
            const drawW = Math.round(natW * ratio);
            const drawH = Math.round(natH * ratio);

            return new Table({
                width: { size: tableWidth, type: WidthType.DXA },
                columnWidths: [tableWidth],
                rows: [
                    new TableRow({
                        cantSplit: true,
                        children: [
                            new TableCell({
                                borders: {
                                    top: { style: BorderStyle.SINGLE, size: 6, color: COLOR_ACCENT },
                                    bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR_ACCENT },
                                    left: { style: BorderStyle.SINGLE, size: 6, color: COLOR_ACCENT },
                                    right: { style: BorderStyle.SINGLE, size: 6, color: COLOR_ACCENT }
                                },
                                width: { size: tableWidth, type: WidthType.DXA },
                                shading: { fill: "F4F8FC", type: ShadingType.CLEAR },
                                margins: { top: 100, bottom: 100, left: 100, right: 100 },
                                children: [
                                    new Paragraph({
                                        spacing: { before: 0, after: 80 },
                                        children: [
                                            new TextRun({ text: "📷 ", size: 20, color: COLOR_PRIMARY, font: FONT }),
                                            new TextRun({ text: label, bold: true, size: 20, color: COLOR_PRIMARY, font: FONT })
                                        ]
                                    }),
                                    new Paragraph({
                                        alignment: AlignmentType.CENTER,
                                        spacing: { before: 0, after: 0 },
                                        children: [
                                            new ImageRun({
                                                data: photo.data,
                                                transformation: { width: drawW, height: drawH },
                                                type: photo.type
                                            })
                                        ]
                                    })
                                ]
                            })
                        ]
                    })
                ]
            });
        }

        // HEADER
        function makeRepeatingHeader() {
            return new Header({
                children: [
                    new Table({
                        width: { size: 9360, type: WidthType.DXA },
                        columnWidths: [4680, 4680],
                        borders: noBorders,
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({
                                        borders: noBorders,
                                        width: { size: 4680, type: WidthType.DXA },
                                        margins: { top: 0, bottom: 0, left: 0, right: 0 },
                                        verticalAlign: VerticalAlign.CENTER,
                                        children: [
                                            new Paragraph({
                                                alignment: AlignmentType.LEFT,
                                                spacing: { before: 0, after: 0 },
                                                children: [
                                                    new ImageRun({
                                                        data: b64ToUint8Array(LOGO_IPKONEKT_B64),
                                                        transformation: { width: 56, height: 50 },
                                                        type: "png"
                                                    })
                                                ]
                                            })
                                        ]
                                    }),
                                    new TableCell({
                                        borders: noBorders,
                                        width: { size: 4680, type: WidthType.DXA },
                                        margins: { top: 0, bottom: 0, left: 0, right: 0 },
                                        verticalAlign: VerticalAlign.CENTER,
                                        children: [
                                            new Paragraph({
                                                alignment: AlignmentType.RIGHT,
                                                spacing: { before: 0, after: 0 },
                                                children: [
                                                    new ImageRun({
                                                        data: b64ToUint8Array(LOGO_BOUYGUES_B64),
                                                        transformation: { width: 56, height: 56 },
                                                        type: "png"
                                                    })
                                                ]
                                            })
                                        ]
                                    })
                                ]
                            })
                        ]
                    })
                ]
            });
        }

        // FOOTER
        function makeRepeatingFooter() {
            return new Footer({
                children: [
                    new Paragraph({
                        alignment: AlignmentType.LEFT,
                        children: [
                            new TextRun({
                                text: "Document confidentiel — Usage interne IPKONEKT / Bouygues Telecom",
                                italics: true,
                                size: 16,
                                color: COLOR_GREY_FOOTER,
                                font: FONT
                            })
                        ]
                    })
                ]
            });
        }

        // Bandeau titre
        function makeTitleBanner() {
            return new Table({
                width: { size: 9360, type: WidthType.DXA },
                columnWidths: [9360],
                rows: [
                    new TableRow({
                        children: [
                            new TableCell({
                                borders: {
                                    top: { style: BorderStyle.SINGLE, size: 8, color: COLOR_HEADER_BG },
                                    bottom: { style: BorderStyle.SINGLE, size: 8, color: COLOR_HEADER_BG },
                                    left: { style: BorderStyle.SINGLE, size: 8, color: COLOR_HEADER_BG },
                                    right: { style: BorderStyle.SINGLE, size: 8, color: COLOR_HEADER_BG }
                                },
                                width: { size: 9360, type: WidthType.DXA },
                                shading: { fill: COLOR_HEADER_BG, type: ShadingType.CLEAR },
                                margins: { top: 200, bottom: 200, left: 120, right: 120 },
                                children: [
                                    new Paragraph({
                                        alignment: AlignmentType.CENTER,
                                        children: [
                                            new TextRun({
                                                text: "RAPPORT D'AUDIT - INSTALLATION ANTENNE 4G/5G",
                                                bold: true,
                                                size: 32,
                                                color: "FFFFFF",
                                                font: FONT
                                            })
                                        ]
                                    }),
                                    new Paragraph({
                                        alignment: AlignmentType.CENTER,
                                        children: [
                                            new TextRun({
                                                text: "Bouygues Telecom | IPKONEKT",
                                                size: 22,
                                                color: "FFFFFF",
                                                font: FONT
                                            })
                                        ]
                                    })
                                ]
                            })
                        ]
                    })
                ]
            });
        }

        // ===== Construction du document =====
        const children = [];

        // Bandeau titre
        children.push(makeTitleBanner());
        children.push(emptyP());

        // En-tête du rapport
        const refTable = new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [3120, 3120, 3120],
            rows: [
                new TableRow({
                    tableHeader: true,
                    children: [
                        cell("Référence commande", { width: 3120, shading: COLOR_TABLE_HEADER, textOpts: { bold: true } }),
                        cell("Auditeur / Intervenant", { width: 3120, shading: COLOR_TABLE_HEADER, textOpts: { bold: true } }),
                        cell("Date d'audit", { width: 3120, shading: COLOR_TABLE_HEADER, textOpts: { bold: true } })
                    ]
                }),
                new TableRow({
                    children: [
                        cell(val("ref_commande"), { width: 3120 }),
                        cell(val("auditeur"), { width: 3120 }),
                        cell(formatDateFR(val("date_audit")), { width: 3120 })
                    ]
                })
            ]
        });
        children.push(refTable);
        children.push(emptyP());

        // SECTION 1
        children.push(sectionHeading("1", "Informations administratives du client"));
        const tableInfos = new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [3120, 1560, 1560, 3120],
            rows: [
                new TableRow({ children: [
                        cell("Raison sociale du site audité", { width: 3120, textOpts: { bold: true } }),
                        cell(val("raison_sociale"), { width: 6240, columnSpan: 3 })
                    ] }),
                new TableRow({ children: [
                        cell("Adresse", { width: 3120, textOpts: { bold: true } }),
                        cell(val("adresse"), { width: 6240, columnSpan: 3 })
                    ] }),
                new TableRow({ children: [
                        cell("Code postal", { width: 3120, textOpts: { bold: true } }),
                        cell("CP : " + val("code_postal"), { width: 1560 }),
                        cell("Ville", { width: 1560, shading: COLOR_TABLE_HEADER, textOpts: { bold: true } }),
                        cell(val("ville"), { width: 3120 })
                    ] }),
                new TableRow({ children: [
                        cell("Horaire d'ouverture du site", { width: 3120, textOpts: { bold: true } }),
                        cell(val("horaire"), { width: 6240, columnSpan: 3 })
                    ] }),
                new TableRow({ children: [
                        cell("Procédure d'accès", { width: 3120, textOpts: { bold: true } }),
                        cell(val("procedure_acces"), { width: 6240, columnSpan: 3 })
                    ] }),
                new TableRow({ children: [
                        cell("Téléphone du site", { width: 3120, textOpts: { bold: true } }),
                        cell(val("tel_site"), { width: 6240, columnSpan: 3 })
                    ] }),
                new TableRow({ children: [
                        cell("Nom du contact client sur site", { width: 3120, textOpts: { bold: true } }),
                        cell(val("contact_nom"), { width: 6240, columnSpan: 3 })
                    ] }),
                new TableRow({ children: [
                        cell("Fonction", { width: 3120, textOpts: { bold: true } }),
                        cell(val("contact_fonction"), { width: 6240, columnSpan: 3 })
                    ] }),
                new TableRow({ children: [
                        cell("Téléphone / Mail contact", { width: 3120, textOpts: { bold: true } }),
                        cell(val("contact_tel"), { width: 1560 }),
                        cell("Mail", { width: 1560, shading: COLOR_TABLE_HEADER, textOpts: { bold: true } }),
                        cell(val("contact_mail"), { width: 3120 })
                    ] })
            ]
        });
        children.push(tableInfos);
        children.push(emptyP());

        // SECTION 2
        children.push(sectionHeading("2", "Informations techniques client"));
        const tableTech = new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [3120, 6240],
            rows: [
                new TableRow({ children: [
                        cell("Le bâtiment est-il classé ?", { width: 3120, textOpts: { bold: true } }),
                        new TableCell({
                            borders,
                            width: { size: 6240, type: WidthType.DXA },
                            margins: { top: 80, bottom: 80, left: 120, right: 120 },
                            children: [checkboxParagraph([
                                { label: "Oui", checked: radioValue("classe") === "Oui" },
                                { label: "Non", checked: radioValue("classe") === "Non" }
                            ])]
                        })
                    ] }),
                new TableRow({ children: [
                        cell("Localisation de la baie informatique", { width: 3120, textOpts: { bold: true } }),
                        cell(val("localisation_baie"), { width: 6240 })
                    ] }),
                new TableRow({ children: [
                        cell("Nombre de prises électriques disponibles", { width: 3120, textOpts: { bold: true } }),
                        cell(val("nb_prises"), { width: 6240 })
                    ] }),
                new TableRow({ children: [
                        cell("Présence d'une prise RJ45 à l'emplacement optimal", { width: 3120, textOpts: { bold: true } }),
                        new TableCell({
                            borders,
                            width: { size: 6240, type: WidthType.DXA },
                            margins: { top: 80, bottom: 80, left: 120, right: 120 },
                            children: [checkboxParagraph([
                                { label: "Oui", checked: radioValue("rj45") === "Oui" },
                                { label: "Non", checked: radioValue("rj45") === "Non" }
                            ])]
                        })
                    ] }),
                new TableRow({ children: [
                        cell("Si non, devis desserte à prévoir", { width: 3120, textOpts: { bold: true } }),
                        new TableCell({
                            borders,
                            width: { size: 6240, type: WidthType.DXA },
                            margins: { top: 80, bottom: 80, left: 120, right: 120 },
                            children: [checkboxParagraph([
                                { label: "Oui", checked: radioValue("devis_desserte") === "Oui" },
                                { label: "Non", checked: radioValue("devis_desserte") === "Non" }
                            ])]
                        })
                    ] })
            ]
        });
        children.push(tableTech);
        children.push(emptyP());

        // SECTION 3 - Mesures
        children.push(sectionHeading("3", "Mesures radio 4G/5G"));
        children.push(P("Les tests sont réalisés avec l'application Network Cell Info Lite.", { size: 20, color: COLOR_TEXT }));
        children.push(P("3 points de mesures sont à réaliser (3 en 4G et 3 en 5G) :", { size: 20, color: COLOR_TEXT }));
        children.push(P("• Emplacement souhaité par le client", { size: 20, color: COLOR_TEXT }));
        children.push(P("• Emplacement préconisé par le technicien", { size: 20, color: COLOR_TEXT }));
        children.push(P("• À l'extérieur du bâtiment", { size: 20, color: COLOR_TEXT }));
        children.push(emptyP());

        // Tableaux de référence
        children.push(subHeading("Échelle de référence"));
        const refTableRSRP = new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [4680, 4680],
            rows: [
                new TableRow({ tableHeader: true, children: [
                        cell("RSRP (dBm)", { width: 4680, shading: COLOR_TABLE_HEADER, textOpts: { bold: true } }),
                        cell("Qualité", { width: 4680, shading: COLOR_TABLE_HEADER, textOpts: { bold: true } })
                    ] }),
                new TableRow({ children: [cell("≥ -75", { width: 4680 }), cell("Très bon", { width: 4680, textOpts: { color: "28a745", bold: true } })] }),
                new TableRow({ children: [cell("-76 à -90", { width: 4680 }), cell("Bon", { width: 4680, textOpts: { color: "007bff", bold: true } })] }),
                new TableRow({ children: [cell("-91 à -105", { width: 4680 }), cell("Moyen", { width: 4680, textOpts: { color: "fd7e14", bold: true } })] }),
                new TableRow({ children: [cell("-106 à -115", { width: 4680 }), cell("Faible", { width: 4680, textOpts: { color: "dc3545", bold: true } })] }),
                new TableRow({ children: [cell("< -115", { width: 4680 }), cell("Très mauvais", { width: 4680, textOpts: { color: "6c757d", bold: true } })] })
            ]
        });
        children.push(refTableRSRP);
        children.push(emptyP());

        const refTableRSRQ = new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [4680, 4680],
            rows: [
                new TableRow({ tableHeader: true, children: [
                        cell("RSRQ (dB)", { width: 4680, shading: COLOR_TABLE_HEADER, textOpts: { bold: true } }),
                        cell("Qualité", { width: 4680, shading: COLOR_TABLE_HEADER, textOpts: { bold: true } })
                    ] }),
                new TableRow({ children: [cell("-5 à -9", { width: 4680 }), cell("Très bon", { width: 4680, textOpts: { color: "28a745", bold: true } })] }),
                new TableRow({ children: [cell("-10 à -12", { width: 4680 }), cell("Moyen", { width: 4680, textOpts: { color: "fd7e14", bold: true } })] }),
                new TableRow({ children: [cell("≤ -13", { width: 4680 }), cell("Mauvais", { width: 4680, textOpts: { color: "dc3545", bold: true } })] })
            ]
        });
        children.push(refTableRSRQ);
        children.push(emptyP());

        const refTableSINR = new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [4680, 4680],
            rows: [
                new TableRow({ tableHeader: true, children: [
                        cell("SINR (dB)", { width: 4680, shading: COLOR_TABLE_HEADER, textOpts: { bold: true } }),
                        cell("Qualité", { width: 4680, shading: COLOR_TABLE_HEADER, textOpts: { bold: true } })
                    ] }),
                new TableRow({ children: [cell("≥ 20", { width: 4680 }), cell("Excellent", { width: 4680, textOpts: { color: "28a745", bold: true } })] }),
                new TableRow({ children: [cell("13 à 19", { width: 4680 }), cell("Bon", { width: 4680, textOpts: { color: "007bff", bold: true } })] }),
                new TableRow({ children: [cell("0 à 12", { width: 4680 }), cell("Faible", { width: 4680, textOpts: { color: "fd7e14", bold: true } })] }),
                new TableRow({ children: [cell("< 0", { width: 4680 }), cell("Très mauvais", { width: 4680, textOpts: { color: "dc3545", bold: true } })] })
            ]
        });
        children.push(refTableSINR);
        children.push(emptyP());

        // Points de mesure
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
            const phrase = group.dataset.analysisPhrase || "";

            children.push(subHeading(`Mesure ${num} — ${lieu}`));
            const tableMesure = new Table({
                width: { size: 9360, type: WidthType.DXA },
                columnWidths: [4680, 4680],
                rows: [
                    new TableRow({
                        tableHeader: true,
                        children: [
                            cell("Paramètre", { width: 4680, shading: COLOR_TABLE_HEADER, textOpts: { bold: true } }),
                            cell("Valeur", { width: 4680, shading: COLOR_TABLE_HEADER, textOpts: { bold: true } })
                        ]
                    }),
                    new TableRow({ children: [cell("RSRP (dBm)", { width: 4680 }), cell(rsrp || "—", { width: 4680 })] }),
                    new TableRow({ children: [cell("RSRQ (dB)", { width: 4680 }), cell(rsrq || "—", { width: 4680 })] }),
                    new TableRow({ children: [cell("SINR (dB)", { width: 4680 }), cell(sinr || "—", { width: 4680 })] }),
                    new TableRow({ children: [cell("Débit descendant (Mbps)", { width: 4680 }), cell(down || "—", { width: 4680 })] }),
                    new TableRow({ children: [cell("Débit montant (Mbps)", { width: 4680 }), cell(up || "—", { width: 4680 })] }),
                    new TableRow({ children: [cell("Bande", { width: 4680 }), cell(band || "—", { width: 4680 })] })
                ]
            });
            children.push(tableMesure);
            children.push(P("Analyse : " + analysis, { bold: true }));
            if (phrase) children.push(P(phrase, { italics: true }));
            children.push(emptyP());

            // Photo
            const key = `measure_${num}`;
            if (photoStore[key]) {
                const pb = makePhotoBlock(`Photo du point ${num}`, key, { tableWidth: 9360, width: 400, height: 260 });
                if (pb) children.push(pb, emptyP());
            }
        });

        // SECTION 4 - Plan d'évacuation
        children.push(sectionHeading("4", "Plan d'évacuation"));
        if (photoStore['evac_plan']) {
            const pb = makePhotoBlock("Plan d'évacuation", "evac_plan", { tableWidth: 9360, width: 500, height: 350 });
            if (pb) children.push(pb, emptyP());
            // Points sur le plan (liste)
            children.push(P("Points de mesure positionnés sur le plan :", { bold: true }));
            evacPoints.forEach((p, idx) => {
                const pointNum = p.pointId;
                const group = document.querySelector(`.measure-point-group[data-point="${pointNum}"]`);
                const lieu = group ? group.querySelector('.point-lieu').value : `Point ${pointNum}`;
                const analysis = group ? group.querySelector('.analysis-result').textContent : "";
                children.push(P(`• Point ${pointNum} — ${lieu} : ${analysis}`, { size: 18 }));
            });
        } else {
            children.push(P("Aucun plan d'évacuation importé.", { italics: true }));
        }
        children.push(emptyP());

        // SECTION 5 - Cheminement
        children.push(sectionHeading("5", "Cheminement câble / Installation"));
        const cheminementItems = document.querySelectorAll('.cheminement-item');
        if (cheminementItems.length === 0) {
            children.push(P("Aucune photo de cheminement ajoutée.", { italics: true }));
        } else {
            cheminementItems.forEach((item, idx) => {
                const key = `cheminement_${idx + 1}`;
                const comment = item.querySelector('.cheminement-comment').value || "";
                if (photoStore[key]) {
                    const pb = makePhotoBlock(`Cheminement ${idx + 1}`, key, { tableWidth: 9360, width: 450, height: 280 });
                    if (pb) children.push(pb);
                }
                if (comment) {
                    children.push(P("Commentaire : " + comment, { italics: true }));
                }
                children.push(emptyP());
            });
        }

        // SECTION 6 - Synthèse
        children.push(sectionHeading("6", "Synthèse de l'intervention"));
        const tableSynth = new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [3120, 6240],
            rows: [
                new TableRow({ children: [
                        cell("Heure de début d'intervention", { width: 3120, textOpts: { bold: true } }),
                        cell(val("heure_debut"), { width: 6240 })
                    ] }),
                new TableRow({ children: [
                        cell("Heure de fin d'intervention", { width: 3120, textOpts: { bold: true } }),
                        cell(val("heure_fin"), { width: 6240 })
                    ] }),
                new TableRow({ children: [
                        cell("Durée totale à prévoir", { width: 3120, textOpts: { bold: true } }),
                        cell(val("duree_totale"), { width: 6240 })
                    ] }),
                new TableRow({ children: [
                        cell("Nombre de techniciens", { width: 3120, textOpts: { bold: true } }),
                        cell(val("nb_techniciens"), { width: 6240 })
                    ] }),
                new TableRow({ children: [
                        cell("Nacelle à prévoir", { width: 3120, textOpts: { bold: true } }),
                        new TableCell({
                            borders,
                            width: { size: 6240, type: WidthType.DXA },
                            margins: { top: 80, bottom: 80, left: 120, right: 120 },
                            children: [checkboxParagraph([
                                { label: "Oui", checked: radioValue("nacelle_prevoir") === "Oui" },
                                { label: "Non", checked: radioValue("nacelle_prevoir") === "Non" }
                            ])]
                        })
                    ] }),
                new TableRow({ children: [
                        cell("Besoin d'une échelle", { width: 3120, textOpts: { bold: true } }),
                        new TableCell({
                            borders,
                            width: { size: 6240, type: WidthType.DXA },
                            margins: { top: 80, bottom: 80, left: 120, right: 120 },
                            children: [checkboxParagraph([
                                { label: "Oui", checked: radioValue("echelle_prevoir") === "Oui" },
                                { label: "Non", checked: radioValue("echelle_prevoir") === "Non" }
                            ])]
                        })
                    ] })
            ]
        });
        children.push(tableSynth);
        children.push(emptyP());

        // Observations
        const tableObs = new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [9360],
            rows: [
                new TableRow({ children: [
                        cell("Observations / Réserves / Points à lever", { width: 9360, shading: COLOR_TABLE_HEADER, textOpts: { bold: true } })
                    ] }),
                new TableRow({ children: [
                        new TableCell({
                            borders,
                            width: { size: 9360, type: WidthType.DXA },
                            margins: { top: 120, bottom: 1200, left: 120, right: 120 },
                            children: (val("observations") || "").split("\n").map(l => P(l))
                        })
                    ] })
            ]
        });
        children.push(tableObs);
        children.push(emptyP());

        // Signature
        const tableSig = new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [9360],
            rows: [
                new TableRow({ children: [
                        cell("Signature technicien / auditeur", { width: 9360, shading: COLOR_TABLE_HEADER, textOpts: { bold: true } })
                    ] }),
                new TableRow({ children: [
                        new TableCell({
                            borders,
                            width: { size: 9360, type: WidthType.DXA },
                            margins: { top: 200, bottom: 800, left: 120, right: 120 },
                            children: [
                                emptyP(),
                                P("Nom : " + (val("signataire_nom") || "_______________________________")),
                                emptyP(),
                                P("Date : " + (formatDateFR(val("signataire_date")) || "_______________________________"))
                            ]
                        })
                    ] })
            ]
        });
        children.push(tableSig);

        // ===== Document final =====
        const doc = new Document({
            styles: { default: { document: { run: { font: FONT, size: 20 } } } },
            sections: [{
                properties: {
                    page: {
                        size: { width: 11906, height: 16838 },
                        margin: { top: 1440, right: 1080, bottom: 1080, left: 1080, header: 360, footer: 360 }
                    }
                },
                headers: { default: makeRepeatingHeader() },
                footers: { default: makeRepeatingFooter() },
                children: children
            }]
        });

        const blob = await Packer.toBlob(doc);
        const filename = buildFilename();
        saveAs(blob, filename);
        showStatus("✅ Rapport généré : " + filename, "success");
    } catch (err) {
        console.error(err);
        showStatus("❌ Erreur lors de la génération : " + err.message, "error");
    }
}

// ============================================================
//  SOUS-ROUTINES POUR SECTIONS
// ============================================================
function sectionHeading(numText, titleText) {
    return new Paragraph({
        spacing: { before: 320, after: 160 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "#2e75b6", space: 4 } },
        tabStops: [{ type: TabStopType.LEFT, position: 360 }],
        children: [
            new TextRun({ text: `${numText}.`, bold: true, size: 26, color: "1F3864", font: "Calibri" }),
            new TextRun({ text: "\t", font: "Calibri" }),
            new TextRun({ text: titleText, bold: true, size: 26, color: "1F3864", font: "Calibri" })
        ]
    });
}

function subHeading(text) {
    return new Paragraph({
        spacing: { before: 200, after: 100 },
        children: [
            new TextRun({ text: text, bold: true, italics: true, size: 22, color: "#2e75b6", font: "Calibri" })
        ]
    });
}