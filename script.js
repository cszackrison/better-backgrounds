const imageLoader = document.getElementById('imageLoader');
const canvas = document.getElementById('imageCanvas');
const ctx = canvas.getContext('2d');
const backgroundBlur = document.getElementById('background-blur');
const canvasWidthInput = document.getElementById('canvasWidth');
const canvasHeightInput = document.getElementById('canvasHeight');
const saveButton = document.getElementById('saveButton');
const canvasContainer = document.querySelector('.canvas-container');
const blurAmountInput = document.getElementById('blurAmount');
const blurValueSpan = document.getElementById('blurValue');
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

const snapThreshold = 10; // Pixels for snapping threshold

// --- Initialization & Resizing ---
// (initializeCanvas, centerImage remain the same)
function initializeCanvas() {
    const width = parseInt(canvasWidthInput.value, 10);
    const height = parseInt(canvasHeightInput.value, 10);
    // Store old dimensions before changing
    const oldWidth = canvas.width;
    const oldHeight = canvas.height;

    canvas.width = width;
    canvas.height = height;
    canvasContainer.style.width = `${width}px`;
    canvasContainer.style.height = `${height}px`;

    if (currentImage) {
        // Adjust position to keep image center relatively stable
        imageX += (width - oldWidth) / 2;
        imageY += (height - oldHeight) / 2;
    }
    draw();
}

function centerImage() {
    if (!currentImage) return;
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
    imageX = (canvas.width - drawnWidth) / 2;
    imageY = (canvas.height - drawnHeight) / 2;
}


// --- Drawing ---

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (currentImage && currentImageSrc) {
        if (backgroundBlur.style.backgroundImage !== `url("${currentImageSrc}")`) {
             backgroundBlur.style.backgroundImage = `url("${currentImageSrc}")`;
        }

        // --- Refined Background Logic ---
        backgroundBlur.style.backgroundRepeat = 'no-repeat';
        backgroundBlur.style.backgroundSize = 'cover'; // Still use cover

        // Calculate the center of the *entire drawn image* relative to the canvas
        const drawnCenterX = imageX + drawnWidth / 2;
        const drawnCenterY = imageY + drawnHeight / 2;

        // Convert this canvas center point to a normalized position relative to the *canvas dimensions*
        // This percentage determines where the background image's center should align within the container
        let normX = drawnCenterX / canvas.width;
        let normY = drawnCenterY / canvas.height;

        // Keep normalization between 0 and 1 for percentage positioning
        normX = Math.max(0, Math.min(1, normX));
        normY = Math.max(0, Math.min(1, normY));

        // Set the background position using percentages. 'cover' will handle scaling.
        backgroundBlur.style.backgroundPosition = `${normX * 100}% ${normY * 100}%`;
        // --- End Refined Background Logic ---

        updateBlur();

        // Draw main image
        ctx.drawImage(currentImage, Math.round(imageX), Math.round(imageY), Math.round(drawnWidth), Math.round(drawnHeight));
        drawHandles();

    } else {
        // No image - clear background and draw placeholder
        backgroundBlur.style.backgroundImage = 'none';
        backgroundBlur.style.backgroundPosition = 'center center';
        backgroundBlur.style.backgroundSize = 'cover';
        ctx.fillStyle = "#999";
        ctx.textAlign = "center";
        ctx.font = "16px sans-serif";
        ctx.fillText("Upload an image", canvas.width / 2, canvas.height / 2);
    }
}

// (drawHandles, getHandlePositions remain the same)
function drawHandles() { /* ... same ... */
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
function getHandlePositions() { /* ... same ... */
    const x = Math.round(imageX);
    const y = Math.round(imageY);
    const w = Math.round(drawnWidth);
    const h = Math.round(drawnHeight);
    return { tl: { x: x, y: y }, tr: { x: x + w, y: y }, bl: { x: x, y: y + h }, br: { x: x + w, y: y + h } };
}


// --- Image Loading ---
// (imageLoader listener remains the same)
imageLoader.addEventListener('change', (event) => { /* ... same ... */
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) { alert('Please select a valid image file.'); event.target.value = null; return; }
    const reader = new FileReader();
    reader.onload = (e) => {
        currentImageSrc = e.target.result;
        const img = new Image();
        img.onload = () => { currentImage = img; centerImage(); draw(); };
        img.onerror = () => { alert('Failed to load image.'); currentImage = null; currentImageSrc = null; draw(); }
        img.src = currentImageSrc;
    };
    reader.onerror = () => { alert('Failed to read file.'); currentImage = null; currentImageSrc = null; draw(); }
    reader.readAsDataURL(file);
    event.target.value = null;
});


