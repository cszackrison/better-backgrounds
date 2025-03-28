const imageLoader = document.getElementById('imageLoader');
const canvas = document.getElementById('imageCanvas');
const ctx = canvas.getContext('2d');
// Background blur now handled directly in canvas

// Image alignment positions
const alignmentPositions = {
	'top-left': { x: 0, y: 0 },
	'top': { x: 0.5, y: 0 },
	'top-right': { x: 1, y: 0 },
	'left': { x: 0, y: 0.5 },
	'center': { x: 0.5, y: 0.5 },
	'right': { x: 1, y: 0.5 },
	'bottom-left': { x: 0, y: 1 },
	'bottom': { x: 0.5, y: 1 },
	'bottom-right': { x: 1, y: 1 }
};
const canvasWidthInput = document.getElementById('canvasWidth');
const canvasHeightInput = document.getElementById('canvasHeight');
const saveButton = document.getElementById('saveButton');
const canvasContainer = document.querySelector('.canvas-container');
const blurAmountInput = document.getElementById('blurAmount');
const blurValueSpan = document.getElementById('blurValue');
const bgColorInput = document.getElementById('bgColor');
const sizePresetSelect = document.getElementById('sizePreset');

let currentImage = null;
let imageX = 0, imageY = 0;
let drawnWidth = 0, drawnHeight = 0;
let scale = 1;
let currentImageSrc = null;

let isDragging = false, isResizing = false;
let activeHandle = null;
const handleSize = 10;
let startX, startY, resizeStartX, resizeStartY;
let initialImageX, initialImageY, initialDrawnWidth, initialDrawnHeight;

const snapThreshold = 10;

function initializeCanvas() {
    const width = parseInt(canvasWidthInput.value, 10);
    const height = parseInt(canvasHeightInput.value, 10);

    canvas.width = width;
    canvas.height = height;
    canvasContainer.style.width = `${width}px`;
    canvasContainer.style.height = `${height}px`;

    if (currentImage) {
        // Maintain current alignment when canvas size changes
        const activeBtn = document.querySelector('.align-btn.active');
        const position = activeBtn ? activeBtn.dataset.align : 'center';
        alignImage(position);
    } else {
        draw();
    }
}

function centerImage() {
    alignImage('center');
}

function alignImage(position = 'center') {
    if (!currentImage) return;
    
    // Update active button
    document.querySelectorAll('.align-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.align === position) {
            btn.classList.add('active');
        }
    });
    
    // Calculate image size while maintaining aspect ratio
    const canvasAspect = canvas.width / canvas.height;
    const imageAspect = currentImage.naturalWidth / currentImage.naturalHeight;
    const margin = 0.9;

    if (imageAspect > canvasAspect) {
        drawnWidth = canvas.width * margin;
        scale = drawnWidth / currentImage.naturalWidth;
        drawnHeight = currentImage.naturalHeight * scale;
    } else {
        drawnHeight = canvas.height * margin;
        scale = drawnHeight / currentImage.naturalHeight;
        drawnWidth = currentImage.naturalWidth * scale;
    }
    
    // Get position coordinates
    const alignment = alignmentPositions[position] || alignmentPositions.center;
    
    // Calculate position based on alignment
    imageX = (canvas.width - drawnWidth) * alignment.x;
    imageY = (canvas.height - drawnHeight) * alignment.y;
    
    draw();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background color
    ctx.fillStyle = bgColorInput.value;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (currentImage && currentImageSrc) {
        // Draw background with blur
        const blurValue = blurAmountInput.value;
        if (blurValue > 0) {
            const imgAspect = currentImage.naturalWidth / currentImage.naturalHeight;
            const canvasAspect = canvas.width / canvas.height;
            let bgWidth, bgHeight;

            if (imgAspect > canvasAspect) {
                bgHeight = canvas.height;
                bgWidth = bgHeight * imgAspect;
            } else {
                bgWidth = canvas.width;
                bgHeight = bgWidth / imgAspect;
            }

            const drawnCenterX = imageX + drawnWidth / 2;
            const drawnCenterY = imageY + drawnHeight / 2;
            let normX = drawnCenterX / canvas.width;
            let normY = drawnCenterY / canvas.height;
            normX = Math.max(0, Math.min(1, normX));
            normY = Math.max(0, Math.min(1, normY));

            const bgX = (canvas.width - bgWidth) * normX;
            const bgY = (canvas.height - bgHeight) * normY;

            // Apply blur effect
            ctx.filter = `blur(${blurValue}px)`;
            ctx.drawImage(
                currentImage,
                bgX, bgY,
                bgWidth, bgHeight
            );
            ctx.filter = 'none';
        }

        // Draw foreground image
        ctx.drawImage(currentImage, Math.round(imageX), Math.round(imageY), Math.round(drawnWidth), Math.round(drawnHeight));
        drawHandles();

    } else {
        ctx.fillStyle = "#999";
        ctx.textAlign = "center";
        ctx.font = "16px sans-serif";
        ctx.fillText("Upload an image", canvas.width / 2, canvas.height / 2);
    }
}

