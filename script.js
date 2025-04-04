const imageLoader = document.getElementById('imageLoader');
const canvas = document.getElementById('imageCanvas');
const ctx = canvas.getContext('2d');
const themeToggle = document.getElementById('themeToggle');
const toggleControlsBtn = document.getElementById('toggleControls');
// Background blur now handled directly in canvas

// Scale controls
const imageScaleInput = document.getElementById('imageScale');
const imageScaleValueSpan = document.getElementById('imageScaleValue');
const blurScaleInput = document.getElementById('blurScale');
const blurScaleValueSpan = document.getElementById('blurScaleValue');

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
const fitWidthBtn = document.getElementById('fitWidthBtn');
const fitHeightBtn = document.getElementById('fitHeightBtn');

let currentImage = null;
let imageX = 0, imageY = 0;
let drawnWidth = 0, drawnHeight = 0;
let scale = 1;
let backgroundScale = 1;
let currentImageSrc = null;

let isDragging = false, isResizing = false;
let activeHandle = null;
// Determine handle size based on device - larger handles for mobile devices
const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const handleSize = isMobileDevice ? 24 : 16; // Larger handles on mobile

// Variables for pinch-to-zoom functionality
let initialPinchDistance = 0;
let initialScale = 1;
let isPinching = false;
let startX, startY, resizeStartX, resizeStartY;
let initialImageX, initialImageY, initialDrawnWidth, initialDrawnHeight;

// Show a visualization of the hit area for debugging purposes
const showDebugUI = false;

const snapThreshold = 10;

// Offline status detection
let isOnline = navigator.onLine;