// --- Controls Listeners ---
// (Canvas inputs, Blur slider, Size preset listeners remain the same)
canvasWidthInput.addEventListener('change', () => { sizePresetSelect.value = ""; initializeCanvas(); });
canvasHeightInput.addEventListener('change', () => { sizePresetSelect.value = ""; initializeCanvas(); });
function updateBlur() { /* ... same ... */
    const value = blurAmountInput.value;
    backgroundBlur.style.filter = `blur(${value}px)`;
    blurValueSpan.textContent = `${value}px`;
}
blurAmountInput.addEventListener('input', updateBlur);
sizePresetSelect.addEventListener('change', (event) => { /* ... same ... */
    const value = event.target.value; if (!value || value === 'separator') return;
    let newWidth = parseInt(canvasWidthInput.value, 10), newHeight = parseInt(canvasHeightInput.value, 10);
    if (value.startsWith('aspect_')) { const parts = value.split('_'), ratioX = parseInt(parts[1], 10), ratioY = parseInt(parts[2], 10); newHeight = Math.round(newWidth / (ratioX / ratioY));
    } else { const dims = value.split('x'); newWidth = parseInt(dims[0], 10); newHeight = parseInt(dims[1], 10); }
    if (newWidth >= 50 && newHeight >= 50) { canvasWidthInput.value = newWidth; canvasHeightInput.value = newHeight; initializeCanvas(); } else { console.warn("Preset resulted in invalid dimensions."); event.target.value = ""; }
});