function drawHandles() {
    if (!currentImage) return;
    const halfHandle = handleSize / 2;
    ctx.fillStyle = 'rgba(0, 123, 255, 0.8)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1;
    const handles = getHandlePositions();
    for (const corner in handles) {
        const pos = handles[corner];
        const drawX = Math.max(halfHandle, Math.min(canvas.width - halfHandle, pos.x));
        const drawY = Math.max(halfHandle, Math.min(canvas.height - halfHandle, pos.y));
        ctx.fillRect(drawX - halfHandle, drawY - halfHandle, handleSize, handleSize);
        ctx.strokeRect(drawX - halfHandle, drawY - halfHandle, handleSize, handleSize);
    }
}

function getHandlePositions() {
    const x = Math.round(imageX);
    const y = Math.round(imageY);
    const w = Math.round(drawnWidth);
    const h = Math.round(drawnHeight);
    return { tl: { x: x, y: y }, tr: { x: x + w, y: y }, bl: { x: x, y: y + h }, br: { x: x + w, y: y + h } };
}

imageLoader.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) { alert('Please select a valid image file.'); event.target.value = null; return; }
    const reader = new FileReader();
    reader.onload = (e) => {
        currentImageSrc = e.target.result;
        const img = new Image();
        img.onload = () => { 
            currentImage = img; 
            
            // Get the active alignment or default to center
            const activeBtn = document.querySelector('.align-btn.active');
            const position = activeBtn ? activeBtn.dataset.align : 'center';
            alignImage(position);
        };
        img.onerror = () => { alert('Failed to load image.'); currentImage = null; currentImageSrc = null; draw(); }
        img.src = currentImageSrc;
    };
    reader.onerror = () => { alert('Failed to read file.'); currentImage = null; currentImageSrc = null; draw(); }
    reader.readAsDataURL(file);
    event.target.value = null;
});

canvasWidthInput.addEventListener('change', () => { sizePresetSelect.value = ""; initializeCanvas(); });
canvasHeightInput.addEventListener('change', () => { sizePresetSelect.value = ""; initializeCanvas(); });

function updateBlurValue() {
    const value = blurAmountInput.value;
    blurValueSpan.textContent = `${value}px`;
    draw(); // Redraw with new blur value
}

blurAmountInput.addEventListener('input', updateBlurValue);
bgColorInput.addEventListener('input', draw); // Redraw when background color changes

sizePresetSelect.addEventListener('change', (event) => {
    const value = event.target.value; if (!value || value === 'separator') return;
    let newWidth = parseInt(canvasWidthInput.value, 10), newHeight = parseInt(canvasHeightInput.value, 10);
    if (value.startsWith('aspect_')) { const parts = value.split('_'), ratioX = parseInt(parts[1], 10), ratioY = parseInt(parts[2], 10); newHeight = Math.round(newWidth / (ratioX / ratioY));
    } else { const dims = value.split('x'); newWidth = parseInt(dims[0], 10); newHeight = parseInt(dims[1], 10); }
    if (newWidth >= 50 && newHeight >= 50) { canvasWidthInput.value = newWidth; canvasHeightInput.value = newHeight; initializeCanvas(); } else { console.warn("Preset resulted in invalid dimensions."); event.target.value = ""; }
});

