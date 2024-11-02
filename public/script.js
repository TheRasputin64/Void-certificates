let textPosition = { x: 0, y: 0 };
let templateFile = null;
let isDragging = false;
let startX;
let startY;
let dragStartX;
let dragStartY;
let currentZoom = 1;

let textOverlay;
let previewArea;
let templateInput;
let preview;
let fileUpload;
let namesTextarea;
let fontFamilySelect;
let fontSizeInput;
let posXInput;
let posYInput;
let textColorInput;
let shadowToggle;
let shadowColorInput;
let shadowBlurInput;
let qualityInput;
let useNumbersInput;
let boldToggle;
let italicToggle;
let underlineToggle;

function init() {
    initializeElements();
    loadSavedSettings();
    initializeEventListeners();
    updateTextAndCount();
    initializeColorPresets();
}

function initializeElements() {
    textOverlay = document.getElementById('textOverlay');
    previewArea = document.getElementById('previewArea');
    templateInput = document.getElementById('template');
    namesTextarea = document.getElementById('names');
    fontFamilySelect = document.getElementById('fontFamily');
    fontSizeInput = document.getElementById('fontSize');
    posXInput = document.getElementById('posX');
    posYInput = document.getElementById('posY');
    preview = document.getElementById('preview');
    textColorInput = document.getElementById('textColor');
    shadowToggle = document.getElementById('shadowToggle');
    shadowColorInput = document.getElementById('shadowColor');
    shadowBlurInput = document.getElementById('shadowBlur');
    qualityInput = document.getElementById('quality');
    useNumbersInput = document.getElementById('useNumbers');
    boldToggle = document.getElementById('boldToggle');
    italicToggle = document.getElementById('italicToggle');
    underlineToggle = document.getElementById('underlineToggle');
    fileUpload = document.querySelector('.file-upload');
}

function loadSavedSettings() {
    const savedSettings = {
        position: JSON.parse(localStorage.getItem('textPosition')) || { x: 0, y: 0 },
        fontSize: localStorage.getItem('fontSize') || '48',
        fontFamily: localStorage.getItem('fontFamily'),
        textColor: localStorage.getItem('textColor') || '#000000',
        shadowEnabled: localStorage.getItem('shadowEnabled') === 'true',
        shadowColor: localStorage.getItem('shadowColor') || '#000000',
        shadowBlur: localStorage.getItem('shadowBlur') || '2',
        quality: localStorage.getItem('quality') || '80'
    };

    textPosition = savedSettings.position;
    updateTextPosition();
    fontSizeInput.value = savedSettings.fontSize;
    fontFamilySelect.value = savedSettings.fontFamily || fontFamilySelect.options[0].value;
    textColorInput.value = savedSettings.textColor;
    shadowToggle.checked = savedSettings.shadowEnabled;
    shadowColorInput.value = savedSettings.shadowColor;
    shadowBlurInput.value = savedSettings.shadowBlur;
    qualityInput.value = savedSettings.quality;
    updateStyle();
}

function initializeEventListeners() {
    textOverlay.addEventListener('mousedown', startDragging);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDragging);
    textOverlay.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', stopDragging);
    fontFamilySelect.addEventListener('change', updateStyleAndSave);
    fontSizeInput.addEventListener('input', updateStyleAndSave);
    textColorInput.addEventListener('input', updateStyleAndSave);
    shadowToggle.addEventListener('change', updateStyleAndSave);
    shadowColorInput.addEventListener('input', updateStyleAndSave);
    shadowBlurInput.addEventListener('input', updateStyleAndSave);
    posXInput.addEventListener('input', updateFromInputs);
    posYInput.addEventListener('input', updateFromInputs);
    templateInput.addEventListener('change', handleTemplateUpload);
    namesTextarea.addEventListener('input', updateTextAndCount);
    qualityInput.addEventListener('input', updateQualityValue);
    boldToggle.addEventListener('click', () => toggleStyle('bold'));
    italicToggle.addEventListener('click', () => toggleStyle('italic'));
    underlineToggle.addEventListener('click', () => toggleStyle('underline'));
    document.getElementById('zoomIn').addEventListener('click', () => adjustZoom(0.1));
    document.getElementById('zoomOut').addEventListener('click', () => adjustZoom(-0.1));
    document.getElementById('zoomReset').addEventListener('click', resetZoom);
    
    document.querySelectorAll('.position-preset').forEach(button => {
        button.addEventListener('click', () => setPosition(button.dataset.position));
    });

    fileUpload.addEventListener('click', e => {
        e.stopPropagation();
        templateInput.click();
    });

    fileUpload.addEventListener('dragenter', handleDragEvent);
    fileUpload.addEventListener('dragover', handleDragEvent);
    fileUpload.addEventListener('dragleave', handleDragEvent);
    fileUpload.addEventListener('drop', handleTemplateDrop);
}