// --- Mouse Interaction (Panning and Resizing) ---
// (getMousePos, getHandleUnderMouse, mousedown remain the same)
function getMousePos(event) { /* ... same ... */ const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
function getHandleUnderMouse(pos) { /* ... same ... */ if (!currentImage) return null; const handles = getHandlePositions(); const tolerance = handleSize * 1.5; for (const corner in handles) { const handlePos = handles[corner]; if ( pos.x >= handlePos.x - tolerance / 2 && pos.x <= handlePos.x + tolerance / 2 && pos.y >= handlePos.y - tolerance / 2 && pos.y <= handlePos.y + tolerance / 2 ) { return corner; } } return null; }
canvas.addEventListener('mousedown', (e) => { /* ... same ... */ if (!currentImage) return; const mousePos = getMousePos(e); activeHandle = getHandleUnderMouse(mousePos); if (activeHandle) { isResizing = true; isDragging = false; canvas.style.cursor = (activeHandle === 'tl' || activeHandle === 'br') ? 'nwse-resize' : 'nesw-resize'; resizeStartX = mousePos.x; resizeStartY = mousePos.y; initialImageX = imageX; initialImageY = imageY; initialDrawnWidth = drawnWidth; initialDrawnHeight = drawnHeight; } else { if (mousePos.x >= imageX && mousePos.x <= imageX + drawnWidth && mousePos.y >= imageY && mousePos.y <= imageY + drawnHeight) { isDragging = true; isResizing = false; startX = mousePos.x - imageX; startY = mousePos.y - imageY; canvas.classList.add('grabbing'); canvas.style.cursor = 'grabbing'; } } });

canvas.addEventListener('mousemove', (e) => {
    if (!currentImage) return;
    const mousePos = getMousePos(e);

    if (isResizing && activeHandle) {
        // --- Resizing Logic with Non-Restricting Snapping ---
        const dx = mousePos.x - resizeStartX;
        const dy = mousePos.y - resizeStartY;
        const aspect = currentImage.naturalWidth / currentImage.naturalHeight;

        // 1. Calculate raw new dimensions based on mouse delta
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

        // 2. Determine potential snapped position/dimensions
        let snappedX = rawX, snappedY = rawY, snappedWidth = rawWidth, snappedHeight = rawHeight;
        let didSnap = false;

        // Check edges based on the handle being dragged
        if (activeHandle === 'tl' || activeHandle === 'bl') { // Left edge moving
            if (Math.abs(rawX) < snapThreshold) {
                snappedX = 0;
                snappedWidth = initialDrawnWidth + initialImageX; // Width determined by fixed right edge
                snappedHeight = snappedWidth / aspect;
                 if (activeHandle === 'tl') { // Need to adjust Y for top handle
                    snappedY = initialImageY + initialDrawnHeight - snappedHeight;
                } else { // Bottom handle fixed Y
                    snappedY = initialImageY; // Or recalculate based on fixed bottom? Keep initial for now.
                }
                didSnap = true;
            }
        }
         if (activeHandle === 'tr' || activeHandle === 'br') { // Right edge moving
             if (Math.abs((rawX + rawWidth) - canvas.width) < snapThreshold) {
                 snappedWidth = canvas.width - rawX; // Width determined by canvas edge and current X
                 snappedHeight = snappedWidth / aspect;
                 snappedX = rawX; // X doesn't change here
                 if (activeHandle === 'tr') { // Adjust Y for top handle
                    snappedY = initialImageY + initialDrawnHeight - snappedHeight;
                 } else { // Bottom handle fixed Y
                    snappedY = initialImageY;
                 }
                 didSnap = true;
             }
         }
        if (activeHandle === 'tl' || activeHandle === 'tr') { // Top edge moving
            if (Math.abs(rawY) < snapThreshold && !didSnap) { // Avoid double-snapping one axis yet
                snappedY = 0;
                snappedHeight = initialDrawnHeight + initialImageY; // Height determined by fixed bottom
                snappedWidth = snappedHeight * aspect;
                if (activeHandle === 'tl') { // Adjust X for left handle
                    snappedX = initialImageX + initialDrawnWidth - snappedWidth;
                } else { // Right handle fixed X
                    snappedX = initialImageX;
                }
                didSnap = true;
            }
        }
        if (activeHandle === 'bl' || activeHandle === 'br') { // Bottom edge moving
            if (Math.abs((rawY + rawHeight) - canvas.height) < snapThreshold && !didSnap) {
                snappedHeight = canvas.height - rawY; // Height determined by canvas edge and current Y
                snappedWidth = snappedHeight * aspect;
                snappedY = rawY; // Y doesn't change
                if (activeHandle === 'bl') { // Adjust X for left handle
                    snappedX = initialImageX + initialDrawnWidth - snappedWidth;
                } else { // Right handle fixed X
                    snappedX = initialImageX;
                }
                didSnap = true;
            }
        }

        // 3. Decide whether to use snapped or raw values
        // This simple version just applies snap if detected. To allow moving past,
        // we'd need to compare mouse position to the *snapped* handle position.
        // For now, let's just use the snap if close. User can always nudge it away.
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

        // Ensure minimum size
         drawnWidth = Math.max(handleSize, drawnWidth);
         drawnHeight = Math.max(handleSize, drawnHeight);
         // Recalculate scale
         scale = drawnWidth / currentImage.naturalWidth;


        draw();
        // --- End Resizing Logic ---

    } else if (isDragging) {
        // --- Dragging Logic with Snapping (Same as before) ---
        let targetX = mousePos.x - startX;
        let targetY = mousePos.y - startY;
        if (Math.abs(targetX) < snapThreshold) targetX = 0;
        if (Math.abs((targetX + drawnWidth) - canvas.width) < snapThreshold) targetX = canvas.width - drawnWidth;
        if (Math.abs(targetY) < snapThreshold) targetY = 0;
        if (Math.abs((targetY + drawnHeight) - canvas.height) < snapThreshold) targetY = canvas.height - drawnHeight;
        imageX = targetX; imageY = targetY;
        draw();
        // --- End Dragging Logic ---

    } else { // Hovering: Update cursor (same as before)
         const handle = getHandleUnderMouse(mousePos); if (handle) { canvas.style.cursor = (handle === 'tl' || handle === 'br') ? 'nwse-resize' : 'nesw-resize'; } else if (mousePos.x >= imageX && mousePos.x <= imageX + drawnWidth && mousePos.y >= imageY && mousePos.y <= imageY + drawnHeight) { canvas.style.cursor = 'grab'; } else { canvas.style.cursor = 'default'; }
    }
});

// (mouseup, mouseleave listeners remain the same)
canvas.addEventListener('mouseup', (e) => { /* ... same ... */ if (isDragging || isResizing) { isDragging = false; isResizing = false; activeHandle = null; canvas.classList.remove('grabbing'); const currentMousePos = getMousePos(e); const hoverHandle = getHandleUnderMouse(currentMousePos); if (hoverHandle) { canvas.style.cursor = (hoverHandle === 'tl' || hoverHandle === 'br') ? 'nwse-resize' : 'nesw-resize'; } else if (currentMousePos.x >= imageX && currentMousePos.x <= imageX + drawnWidth && currentMousePos.y >= imageY && currentMousePos.y <= imageY + drawnHeight) { canvas.style.cursor = 'grab'; } else { canvas.style.cursor = 'default'; } } });
canvas.addEventListener('mouseleave', () => { /* ... same ... */ if (isDragging || isResizing) { isDragging = false; isResizing = false; activeHandle = null; canvas.classList.remove('grabbing'); } canvas.style.cursor = 'default'; });


// --- Saving ---

function saveImage() {
    if (!currentImage) {
        alert("Please upload an image first.");
        return;
    }

    // Create a temporary canvas sized to the final output (viewport size)
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    try {
        // --- 1. Draw the Blurred Background ---
        const blurValue = blurAmountInput.value;
        if (blurValue > 0) {
            // Calculate scale factor for 'cover'
            const imgAspect = currentImage.naturalWidth / currentImage.naturalHeight;
            const canvasAspect = tempCanvas.width / tempCanvas.height;
            let bgWidth, bgHeight;

            if (imgAspect > canvasAspect) { // Image wider than canvas aspect
                bgHeight = tempCanvas.height;
                bgWidth = bgHeight * imgAspect;
            } else { // Image taller or same aspect
                bgWidth = tempCanvas.width;
                bgHeight = bgWidth / imgAspect;
            }

            // Calculate position based on normalized center (already calculated in draw())
            const drawnCenterX = imageX + drawnWidth / 2;
            const drawnCenterY = imageY + drawnHeight / 2;
            let normX = drawnCenterX / canvas.width;
            let normY = drawnCenterY / canvas.height;
            normX = Math.max(0, Math.min(1, normX));
            normY = Math.max(0, Math.min(1, normY));

            // Calculate top-left offset based on percentage position
            const bgX = (tempCanvas.width - bgWidth) * normX;
            const bgY = (tempCanvas.height - bgHeight) * normY;

            // Apply blur filter
            tempCtx.filter = `blur(${blurValue}px)`;

            // Draw the original image scaled and positioned like the background
            tempCtx.drawImage(
                currentImage,
                bgX, bgY, // Position on temp canvas
                bgWidth, bgHeight // Size on temp canvas
            );

            // Reset filter for the foreground
            tempCtx.filter = 'none';
        } else {
             // If no blur, maybe draw a solid color or leave transparent?
             // Let's leave it transparent for simplicity. Or fill with a color:
             // tempCtx.fillStyle = '#f0f0f0'; // Match body background
             // tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        }


        // --- 2. Draw the Cropped Foreground Image ---
        // Calculate source rect from original image based on current view
        const sourceX = -imageX / scale;
        const sourceY = -imageY / scale;
        const sourceWidth = canvas.width / scale;
        const sourceHeight = canvas.height / scale;

        // Define destination rect on the temporary canvas (the whole canvas)
        const destX = 0;
        const destY = 0;
        const destWidth = tempCanvas.width;
        const destHeight = tempCanvas.height;

         // Draw the calculated portion of the *original* image onto the temporary canvas
         // This draws *over* the blurred background where the image exists
        tempCtx.drawImage(
            currentImage,
            sourceX, sourceY, sourceWidth, sourceHeight, // Source rect (original image coords)
            destX, destY, destWidth, destHeight        // Destination rect (temp canvas coords)
        );

        // --- 3. Generate and Trigger Download ---
        const dataUrl = tempCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'canvas-image.png'; // Filename
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


// --- Initial Setup ---
initializeCanvas();
updateBlur();
draw();