function getMousePos(event) { const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }

function getHandleUnderMouse(pos) { if (!currentImage) return null; const handles = getHandlePositions(); const tolerance = handleSize * 1.5; for (const corner in handles) { const handlePos = handles[corner]; if ( pos.x >= handlePos.x - tolerance / 2 && pos.x <= handlePos.x + tolerance / 2 && pos.y >= handlePos.y - tolerance / 2 && pos.y <= handlePos.y + tolerance / 2 ) { return corner; } } return null; }

canvas.addEventListener('mousedown', (e) => { if (!currentImage) return; const mousePos = getMousePos(e); activeHandle = getHandleUnderMouse(mousePos); if (activeHandle) { isResizing = true; isDragging = false; canvas.style.cursor = (activeHandle === 'tl' || activeHandle === 'br') ? 'nwse-resize' : 'nesw-resize'; resizeStartX = mousePos.x; resizeStartY = mousePos.y; initialImageX = imageX; initialImageY = imageY; initialDrawnWidth = drawnWidth; initialDrawnHeight = drawnHeight; } else { if (mousePos.x >= imageX && mousePos.x <= imageX + drawnWidth && mousePos.y >= imageY && mousePos.y <= imageY + drawnHeight) { isDragging = true; isResizing = false; startX = mousePos.x - imageX; startY = mousePos.y - imageY; canvas.classList.add('grabbing'); canvas.style.cursor = 'grabbing'; } } });