function handleDragEvent(e) {
    e.preventDefault();
    e.stopPropagation();
    fileUpload.classList.toggle('drag-over', e.type === 'dragenter' || e.type === 'dragover');
}

function initializeColorPresets() {
    document.querySelectorAll('.color-preset').forEach(preset => {
        preset.addEventListener('click', () => {
            textColorInput.value = preset.dataset.color;
            updateStyleAndSave();
        });
    });
}

function updateFromInputs() {
    textPosition.x = parseInt(posXInput.value) || 0;
    textPosition.y = parseInt(posYInput.value) || 0;
    updateTextPosition();
    saveSettings();
}

function updateStyleAndSave() {
    updateStyle();
    saveSettings();
}

function saveSettings() {
    localStorage.setItem('textPosition', JSON.stringify(textPosition));
    localStorage.setItem('fontSize', fontSizeInput.value);
    localStorage.setItem('fontFamily', fontFamilySelect.value);
    localStorage.setItem('textColor', textColorInput.value);
    localStorage.setItem('shadowEnabled', shadowToggle.checked);
    localStorage.setItem('shadowColor', shadowColorInput.value);
    localStorage.setItem('shadowBlur', shadowBlurInput.value);
    localStorage.setItem('quality', qualityInput.value);
}

function updateStyle() {
    const prevWidth = textOverlay.offsetWidth;
    const prevHeight = textOverlay.offsetHeight;
    
    textOverlay.style.fontFamily = fontFamilySelect.value;
    textOverlay.style.fontSize = `${fontSizeInput.value}px`;
    textOverlay.style.color = textColorInput.value;
    
    if (shadowToggle.checked) {
        const blur = shadowBlurInput.value;
        textOverlay.style.textShadow = `${shadowColorInput.value} ${blur}px ${blur}px ${blur}px`;
    } else {
        textOverlay.style.textShadow = 'none';
    }
    
    document.getElementById('fontSizeValue').textContent = `${fontSizeInput.value}px`;
    document.getElementById('qualityValue').textContent = `${qualityInput.value}%`;
    
    const widthDiff = textOverlay.offsetWidth - prevWidth;
    const heightDiff = textOverlay.offsetHeight - prevHeight;
    textPosition.x -= widthDiff / 2;
    textPosition.y -= heightDiff / 2;
    updateTextPosition();
}

function toggleStyle(style) {
    const button = document.getElementById(`${style}Toggle`);
    button.classList.toggle('active');
    textOverlay.style[style === 'bold' ? 'fontWeight' : style === 'italic' ? 'fontStyle' : 'textDecoration'] = 
        button.classList.contains('active') ? (style === 'underline' ? style : 'bold') : 'normal';
}

function updateTextPosition() {
    textOverlay.style.transform = `translate(${textPosition.x}px, ${textPosition.y}px) scale(${currentZoom})`;
    posXInput.value = Math.round(textPosition.x);
    posYInput.value = Math.round(textPosition.y);
}

function handleTemplateUpload(e) {
    const file = e.target.files[0];
    if (file) validateAndProcessTemplate(file);
}

function handleTemplateDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    fileUpload.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) validateAndProcessTemplate(file);
}

function validateAndProcessTemplate(file) {
    if (!file.type.startsWith('image/')) {
        alert('Please upload an image file (PNG, JPG, etc.)');
        return;
    }

    templateFile = file;
    const reader = new FileReader();
    reader.onload = e => {
        preview.src = e.target.result;
        updateTemplateInfo(file);
        centerText();
        resetZoom();
        previewArea.style.display = 'block';
        fileUpload.style.display = 'block';
        updatePreviewGrid();
    };
    reader.readAsDataURL(file);
}