// Create and show mobile instructions for pinch-to-zoom
function showMobileInstructions() {
    // Only show for mobile devices and if we have an image
    if (!isMobileDevice || !currentImage) return;
    
    // Create the instruction element if it doesn't exist yet
    let instructionEl = document.getElementById('mobile-instructions');
    if (!instructionEl) {
        instructionEl = document.createElement('div');
        instructionEl.id = 'mobile-instructions';
        instructionEl.innerHTML = 'Pinch with two fingers to zoom';
        instructionEl.style.position = 'absolute';
        instructionEl.style.bottom = '20px';
        instructionEl.style.left = '50%';
        instructionEl.style.transform = 'translateX(-50%)';
        instructionEl.style.backgroundColor = 'rgba(0,0,0,0.7)';
        instructionEl.style.color = 'white';
        instructionEl.style.padding = '8px 12px';
        instructionEl.style.borderRadius = '20px';
        instructionEl.style.fontSize = '14px';
        instructionEl.style.zIndex = '10';
        instructionEl.style.transition = 'opacity 0.5s';
        document.body.appendChild(instructionEl);
        
        // Hide the instruction after 5 seconds
        setTimeout(() => {
            instructionEl.style.opacity = '0';
            // Remove it from the DOM after fade out
            setTimeout(() => {
                if (instructionEl.parentNode) {
                    instructionEl.parentNode.removeChild(instructionEl);
                }
            }, 500);
        }, 5000);
    }
}

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
        
        // When changing canvas size, maintain the current image scale
        if (drawnWidth > 0 && drawnHeight > 0) {
            // Keep scale as is - don't recalculate dimensions
            // Just re-position the image based on alignment
            const alignment = alignmentPositions[position] || alignmentPositions.center;
            imageX = (canvas.width - drawnWidth) * alignment.x;
            imageY = (canvas.height - drawnHeight) * alignment.y;
            draw();
        } else {
            // First time loading, use regular alignment
            alignImage(position);
        }
        
        // Show mobile instructions when an image is loaded
        if (isMobileDevice) {
            showMobileInstructions();
        }
    } else {
        draw();
    }
    
    // Update responsive scaling when canvas dimensions change
    scaleCanvasContainer();
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
    
    // If no scale has been set yet (first load), set a default scale
    if (scale === 1 && drawnWidth === 0 && drawnHeight === 0) {
        // Calculate image size while maintaining aspect ratio
        const canvasAspect = canvas.width / canvas.height;
        const imageAspect = currentImage.naturalWidth / currentImage.naturalHeight;

        // If image is wider than the canvas (landscape), make it fill the width
        if (imageAspect > canvasAspect) {
            drawnWidth = canvas.width;
            scale = drawnWidth / currentImage.naturalWidth;
            drawnHeight = currentImage.naturalHeight * scale;
        } else {
            // For portrait/taller images, make it fill the height
            drawnHeight = canvas.height;
            scale = drawnHeight / currentImage.naturalHeight;
            drawnWidth = currentImage.naturalWidth * scale;
        }
        
        // Update image scale slider to reflect initial scale
        const scalePercent = Math.round(scale * 100);
        const clampedScale = Math.max(
            parseInt(imageScaleInput.min),
            Math.min(parseInt(imageScaleInput.max), scalePercent)
        );
        imageScaleInput.value = clampedScale;
        imageScaleValueSpan.textContent = `${clampedScale}%`;
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
            
            // Apply background scale
            bgWidth *= backgroundScale;
            bgHeight *= backgroundScale;

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

// For debugging - store the last mouse position
let lastMousePos = { x: 0, y: 0 };

function drawHandles() {
    if (!currentImage) return;
    
    // Draw image bounds for debugging - helps visualize the actual hit area
    if (showDebugUI) {
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(imageX, imageY, drawnWidth, drawnHeight);
    }
    
    // Indicate if the mouse is within the bounds for debugging
    if (showDebugUI) {
        if (lastMousePos.x >= imageX && 
            lastMousePos.x <= imageX + drawnWidth && 
            lastMousePos.y >= imageY && 
            lastMousePos.y <= imageY + drawnHeight) {
            // Mouse is inside
            ctx.strokeStyle = 'rgba(0, 255, 0, 1)';
            ctx.lineWidth = 3;
            ctx.strokeRect(imageX, imageY, drawnWidth, drawnHeight);
        }
        
        // Draw the mouse position
        ctx.fillStyle = 'rgba(255, 255, 0, 0.7)';
        ctx.beginPath();
        ctx.arc(lastMousePos.x, lastMousePos.y, 5, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Draw resize handles
    const halfHandle = handleSize / 2;
    ctx.fillStyle = 'rgba(0, 123, 255, 0.85)';  // Slightly more opaque blue
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;  // Thicker border
    const handles = getHandlePositions();
    for (const corner in handles) {
        const pos = handles[corner];
        const drawX = Math.max(halfHandle, Math.min(canvas.width - halfHandle, pos.x));
        const drawY = Math.max(halfHandle, Math.min(canvas.height - halfHandle, pos.y));
        
        // Draw handle with rounded corners or fallback to regular rectangle
        ctx.beginPath();
        if (ctx.roundRect) {
            // Use roundRect if supported
            ctx.roundRect(drawX - halfHandle, drawY - halfHandle, handleSize, handleSize, 4);
        } else {
            // Fallback for browsers that don't support roundRect
            ctx.rect(drawX - halfHandle, drawY - halfHandle, handleSize, handleSize);
        }
        ctx.fill();
        ctx.stroke();
        
        // Add a visual indicator inside the handle to show direction
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        
        if (corner === 'tl' || corner === 'br') {
            // Diagonal line for top-left and bottom-right
            ctx.moveTo(drawX - halfHandle + 5, drawY - halfHandle + 5);
            ctx.lineTo(drawX + halfHandle - 5, drawY + halfHandle - 5);
        } else {
            // Diagonal line for top-right and bottom-left
            ctx.moveTo(drawX + halfHandle - 5, drawY - halfHandle + 5);
            ctx.lineTo(drawX - halfHandle + 5, drawY + halfHandle - 5);
        }
        
        ctx.stroke();
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
            
            // Reset scale controls to default values
            imageScaleInput.value = 100;
            imageScaleValueSpan.textContent = '100%';
            blurScaleInput.value = 100;
            blurScaleValueSpan.textContent = '100%';
            backgroundScale = 1;
            
            // Reset image scale and dimensions
            scale = 1;
            drawnWidth = 0;
            drawnHeight = 0;
            
            // Reset to center alignment
            document.querySelectorAll('.align-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            const centerBtn = document.querySelector('.align-btn[data-align="center"]');
            if (centerBtn) centerBtn.classList.add('active');
            
            alignImage('center');
            
            // Show mobile instructions when image is first loaded
            if (isMobileDevice) {
                showMobileInstructions();
            }
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

function updateBlurScale() {
    const value = blurScaleInput.value;
    backgroundScale = value / 100;
    blurScaleValueSpan.textContent = `${value}%`;
    draw(); // Redraw with new background scale
}

function updateImageScale() {
    if (!currentImage) return;
    
    const value = imageScaleInput.value;
    const newScale = value / 100;
    const scaleRatio = newScale / scale;
    
    // Calculate new dimensions while maintaining aspect ratio
    const newWidth = drawnWidth * scaleRatio;
    const newHeight = drawnHeight * scaleRatio;
    
    // Calculate position adjustment to maintain center point
    const centerX = imageX + drawnWidth / 2;
    const centerY = imageY + drawnHeight / 2;
    
    // Update dimensions
    drawnWidth = newWidth;
    drawnHeight = newHeight;
    scale = newScale;
    
    // Recalculate position to maintain center point
    imageX = centerX - drawnWidth / 2;
    imageY = centerY - drawnHeight / 2;
    
    imageScaleValueSpan.textContent = `${value}%`;
    draw();
}

blurAmountInput.addEventListener('input', updateBlurValue);
blurScaleInput.addEventListener('input', updateBlurScale);
imageScaleInput.addEventListener('input', updateImageScale);
bgColorInput.addEventListener('input', draw); // Redraw when background color changes

sizePresetSelect.addEventListener('change', (event) => {
    const value = event.target.value; if (!value || value === 'separator') return;
    let newWidth = parseInt(canvasWidthInput.value, 10), newHeight = parseInt(canvasHeightInput.value, 10);
    if (value.startsWith('aspect_')) { const parts = value.split('_'), ratioX = parseInt(parts[1], 10), ratioY = parseInt(parts[2], 10); newHeight = Math.round(newWidth / (ratioX / ratioY));
    } else { const dims = value.split('x'); newWidth = parseInt(dims[0], 10); newHeight = parseInt(dims[1], 10); }
    if (newWidth >= 50 && newHeight >= 50) { canvasWidthInput.value = newWidth; canvasHeightInput.value = newHeight; initializeCanvas(); } else { console.warn("Preset resulted in invalid dimensions."); event.target.value = ""; }
});

function getMousePos(event) { 
	const rect = canvas.getBoundingClientRect(); 
	
	// Get the scale of the canvas container (in case it's been scaled in the UI)
	const canvasContainer = document.querySelector('.canvas-container');
	const containerStyle = window.getComputedStyle(canvasContainer);
	const transformValue = containerStyle.transform || containerStyle.webkitTransform;
	
	let scale = 1;
	if (transformValue && transformValue !== 'none') {
		// Parse the transform matrix to get the scale value
		const matrixValues = transformValue.match(/matrix.*\((.+)\)/);
		if (matrixValues && matrixValues[1]) {
			const values = matrixValues[1].split(', ');
			// Get the scale from the matrix (assuming uniform x/y scaling)
			if (values.length >= 4) {
				scale = parseFloat(values[0]);
			}
		}
	}
	
	// Get clientX and clientY, whether from mouse event or touch event
	const clientX = event.clientX !== undefined ? event.clientX : event.touches ? event.touches[0].clientX : 0;
	const clientY = event.clientY !== undefined ? event.clientY : event.touches ? event.touches[0].clientY : 0;
	
	// Adjust coordinates based on the scale
	return { 
		x: (clientX - rect.left) / scale, 
		y: (clientY - rect.top) / scale 
	}; 
}

function getHandleUnderMouse(pos) { 
	if (!currentImage) return null; 
	const handles = getHandlePositions(); 
	
	// Use a larger tolerance for touch events for easier handle grabbing on mobile
	// We can detect if it's likely a touch event by checking the User Agent
	const isTouchDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
	const tolerance = isTouchDevice ? handleSize * 3 : handleSize * 2;
	
	for (const corner in handles) { 
		const handlePos = handles[corner]; 
		if (pos.x >= handlePos.x - tolerance / 2 && 
			pos.x <= handlePos.x + tolerance / 2 && 
			pos.y >= handlePos.y - tolerance / 2 && 
			pos.y <= handlePos.y + tolerance / 2) { 
			return corner; 
		} 
	} 
	return null; 
}

// Calculate distance between two touch points
function getTouchDistance(touches) {
    if (touches.length < 2) return 0;
    
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

// Get the center point between two touches
function getTouchCenter(touches) {
    if (touches.length < 2) return { x: 0, y: 0 };
    
    const centerX = (touches[0].clientX + touches[1].clientX) / 2;
    const centerY = (touches[0].clientY + touches[1].clientY) / 2;
    
    const rect = canvas.getBoundingClientRect();
    const canvasContainer = document.querySelector('.canvas-container');
    const containerStyle = window.getComputedStyle(canvasContainer);
    const transformValue = containerStyle.transform || containerStyle.webkitTransform;
    
    let scale = 1;
    if (transformValue && transformValue !== 'none') {
        const matrixValues = transformValue.match(/matrix.*\((.+)\)/);
        if (matrixValues && matrixValues[1]) {
            const values = matrixValues[1].split(', ');
            if (values.length >= 4) {
                scale = parseFloat(values[0]);
            }
        }
    }
    
    return {
        x: (centerX - rect.left) / scale,
        y: (centerY - rect.top) / scale
    };
}

// Handle both mouse and touch events for canvas interactions
function handleCanvasStart(e) {
	// Prevent default for touch events to avoid scrolling/zooming
	if (e.type === 'touchstart') {
		e.preventDefault();
		
		// Check for pinch gesture (two touch points)
		if (e.touches.length === 2 && currentImage) {
		    isPinching = true;
		    isDragging = false;
		    isResizing = false;
		    initialPinchDistance = getTouchDistance(e.touches);
		    initialScale = scale;
		    
		    // Save center point and initial image state for scaling around center
		    const center = getTouchCenter(e.touches);
		    resizeStartX = center.x;
		    resizeStartY = center.y;
		    initialImageX = imageX;
		    initialImageY = imageY;
		    initialDrawnWidth = drawnWidth;
		    initialDrawnHeight = drawnHeight;
		    return;
		}
	}
	
	// Get mouse/touch position
	const pos = e.type === 'mousedown' ? getMousePos(e) : getMousePos(e.touches[0]);
	
	if (!currentImage) {
		// If no image is loaded, clicking/tapping on canvas opens the file upload dialog
		imageLoader.click();
		return;
	}
	
	activeHandle = getHandleUnderMouse(pos);
	if (activeHandle) {
		isResizing = true;
		isDragging = false;
		isPinching = false;
		canvas.style.cursor = (activeHandle === 'tl' || activeHandle === 'br') ? 'nwse-resize' : 'nesw-resize';
		resizeStartX = pos.x;
		resizeStartY = pos.y;
		initialImageX = imageX;
		initialImageY = imageY;
		initialDrawnWidth = drawnWidth;
		initialDrawnHeight = drawnHeight;
	} else {
		// Check if mouse/touch is inside the image
		// Use exact values (not rounded) for more precise hit detection
		if (pos.x >= imageX &&
			pos.x <= imageX + drawnWidth &&
			pos.y >= imageY &&
			pos.y <= imageY + drawnHeight) {
			
			isDragging = true;
			isResizing = false;
			isPinching = false;
			
			// Calculate the offset from the mouse/touch position to the image origin
			startX = pos.x - imageX;
			startY = pos.y - imageY;
			
			canvas.classList.add('grabbing');
			canvas.style.cursor = 'grabbing';
		}
	}
}

// Mouse event
canvas.addEventListener('mousedown', handleCanvasStart);

// Touch event
canvas.addEventListener('touchstart', handleCanvasStart, { passive: false });

// Handle both mouse and touch events for canvas movement
function handleCanvasMove(e) {
    // Prevent default for touch events to stop scrolling
    if (e.type === 'touchmove') {
        e.preventDefault();
    }
    
    if (!currentImage) return;
    
    // Handle pinch-to-zoom gesture on mobile
    if (e.type === 'touchmove' && e.touches.length === 2 && isPinching) {
        const currentDistance = getTouchDistance(e.touches);
        const pinchRatio = currentDistance / initialPinchDistance;
        
        // Get the center point of the pinch
        const center = getTouchCenter(e.touches);
        
        // Calculate new scale based on pinch ratio
        const newScale = Math.max(
            parseFloat(imageScaleInput.min) / 100,
            Math.min(parseFloat(imageScaleInput.max) / 100, initialScale * pinchRatio)
        );
        
        // Calculate new dimensions while maintaining aspect ratio
        const newWidth = currentImage.naturalWidth * newScale;
        const newHeight = currentImage.naturalHeight * newScale;
        
        // Calculate position adjustment to scale around pinch center point
        const centerToOriginX = center.x - initialImageX;
        const centerToOriginY = center.y - initialImageY;
        const centerToOriginRatioX = centerToOriginX / initialDrawnWidth;
        const centerToOriginRatioY = centerToOriginY / initialDrawnHeight;
        
        // Update dimensions
        drawnWidth = newWidth;
        drawnHeight = newHeight;
        scale = newScale;
        
        // Update position to maintain the pinch center point
        imageX = center.x - (drawnWidth * centerToOriginRatioX);
        imageY = center.y - (drawnHeight * centerToOriginRatioY);
        
        // Update the UI slider to reflect the new scale
        const scalePercent = Math.round(scale * 100);
        const clampedScale = Math.max(
            parseInt(imageScaleInput.min),
            Math.min(parseInt(imageScaleInput.max), scalePercent)
        );
        imageScaleInput.value = clampedScale;
        imageScaleValueSpan.textContent = `${clampedScale}%`;
        
        draw();
        return;
    }
    
    // Get position for both mouse and touch events (for single touch/mouse)
    const pos = e.type === 'mousemove' ? getMousePos(e) : getMousePos(e.touches[0]);
    
    // Store the position for debug visualization
    lastMousePos = pos;
    
    // Redraw with updated position indicator if we're in debug mode
    if (showDebugUI && !isDragging && !isResizing) {
        draw();
    }

    if (isResizing && activeHandle) {
        const dx = pos.x - resizeStartX;
        const dy = pos.y - resizeStartY;
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
        
        // Update image scale control to match the current scale
        const scalePercent = Math.round(scale * 100);
        // Clamp scale percentage to slider min/max values
        const clampedScale = Math.max(
            parseInt(imageScaleInput.min), 
            Math.min(parseInt(imageScaleInput.max), scalePercent)
        );
        imageScaleInput.value = clampedScale;
        imageScaleValueSpan.textContent = `${clampedScale}%`;

        draw();
    } else if (isDragging) {
        let targetX = pos.x - startX;
        let targetY = pos.y - startY;
        if (Math.abs(targetX) < snapThreshold) targetX = 0;
        if (Math.abs((targetX + drawnWidth) - canvas.width) < snapThreshold) targetX = canvas.width - drawnWidth;
        if (Math.abs(targetY) < snapThreshold) targetY = 0;
        if (Math.abs((targetY + drawnHeight) - canvas.height) < snapThreshold) targetY = canvas.height - drawnHeight;
        imageX = targetX; imageY = targetY;
        draw();
    } else {
        // Only check for cursor changes on mousemove, not touchmove
        if (e.type === 'mousemove') {
            const handle = getHandleUnderMouse(pos); 
            if (handle) { 
                canvas.style.cursor = (handle === 'tl' || handle === 'br') ? 'nwse-resize' : 'nesw-resize'; 
            } else {
                // Use exact values (not rounded) for more precise hit detection
                if (pos.x >= imageX && 
                    pos.x <= imageX + drawnWidth && 
                    pos.y >= imageY && 
                    pos.y <= imageY + drawnHeight) { 
                    canvas.style.cursor = 'grab'; 
                } else { 
                    canvas.style.cursor = 'default'; 
                }
            }
        }
    }
}

// Mouse event
canvas.addEventListener('mousemove', handleCanvasMove);

// Touch event - set passive: false to be able to preventDefault
canvas.addEventListener('touchmove', handleCanvasMove, { passive: false });

// Handle end of interaction (mouseup or touchend)
function handleCanvasEnd(e) {
	// Check if this is a touchend event with touches still ongoing
	// This can happen when multiple fingers are used
	if (e.type === 'touchend' && e.touches && e.touches.length > 0) {
		// If one finger is lifted during a pinch, but another remains
		if (isPinching && e.touches.length === 1) {
			// End pinch and start dragging with the remaining finger
			const pos = getMousePos(e.touches[0]);
			isPinching = false;
			
			// Check if the remaining touch is on the image
			if (pos.x >= imageX && 
				pos.x <= imageX + drawnWidth && 
				pos.y >= imageY && 
				pos.y <= imageY + drawnHeight) {
				
				isDragging = true;
				startX = pos.x - imageX;
				startY = pos.y - imageY;
			}
		}
		return;
	}
	
	// End all interactions
	if (isDragging || isResizing || isPinching) { 
		isDragging = false; 
		isResizing = false; 
		isPinching = false;
		activeHandle = null; 
		canvas.classList.remove('grabbing'); 
		
		// For mouse events, update the cursor based on position
		if (e.type === 'mouseup') {
			const currentPos = getMousePos(e);
			const hoverHandle = getHandleUnderMouse(currentPos); 
			
			if (hoverHandle) { 
				canvas.style.cursor = (hoverHandle === 'tl' || hoverHandle === 'br') ? 'nwse-resize' : 'nesw-resize'; 
			} else {
				// Use exact values (not rounded) for more precise hit detection
				if (currentPos.x >= imageX && 
					currentPos.x <= imageX + drawnWidth && 
					currentPos.y >= imageY && 
					currentPos.y <= imageY + drawnHeight) { 
					canvas.style.cursor = 'grab'; 
				} else { 
					canvas.style.cursor = 'default'; 
				}
			}
		}
		
		// For touch events, ensure we draw one last time to finalize any operations
		if (e.type === 'touchend') {
			draw();
		}
	} 
}

// Handle mouse/touch leaving canvas or being canceled
function handleCanvasLeave(e) {
	if (isDragging || isResizing || isPinching) { 
		isDragging = false; 
		isResizing = false; 
		isPinching = false;
		activeHandle = null; 
		canvas.classList.remove('grabbing'); 
	}
	
	// Only update cursor for mouse events
	if (e.type !== 'touchcancel' && e.type !== 'touchleave') {
		canvas.style.cursor = 'default';
	}
}

// Mouse events
canvas.addEventListener('mouseup', handleCanvasEnd);
canvas.addEventListener('mouseleave', handleCanvasLeave);

// Touch events
canvas.addEventListener('touchend', handleCanvasEnd);
canvas.addEventListener('touchcancel', handleCanvasLeave);

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
                
                // Apply background scale
                bgWidth *= backgroundScale;
                bgHeight *= backgroundScale;
    
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
        link.download = `${Date.now()}.png`;
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

// Handle both mouse and touch events for controls dragging
function handleDragStart(e) {
	// For mouse events
	if (e.type === 'mousedown' && e.button !== 0) return;
	
	// Check if clicked element is an interactive element or inside one
	const target = e.target;
	
	// Don't start drag if target is or is inside an input, button, select, option, or label
	if (target.tagName === 'INPUT' || 
		target.tagName === 'BUTTON' || 
		target.tagName === 'SELECT' || 
		target.tagName === 'OPTION' ||
		target.closest('button') ||
		target.closest('input') ||
		target.closest('select')) {
		return;
	}
	
	isDraggingControls = true;
	
	// Get client coordinates for both mouse and touch events
	const clientX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
	const clientY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;
	
	controlsStartX = clientX;
	controlsStartY = clientY;
	
	const rect = controlsPanel.getBoundingClientRect();
	controlsInitialLeft = window.innerWidth - rect.right;
	controlsInitialTop = rect.top;
	
	e.preventDefault();
}

function handleDragMove(e) {
	if (isDraggingControls) {
		// Get client coordinates for both mouse and touch events
		const clientX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
		const clientY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;
		
		const dx = clientX - controlsStartX;
		const dy = clientY - controlsStartY;
		
		let newLeft = controlsInitialLeft - dx;
		let newTop = controlsInitialTop + dy;
		
		// Remove constraints that keep the panel inside viewport bounds
		// This allows the panel to be positioned outside the window
		
		controlsPanel.style.right = newLeft + 'px';
		controlsPanel.style.left = 'auto';
		controlsPanel.style.top = newTop + 'px';
	}
}

function handleDragEnd() {
	isDraggingControls = false;
	saveControlsPosition();
}

// Mouse events
controlsPanel.addEventListener('mousedown', handleDragStart);
document.addEventListener('mousemove', handleDragMove);
document.addEventListener('mouseup', handleDragEnd);

// Touch events
controlsPanel.addEventListener('touchstart', handleDragStart, { passive: false });
document.addEventListener('touchmove', handleDragMove, { passive: false });
document.addEventListener('touchend', handleDragEnd);

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

// Fit width function - makes the image width 100% of canvas width
function fitImageWidth() {
	if (!currentImage) {
		alert('Please upload an image first.');
		return;
	}
	
	// Calculate new dimensions based on canvas width
	drawnWidth = canvas.width;
	scale = drawnWidth / currentImage.naturalWidth;
	drawnHeight = currentImage.naturalHeight * scale;
	
	// Center vertically
	imageX = 0;
	imageY = (canvas.height - drawnHeight) / 2;
	
	// Update the alignment button states
	document.querySelectorAll('.align-btn').forEach(btn => {
		btn.classList.remove('active');
	});
	
	// Update image scale slider
	const scalePercent = Math.round(scale * 100);
	const clampedScale = Math.max(
		parseInt(imageScaleInput.min),
		Math.min(parseInt(imageScaleInput.max), scalePercent)
	);
	imageScaleInput.value = clampedScale;
	imageScaleValueSpan.textContent = `${clampedScale}%`;
	
	draw();
}

// Fit height function - makes the image height 100% of canvas height
function fitImageHeight() {
	if (!currentImage) {
		alert('Please upload an image first.');
		return;
	}
	
	// Calculate new dimensions based on canvas height
	drawnHeight = canvas.height;
	scale = drawnHeight / currentImage.naturalHeight;
	drawnWidth = currentImage.naturalWidth * scale;
	
	// Center horizontally
	imageX = (canvas.width - drawnWidth) / 2;
	imageY = 0;
	
	// Update the alignment button states
	document.querySelectorAll('.align-btn').forEach(btn => {
		btn.classList.remove('active');
	});
	
	// Update image scale slider
	const scalePercent = Math.round(scale * 100);
	const clampedScale = Math.max(
		parseInt(imageScaleInput.min),
		Math.min(parseInt(imageScaleInput.max), scalePercent)
	);
	imageScaleInput.value = clampedScale;
	imageScaleValueSpan.textContent = `${clampedScale}%`;
	
	draw();
}

// Add event listeners for fit buttons
fitWidthBtn.addEventListener('click', fitImageWidth);
fitHeightBtn.addEventListener('click', fitImageHeight);

// Mark center alignment as active by default
const centerBtn = document.querySelector('.align-btn[data-align="center"]');
if (centerBtn) centerBtn.classList.add('active');

// Responsive canvas scaling
function scaleCanvasContainer() {
	const maxViewportWidth = window.innerWidth * 0.85;
	const maxViewportHeight = window.innerHeight * 0.75;
	
	const currentWidth = parseInt(canvasWidthInput.value, 10);
	const currentHeight = parseInt(canvasHeightInput.value, 10);
	
	let scale = 1;
	
	// If the canvas is wider than the viewport
	if (currentWidth > maxViewportWidth) {
		scale = Math.min(scale, maxViewportWidth / currentWidth);
	}
	
	// If the canvas is taller than the viewport
	if (currentHeight > maxViewportHeight) {
		scale = Math.min(scale, maxViewportHeight / currentHeight);
	}
	
	// Apply the scale and center the canvas
	if (scale < 1) {
		// Calculate the size after scaling to set margins
		const scaledWidth = currentWidth * scale;
		const scaledHeight = currentHeight * scale;
		
		// Set transform and center it
		canvasContainer.style.transform = `scale(${scale})`;
		
		// Adjust margins to center it (accounting for the scale origin)
		canvasContainer.style.margin = `${(currentHeight - scaledHeight) / 2}px ${(currentWidth - scaledWidth) / 2}px`;
	} else {
		canvasContainer.style.transform = 'none';
		canvasContainer.style.margin = '0';
	}
}

// Initial scaling and add resize event listener
scaleCanvasContainer();
window.addEventListener('resize', scaleCanvasContainer);

// Drag and drop functionality
const editorArea = document.querySelector('.editor-area');

editorArea.addEventListener('dragover', (e) => {
	e.preventDefault();
	e.stopPropagation();
	editorArea.classList.add('drag-over');
});

editorArea.addEventListener('dragleave', (e) => {
	e.preventDefault();
	e.stopPropagation();
	editorArea.classList.remove('drag-over');
});

editorArea.addEventListener('drop', (e) => {
	e.preventDefault();
	e.stopPropagation();
	editorArea.classList.remove('drag-over');
	
	const files = e.dataTransfer.files;
	if (files.length > 0) {
		const file = files[0];
		if (file.type.startsWith('image/')) {
			const reader = new FileReader();
			reader.onload = (e) => {
				currentImageSrc = e.target.result;
				const img = new Image();
				img.onload = () => { 
					currentImage = img; 
					
					// Reset scale controls to default values
					imageScaleInput.value = 100;
					imageScaleValueSpan.textContent = '100%';
					blurScaleInput.value = 100;
					blurScaleValueSpan.textContent = '100%';
					backgroundScale = 1;
					
					// Reset image scale and dimensions
					scale = 1;
					drawnWidth = 0;
					drawnHeight = 0;
					
					// Reset to center alignment
					document.querySelectorAll('.align-btn').forEach(btn => {
						btn.classList.remove('active');
					});
					const centerBtn = document.querySelector('.align-btn[data-align="center"]');
					if (centerBtn) centerBtn.classList.add('active');
					
					alignImage('center');
				};
				img.onerror = () => { alert('Failed to load image.'); currentImage = null; currentImageSrc = null; draw(); }
				img.src = currentImageSrc;
			};
			reader.onerror = () => { alert('Failed to read file.'); currentImage = null; currentImageSrc = null; draw(); }
			reader.readAsDataURL(file);
		} else {
			alert('Please drop an image file.');
		}
	}
});

// Initialize the scale controls
imageScaleValueSpan.textContent = '100%';
blurScaleValueSpan.textContent = '100%';

// Theme toggle functionality
function toggleTheme() {
	const html = document.documentElement;
	const currentTheme = html.getAttribute('data-theme');
	const newTheme = currentTheme === 'light' ? 'dark' : 'light';
	
	html.setAttribute('data-theme', newTheme);
	
	// Optional: save theme preference to localStorage
	localStorage.setItem('theme', newTheme);
}

themeToggle.addEventListener('click', toggleTheme);

// Check for saved theme preference
function initTheme() {
	const savedTheme = localStorage.getItem('theme');
	if (savedTheme) {
		document.documentElement.setAttribute('data-theme', savedTheme);
	} else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
		// If no saved preference, use system preference
		document.documentElement.setAttribute('data-theme', 'dark');
	}
}

initTheme();

// Controls panel toggle
function toggleControlsPanel() {
	const controlsPanel = document.querySelector('.controls');
	controlsPanel.classList.toggle('collapsed');
	
	// Save preference to localStorage
	const isCollapsed = controlsPanel.classList.contains('collapsed');
	localStorage.setItem('controlsCollapsed', isCollapsed ? 'true' : 'false');
}

toggleControlsBtn.addEventListener('click', toggleControlsPanel);

// Check for saved controls panel state
function initControlsState() {
	const savedState = localStorage.getItem('controlsCollapsed');
	if (savedState === 'true') {
		document.querySelector('.controls').classList.add('collapsed');
	}
	
	// Load saved panel position if available
	const savedPosRight = localStorage.getItem('controlsPosRight');
	const savedPosTop = localStorage.getItem('controlsPosTop');
	
	if (savedPosRight && savedPosTop) {
		controlsPanel.style.right = savedPosRight;
		controlsPanel.style.top = savedPosTop;
	}
}

// Reset controls panel to default position
function resetControlsPosition() {
	controlsPanel.style.right = '65px';
	controlsPanel.style.top = '65px';
	
	// Clear saved position from localStorage
	localStorage.removeItem('controlsPosRight');
	localStorage.removeItem('controlsPosTop');
}

// Save controls position when dragging ends
function saveControlsPosition() {
	const right = controlsPanel.style.right;
	const top = controlsPanel.style.top;
	
	localStorage.setItem('controlsPosRight', right);
	localStorage.setItem('controlsPosTop', top);
}

// Add event listener for the reset button
const resetControlsBtn = document.getElementById('resetControlsPos');
resetControlsBtn.addEventListener('click', resetControlsPosition);

initControlsState();

// Apply the default selected preset dimensions on page load
function applySelectedPreset() {
	const selectedOption = sizePresetSelect.options[sizePresetSelect.selectedIndex];
	const presetValue = selectedOption.value;
	
	if (presetValue && presetValue !== 'separator') {
		let newWidth = parseInt(canvasWidthInput.value, 10);
		let newHeight = parseInt(canvasHeightInput.value, 10);
		
		if (presetValue.startsWith('aspect_')) {
			const parts = presetValue.split('_');
			const ratioX = parseInt(parts[1], 10);
			const ratioY = parseInt(parts[2], 10);
			newHeight = Math.round(newWidth / (ratioX / ratioY));
		} else {
			const dims = presetValue.split('x');
			newWidth = parseInt(dims[0], 10);
			newHeight = parseInt(dims[1], 10);
		}
		
		if (newWidth >= 50 && newHeight >= 50) {
			canvasWidthInput.value = newWidth;
			canvasHeightInput.value = newHeight;
		}
	}
}

// Offline status handling
window.addEventListener('online', () => {
    isOnline = true;
    console.log('Application is online');
});

window.addEventListener('offline', () => {
    isOnline = false;
    console.log('Application is offline');
    
    // Show offline notification (optional)
    const offlineNotice = document.createElement('div');
    offlineNotice.id = 'offline-notice';
    offlineNotice.style.position = 'fixed';
    offlineNotice.style.bottom = '20px';
    offlineNotice.style.left = '20px';
    offlineNotice.style.backgroundColor = 'rgba(0,0,0,0.7)';
    offlineNotice.style.color = 'white';
    offlineNotice.style.padding = '8px 16px';
    offlineNotice.style.borderRadius = '4px';
    offlineNotice.style.zIndex = '9999';
    offlineNotice.style.fontSize = '14px';
    offlineNotice.textContent = 'You are currently offline. The app will continue to work.';
    
    document.body.appendChild(offlineNotice);
    
    // Remove the notice after 5 seconds
    setTimeout(() => {
        if (offlineNotice.parentNode) {
            offlineNotice.parentNode.removeChild(offlineNotice);
        }
    }, 5000);
});

// Handle file loading in offline mode
imageLoader.addEventListener('error', (event) => {
    if (!isOnline) {
        alert('Unable to load this file while offline. Please try again when you have an internet connection.');
    }
});

// Apply selected preset before initializing canvas
applySelectedPreset();
initializeCanvas();
draw();