canvas.addEventListener('mousemove', (e) => {
    if (!currentImage) return;
    const mousePos = getMousePos(e);

    if (isResizing && activeHandle) {
        const dx = mousePos.x - resizeStartX;
        const dy = mousePos.y - resizeStartY;
        const aspect = currentImage.naturalWidth / currentImage.naturalHeight;

        let rawWidth = initialDrawnWidth;
        let rawHeight = initialDrawnHeight;
        let rawX = initialImageX;
        let rawY = initialImageY;

        switch (activeHandle) {
             case 'br': rawWidth = Math.max(handleSize, initialDrawnWidth + dx); rawHeight = rawWidth / aspect; break;
             case 'bl': rawWidth = Math.max(handleSize, initialDrawnWidth - dx); rawHeight = rawWidth / aspect; rawX = initialImageX + (initialDrawnWidth - rawWidth); break;
             case 'tr': rawWidth = Math.max(handleSize, initialDrawnWidth + dx); rawHeight = rawWidth / aspect; rawY = initialImageY + (initialDrawnHeight - rawHeight); break;
             case 'tl': rawWidth = Math.max(handleSize, initialDrawnWidth - dx); rawHeight = rawWidth / aspect; rawX = initialImageX + (initialDrawnWidth - rawWidth); rawY = initialImageY + (initialDrawnHeight - rawHeight); break;
        }

        let snappedX = rawX, snappedY = rawY, snappedWidth = rawWidth, snappedHeight = rawHeight;
        let didSnap = false;

        if (activeHandle === 'tl' || activeHandle === 'bl') {
            if (Math.abs(rawX) < snapThreshold) {
                snappedX = 0;
                snappedWidth = initialDrawnWidth + initialImageX;
                snappedHeight = snappedWidth / aspect;
                if (activeHandle === 'tl') {
                    snappedY = initialImageY + initialDrawnHeight - snappedHeight;
                } else {
                    snappedY = initialImageY;
                }
                didSnap = true;
            }
        }

        if (activeHandle === 'tr' || activeHandle === 'br') {
            if (Math.abs((rawX + rawWidth) - canvas.width) < snapThreshold) {
                snappedWidth = canvas.width - rawX;
                snappedHeight = snappedWidth / aspect;
                snappedX = rawX;
                if (activeHandle === 'tr') {
                    snappedY = initialImageY + initialDrawnHeight - snappedHeight;
                } else {
                    snappedY = initialImageY;
                }
                didSnap = true;
            }
        }

        if (activeHandle === 'tl' || activeHandle === 'tr') {
            if (Math.abs(rawY) < snapThreshold && !didSnap) {
                snappedY = 0;
                snappedHeight = initialDrawnHeight + initialImageY;
                snappedWidth = snappedHeight * aspect;
                if (activeHandle === 'tl') {
                    snappedX = initialImageX + initialDrawnWidth - snappedWidth;
                } else {
                    snappedX = initialImageX;
                }
                didSnap = true;
            }
        }

        if (activeHandle === 'bl' || activeHandle === 'br') {
            if (Math.abs((rawY + rawHeight) - canvas.height) < snapThreshold && !didSnap) {
                snappedHeight = canvas.height - rawY;
                snappedWidth = snappedHeight * aspect;
                snappedY = rawY;
                if (activeHandle === 'bl') {
                    snappedX = initialImageX + initialDrawnWidth - snappedWidth;
                } else {
                    snappedX = initialImageX;
                }
                didSnap = true;
            }
        }

        if (didSnap) {
            imageX = snappedX;
            imageY = snappedY;
            drawnWidth = snappedWidth;
            drawnHeight = snappedHeight;
        } else {
            imageX = rawX;
            imageY = rawY;
            drawnWidth = rawWidth;
            drawnHeight = rawHeight;
        }

        drawnWidth = Math.max(handleSize, drawnWidth);
        drawnHeight = Math.max(handleSize, drawnHeight);
        scale = drawnWidth / currentImage.naturalWidth;

        draw();
    } else if (isDragging) {
        let targetX = mousePos.x - startX;
        let targetY = mousePos.y - startY;
        if (Math.abs(targetX) < snapThreshold) targetX = 0;
        if (Math.abs((targetX + drawnWidth) - canvas.width) < snapThreshold) targetX = canvas.width - drawnWidth;
        if (Math.abs(targetY) < snapThreshold) targetY = 0;
        if (Math.abs((targetY + drawnHeight) - canvas.height) < snapThreshold) targetY = canvas.height - drawnHeight;
        imageX = targetX; imageY = targetY;
        draw();
    } else {
        const handle = getHandleUnderMouse(mousePos); if (handle) { canvas.style.cursor = (handle === 'tl' || handle === 'br') ? 'nwse-resize' : 'nesw-resize'; } else if (mousePos.x >= imageX && mousePos.x <= imageX + drawnWidth && mousePos.y >= imageY && mousePos.y <= imageY + drawnHeight) { canvas.style.cursor = 'grab'; } else { canvas.style.cursor = 'default'; }
    }
});

canvas.addEventListener('mouseup', (e) => { if (isDragging || isResizing) { isDragging = false; isResizing = false; activeHandle = null; canvas.classList.remove('grabbing'); const currentMousePos = getMousePos(e); const hoverHandle = getHandleUnderMouse(currentMousePos); if (hoverHandle) { canvas.style.cursor = (hoverHandle === 'tl' || hoverHandle === 'br') ? 'nwse-resize' : 'nesw-resize'; } else if (currentMousePos.x >= imageX && currentMousePos.x <= imageX + drawnWidth && currentMousePos.y >= imageY && currentMousePos.y <= imageY + drawnHeight) { canvas.style.cursor = 'grab'; } else { canvas.style.cursor = 'default'; } } });

canvas.addEventListener('mouseleave', () => { if (isDragging || isResizing) { isDragging = false; isResizing = false; activeHandle = null; canvas.classList.remove('grabbing'); } canvas.style.cursor = 'default'; });