function updateTemplateInfo(file) {
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = `${(file.size / 1024).toFixed(2)} KB`;
    document.getElementById('dimensions').textContent = `${preview.naturalWidth} x ${preview.naturalHeight}`;
}

function updateTextAndCount() {
    const names = namesTextarea.value.split('\n').filter(n => n.trim());
    document.getElementById('namesCount').textContent = names.length;
    const avgSize = templateFile ? templateFile.size / 1024 : 150;
    document.getElementById('archiveSize').textContent = `${((names.length * avgSize) / 1024).toFixed(2)} MB`;
    textOverlay.textContent = names[0]?.trim() || 'Sample Name';
    updatePreviewGrid();
}

function updatePreviewGrid() {
    const previewGrid = document.getElementById('previewGrid');
    const names = namesTextarea.value.split('\n').filter(n => n.trim());
    
    previewGrid.innerHTML = '';
    names.slice(0, 6).forEach(name => {
        const preview = document.createElement('div');
        preview.className = 'preview-item';
        preview.textContent = name;
        previewGrid.appendChild(preview);
    });
}

function centerText() {
    textPosition = { x: 0, y: 0 };
    updateTextPosition();
}

function updateQualityValue() {
    document.getElementById('qualityValue').textContent = `${qualityInput.value}%`;
}

function adjustZoom(delta) {
    currentZoom = Math.max(0.1, Math.min(3, currentZoom + delta));
    updateTextPosition();
}

function resetZoom() {
    currentZoom = 1;
    updateTextPosition();
}

function setPosition(preset) {
    switch (preset) {
        case 'top':
            textPosition = { x: 0, y: -350 };
            break;
        case 'center':
            textPosition = { x: 0, y: 0 };
            break;
        case 'bottom':
            textPosition = { x: 0, y: 350 };
            break;
    }
    updateTextPosition();
    saveSettings();
}

function startDragging(e) {
    if (e.target !== textOverlay) return;
    e.preventDefault();
    isDragging = true;
    [dragStartX, dragStartY] = e.type === 'touchstart' ? 
        [e.touches[0].clientX, e.touches[0].clientY] : 
        [e.clientX, e.clientY];
    [startX, startY] = [textPosition.x, textPosition.y];
}

function handleTouchStart(e) {
    startDragging(e);
}

function handleTouchMove(e) {
    e.preventDefault();
    if (isDragging) drag(e.touches[0]);
}

function drag(e) {
    if (!isDragging) return;
    e.preventDefault();
    const [clientX, clientY] = e.touches ? 
        [e.touches[0].clientX, e.touches[0].clientY] : 
        [e.clientX, e.clientY];
    textPosition.x = Math.min(Math.max(-1000, startX + clientX - dragStartX), 1000);
    textPosition.y = Math.min(Math.max(-1000, startY + clientY - dragStartY), 1000);
    updateTextPosition();
}

function stopDragging() {
    if (isDragging) {
        isDragging = false;
        saveSettings();
    }
}

async function generateCertificates() {
    if (!templateFile) {
        alert('Please select a template first');
        return;
    }
    
    const names = namesTextarea.value.split('\n').filter(n => n.trim());
    if (!names.length) {
        alert('Please enter at least one name');
        return;
    }

    const formData = new FormData();
    formData.append('template', templateFile);
    formData.append('names', JSON.stringify(names));
    formData.append('textPosition', JSON.stringify({
        x: textPosition.x,
        y: textPosition.y - 10
    }));
    formData.append('fontSize', fontSizeInput.value);
    formData.append('fontFamily', fontFamilySelect.value);
    formData.append('textColor', textColorInput.value);
    formData.append('shadowEnabled', shadowToggle.checked);
    formData.append('shadowColor', shadowColorInput.value);
    formData.append('shadowBlur', shadowBlurInput.value);
    formData.append('useNumbers', useNumbersInput.checked);
    formData.append('quality', qualityInput.value);
    
    const btn = document.querySelector('.generate-btn');
    btn.disabled = true;
    btn.textContent = 'Generating...';
    
    try {
        const response = await fetch('/generate', {
            method: 'POST',
            body: formData
        });
        if (!response.ok) throw new Error(await response.text());
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'certificates.zip';
        a.click();
        URL.revokeObjectURL(url);
    } catch (error) {
        alert(`Error generating certificates: ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Generate Certificates';
    }
}

init();