function saveImage() {
    if (!currentImage) {
        alert("Please upload an image first.");
        return;
    }

    try {
        // Create a temporary canvas without resize handles
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        
        // Draw background color
        tempCtx.fillStyle = bgColorInput.value;
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Draw background with blur if applicable
        if (currentImage && currentImageSrc) {
            const blurValue = blurAmountInput.value;
            if (blurValue > 0) {
                const imgAspect = currentImage.naturalWidth / currentImage.naturalHeight;
                const canvasAspect = tempCanvas.width / tempCanvas.height;
                let bgWidth, bgHeight;
    
                if (imgAspect > canvasAspect) {
                    bgHeight = tempCanvas.height;
                    bgWidth = bgHeight * imgAspect;
                } else {
                    bgWidth = tempCanvas.width;
                    bgHeight = bgWidth / imgAspect;
                }
    
                const drawnCenterX = imageX + drawnWidth / 2;
                const drawnCenterY = imageY + drawnHeight / 2;
                let normX = drawnCenterX / canvas.width;
                let normY = drawnCenterY / canvas.height;
                normX = Math.max(0, Math.min(1, normX));
                normY = Math.max(0, Math.min(1, normY));
    
                const bgX = (tempCanvas.width - bgWidth) * normX;
                const bgY = (tempCanvas.height - bgHeight) * normY;
    
                // Apply blur effect
                tempCtx.filter = `blur(${blurValue}px)`;
                tempCtx.drawImage(
                    currentImage,
                    bgX, bgY,
                    bgWidth, bgHeight
                );
                tempCtx.filter = 'none';
            }
    
            // Draw foreground image without handles
            tempCtx.drawImage(currentImage, Math.round(imageX), Math.round(imageY), Math.round(drawnWidth), Math.round(drawnHeight));
        }
        
        // Create download link
        const dataUrl = tempCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'canvas-image.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error("Error during saving:", error);
        if (error instanceof SecurityError && error.message.includes("tainted")) {
             alert("Could not save the image due to security restrictions (cross-origin image). Please upload from your device.");
        } else {
             alert("Could not save the image. Error: " + error.message);
        }
    }
}

saveButton.addEventListener('click', saveImage);

const controlsPanel = document.querySelector('.controls');
let isDraggingControls = false;
let controlsStartX, controlsStartY;
let controlsInitialLeft, controlsInitialTop;

controlsPanel.addEventListener('mousedown', (e) => {
	if (e.button !== 0) return;
	
	if (e.target === controlsPanel || e.target.tagName === 'DIV' && e.target.parentNode === controlsPanel) {
		isDraggingControls = true;
		controlsStartX = e.clientX;
		controlsStartY = e.clientY;
		
		const rect = controlsPanel.getBoundingClientRect();
		controlsInitialLeft = window.innerWidth - rect.right;
		controlsInitialTop = rect.top;
		
		e.preventDefault();
	}
});

document.addEventListener('mousemove', (e) => {
	if (isDraggingControls) {
		const dx = e.clientX - controlsStartX;
		const dy = e.clientY - controlsStartY;
		
		let newLeft = controlsInitialLeft - dx;
		let newTop = controlsInitialTop + dy;
		
		const rect = controlsPanel.getBoundingClientRect();
		
		if (newLeft < 0) newLeft = 0;
		if (newLeft > window.innerWidth - rect.width) newLeft = window.innerWidth - rect.width;
		if (newTop < 0) newTop = 0;
		if (newTop > window.innerHeight - rect.height) newTop = window.innerHeight - rect.height;
		
		controlsPanel.style.right = newLeft + 'px';
		controlsPanel.style.left = 'auto';
		controlsPanel.style.top = newTop + 'px';
	}
});

document.addEventListener('mouseup', () => {
	isDraggingControls = false;
});

// Add event listeners for alignment buttons
document.querySelectorAll('.align-btn').forEach(button => {
    button.addEventListener('click', (e) => {
        const alignPosition = e.target.dataset.align;
        if (alignPosition && currentImage) {
            alignImage(alignPosition);
        } else if (!currentImage) {
            alert('Please upload an image first.');
        }
    });
});

// Mark center alignment as active by default
const centerBtn = document.querySelector('.align-btn[data-align="center"]');
if (centerBtn) centerBtn.classList.add('active');

initializeCanvas();
draw();
