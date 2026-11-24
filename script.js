// DOM elements
const imageLoader = document.getElementById('imageLoader');
const canvas = document.getElementById('imageCanvas');
const ctx = canvas.getContext('2d');
const themeToggle = document.getElementById('themeToggle');
const toggleControlsBtn = document.getElementById('toggleControls');
const resetControlsBtn = document.getElementById('resetControlsPos');
const imageScaleInput = document.getElementById('imageScale');
const imageScaleValueSpan = document.getElementById('imageScaleValue');
const blurScaleInput = document.getElementById('blurScale');
const blurScaleValueSpan = document.getElementById('blurScaleValue');
const canvasWidthInput = document.getElementById('canvasWidth');
const canvasHeightInput = document.getElementById('canvasHeight');
const saveButton = document.getElementById('saveButton');
const canvasContainer = document.querySelector('.canvas-container');
const controlsPanel = document.querySelector('.controls');
const editorArea = document.querySelector('.editor-area');
const blurAmountInput = document.getElementById('blurAmount');
const blurValueSpan = document.getElementById('blurValue');
const bgColorInput = document.getElementById('bgColor');
const sizePresetSelect = document.getElementById('sizePreset');
const fitWidthBtn = document.getElementById('fitWidthBtn');
const fitHeightBtn = document.getElementById('fitHeightBtn');
const alignButtons = document.querySelectorAll('.align-btn');

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

// Canvas size limits. 16384px per side keeps us inside every major browser's canvas limits.
const MIN_CANVAS_SIZE = 50;
const MAX_CANVAS_SIDE = 16384;
const DEFAULT_CANVAS_WIDTH = 1920;
const DEFAULT_CANVAS_HEIGHT = 1080;

// Image scale slider defaults (percent). The range widens automatically when the
// actual scale falls outside it, so the slider always reflects the real scale.
const DEFAULT_SCALE_MIN = parseInt(imageScaleInput.min, 10);
const DEFAULT_SCALE_MAX = parseInt(imageScaleInput.max, 10);
const MAX_IMAGE_SCALE = 20;

// Device detection - larger handles and hit areas for touch devices
const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
	(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

// Sizes below are in on-screen pixels; they are converted to canvas pixels using the
// current display scale so handles stay usable when a large canvas is shown scaled down.
const HANDLE_SCREEN_SIZE = isMobileDevice ? 24 : 16;
const HANDLE_HIT_MULTIPLIER = isMobileDevice ? 3 : 2;
const SNAP_SCREEN_THRESHOLD = 10;

// Show a visualization of the hit area for debugging purposes
const showDebugUI = false;

// Image state
let currentImage = null;
let currentImageUrl = null;
let imageLoadId = 0;
let imageX = 0, imageY = 0;
let drawnWidth = 0, drawnHeight = 0;
let scale = 1;
let backgroundScale = 1;

// The CSS scale applied to the canvas container (1 = canvas shown at full size)
let displayScale = 1;

// Interaction state
let isDragging = false, isResizing = false, isPinching = false;
let activeHandle = null;
let initialPinchDistance = 0;
let initialScale = 1;
let startX, startY, resizeStartX, resizeStartY;
let initialImageX, initialImageY, initialDrawnWidth, initialDrawnHeight;
let hasShownMobileInstructions = false;

// For debugging - store the last mouse position
let lastMousePos = { x: 0, y: 0 };

// ---------- Storage helpers ----------

// localStorage can throw (private browsing, disabled storage, quota), so never let it break the app
function readStorage(key) {
	try {
		return localStorage.getItem(key);
	} catch (error) {
		console.warn(`Could not read "${key}" from localStorage:`, error);
		return null;
	}
}

function writeStorage(key, value) {
	try {
		localStorage.setItem(key, value);
	} catch (error) {
		console.warn(`Could not write "${key}" to localStorage:`, error);
	}
}

function removeStorage(key) {
	try {
		localStorage.removeItem(key);
	} catch (error) {
		console.warn(`Could not remove "${key}" from localStorage:`, error);
	}
}

// ---------- Geometry helpers ----------

// Convert a length in on-screen pixels into canvas pixels
function screenToCanvasLength(length) {
	return length / (displayScale || 1);
}

function getHandleSize() {
	return screenToCanvasLength(HANDLE_SCREEN_SIZE);
}

function getSnapThreshold() {
	return screenToCanvasLength(SNAP_SCREEN_THRESHOLD);
}

// Smallest width the image may be resized to while keeping both sides at least one handle wide
function getMinImageWidth() {
	if (!currentImage) return 0;
	const aspect = currentImage.naturalWidth / currentImage.naturalHeight;
	const minSide = getHandleSize();
	return Math.max(minSide, minSide * aspect);
}

function isPointOnImage(pos) {
	return pos.x >= imageX &&
		pos.x <= imageX + drawnWidth &&
		pos.y >= imageY &&
		pos.y <= imageY + drawnHeight;
}

function getResizeCursor(handle) {
	return (handle === 'tl' || handle === 'br') ? 'nwse-resize' : 'nesw-resize';
}

// Map a viewport coordinate to a canvas pixel coordinate. Accounts for the canvas's
// CSS padding/border and any transform applied to the container.
function clientToCanvas(clientX, clientY) {
	const rect = canvas.getBoundingClientRect();
	const style = window.getComputedStyle(canvas);
	const borderLeft = parseFloat(style.borderLeftWidth) || 0;
	const borderTop = parseFloat(style.borderTopWidth) || 0;
	const paddingLeft = parseFloat(style.paddingLeft) || 0;
	const paddingRight = parseFloat(style.paddingRight) || 0;
	const paddingTop = parseFloat(style.paddingTop) || 0;
	const paddingBottom = parseFloat(style.paddingBottom) || 0;

	// Ratio between on-screen size and layout size (the CSS transform scale)
	const transformScaleX = canvas.offsetWidth ? rect.width / canvas.offsetWidth : 1;
	const transformScaleY = canvas.offsetHeight ? rect.height / canvas.offsetHeight : 1;

	// Size of the drawable area in CSS pixels
	const contentWidth = canvas.clientWidth - paddingLeft - paddingRight;
	const contentHeight = canvas.clientHeight - paddingTop - paddingBottom;
	const canvasPerCssX = contentWidth > 0 ? canvas.width / contentWidth : 1;
	const canvasPerCssY = contentHeight > 0 ? canvas.height / contentHeight : 1;

	const contentLeft = rect.left + (borderLeft + paddingLeft) * transformScaleX;
	const contentTop = rect.top + (borderTop + paddingTop) * transformScaleY;

	return {
		x: ((clientX - contentLeft) / transformScaleX) * canvasPerCssX,
		y: ((clientY - contentTop) / transformScaleY) * canvasPerCssY
	};
}

function getMousePos(event) {
	return clientToCanvas(event.clientX, event.clientY);
}

// Calculate distance between two touch points
function getTouchDistance(touches) {
	if (touches.length < 2) return 0;
	const dx = touches[0].clientX - touches[1].clientX;
	const dy = touches[0].clientY - touches[1].clientY;
	return Math.sqrt(dx * dx + dy * dy);
}

// Get the center point between two touches, in canvas coordinates
function getTouchCenter(touches) {
	const centerX = (touches[0].clientX + touches[1].clientX) / 2;
	const centerY = (touches[0].clientY + touches[1].clientY) / 2;
	return clientToCanvas(centerX, centerY);
}

// Handle positions match where they are drawn: clamped inside the canvas so they stay
// grabbable even when the image extends past the canvas edges.
function getHandlePositions() {
	const halfHandle = getHandleSize() / 2;
	const clampX = (value) => Math.max(halfHandle, Math.min(canvas.width - halfHandle, value));
	const clampY = (value) => Math.max(halfHandle, Math.min(canvas.height - halfHandle, value));
	const left = clampX(imageX);
	const right = clampX(imageX + drawnWidth);
	const top = clampY(imageY);
	const bottom = clampY(imageY + drawnHeight);
	return {
		tl: { x: left, y: top },
		tr: { x: right, y: top },
		bl: { x: left, y: bottom },
		br: { x: right, y: bottom }
	};
}

function getHandleUnderMouse(pos) {
	if (!currentImage) return null;
	const handles = getHandlePositions();
	const halfTolerance = (getHandleSize() * HANDLE_HIT_MULTIPLIER) / 2;

	for (const corner in handles) {
		const handlePos = handles[corner];
		if (Math.abs(pos.x - handlePos.x) <= halfTolerance && Math.abs(pos.y - handlePos.y) <= halfTolerance) {
			return corner;
		}
	}
	return null;
}

// ---------- UI sync helpers ----------

function setActiveAlignment(position) {
	alignButtons.forEach(btn => {
		btn.classList.toggle('active', btn.dataset.align === position);
	});
}

function getActiveAlignment() {
	const activeBtn = document.querySelector('.align-btn.active');
	return activeBtn ? activeBtn.dataset.align : null;
}

// Keep the image scale slider in step with the real scale, widening its range if needed
function syncScaleSlider() {
	const percent = Math.round(scale * 100);
	imageScaleInput.min = Math.max(1, Math.min(DEFAULT_SCALE_MIN, percent));
	imageScaleInput.max = Math.max(DEFAULT_SCALE_MAX, percent);
	imageScaleInput.value = percent;
	imageScaleValueSpan.textContent = `${percent}%`;
}

function setImageScale(newScale) {
	scale = newScale;
	drawnWidth = currentImage.naturalWidth * scale;
	drawnHeight = currentImage.naturalHeight * scale;
}

// Position the image inside the canvas according to an alignment key
function positionImage(position) {
	const alignment = alignmentPositions[position] || alignmentPositions.center;
	imageX = (canvas.width - drawnWidth) * alignment.x;
	imageY = (canvas.height - drawnHeight) * alignment.y;
}

// Size the image to fit entirely within the canvas
function fitImageToCanvas() {
	const canvasAspect = canvas.width / canvas.height;
	const imageAspect = currentImage.naturalWidth / currentImage.naturalHeight;
	if (imageAspect > canvasAspect) {
		setImageScale(canvas.width / currentImage.naturalWidth);
	} else {
		setImageScale(canvas.height / currentImage.naturalHeight);
	}
	syncScaleSlider();
}

// Create and show mobile instructions for pinch-to-zoom (once per session)
function showMobileInstructions() {
	if (!isMobileDevice || !currentImage || hasShownMobileInstructions) return;
	hasShownMobileInstructions = true;

	const instructionEl = document.createElement('div');
	instructionEl.id = 'mobile-instructions';
	instructionEl.textContent = 'Pinch with two fingers to zoom';
	instructionEl.style.backgroundColor = 'rgba(0,0,0,0.7)';
	instructionEl.style.borderRadius = '20px';
	instructionEl.style.bottom = '20px';
	instructionEl.style.color = 'white';
	instructionEl.style.fontSize = '14px';
	instructionEl.style.left = '50%';
	instructionEl.style.padding = '8px 12px';
	instructionEl.style.position = 'absolute';
	instructionEl.style.transform = 'translateX(-50%)';
	instructionEl.style.transition = 'opacity 0.5s';
	instructionEl.style.zIndex = '10';
	document.body.appendChild(instructionEl);

	// Fade out after 5 seconds, then remove from the DOM
	setTimeout(() => {
		instructionEl.style.opacity = '0';
		setTimeout(() => instructionEl.remove(), 500);
	}, 5000);
}

// ---------- Canvas setup ----------

// Read a dimension input, clamping it to a valid range (falls back if empty/invalid)
function readDimension(input, fallback) {
	const value = parseInt(input.value, 10);
	if (Number.isNaN(value)) return fallback;
	return Math.max(MIN_CANVAS_SIZE, Math.min(MAX_CANVAS_SIDE, value));
}

function initializeCanvas() {
	const previousWidth = canvas.width;
	const previousHeight = canvas.height;
	const width = readDimension(canvasWidthInput, previousWidth || DEFAULT_CANVAS_WIDTH);
	const height = readDimension(canvasHeightInput, previousHeight || DEFAULT_CANVAS_HEIGHT);

	// Reflect any clamping back into the inputs
	canvasWidthInput.value = width;
	canvasHeightInput.value = height;

	canvas.width = width;
	canvas.height = height;
	canvasContainer.style.width = `${width}px`;
	canvasContainer.style.height = `${height}px`;

	if (currentImage && drawnWidth > 0 && drawnHeight > 0) {
		const alignment = getActiveAlignment();
		if (alignment) {
			positionImage(alignment);
		} else {
			// Free-positioned image: keep its center at the same relative spot
			const relativeCenterX = (imageX + drawnWidth / 2) / previousWidth;
			const relativeCenterY = (imageY + drawnHeight / 2) / previousHeight;
			imageX = relativeCenterX * width - drawnWidth / 2;
			imageY = relativeCenterY * height - drawnHeight / 2;
		}
	}

	// Update responsive scaling before drawing so handles are sized for the new display scale
	scaleCanvasContainer();
	draw();
}

function alignImage(position = 'center') {
	if (!currentImage) return;
	setActiveAlignment(position);

	// First draw of a new image: fit it inside the canvas
	if (drawnWidth === 0 || drawnHeight === 0) {
		fitImageToCanvas();
	}

	positionImage(position);
	draw();
}

// ---------- Rendering ----------

// Draw the blurred, scaled background. The image is oversized by the blur radius on every
// side so the blur doesn't fade into the background color at the canvas edges.
function drawBlurredBackground(context, blurValue) {
	const { width, height } = context.canvas;
	const bleed = blurValue * 2;
	const coverWidth = width + bleed * 2;
	const coverHeight = height + bleed * 2;
	const imgAspect = currentImage.naturalWidth / currentImage.naturalHeight;

	let bgWidth, bgHeight;
	if (imgAspect > coverWidth / coverHeight) {
		bgHeight = coverHeight;
		bgWidth = bgHeight * imgAspect;
	} else {
		bgWidth = coverWidth;
		bgHeight = bgWidth / imgAspect;
	}
	bgWidth *= backgroundScale;
	bgHeight *= backgroundScale;

	// Follow the foreground image's position so the background shifts with it
	const normX = Math.max(0, Math.min(1, (imageX + drawnWidth / 2) / width));
	const normY = Math.max(0, Math.min(1, (imageY + drawnHeight / 2) / height));
	const bgX = -bleed + (coverWidth - bgWidth) * normX;
	const bgY = -bleed + (coverHeight - bgHeight) * normY;

	context.filter = `blur(${blurValue}px)`;
	context.drawImage(currentImage, bgX, bgY, bgWidth, bgHeight);
	context.filter = 'none';
}

// Render the full scene onto a 2D context. Handles are only drawn for the on-screen editor.
function renderScene(context, showEditorUI) {
	const { width, height } = context.canvas;
	context.clearRect(0, 0, width, height);
	context.fillStyle = bgColorInput.value;
	context.fillRect(0, 0, width, height);

	if (!currentImage) {
		if (showEditorUI) {
			context.fillStyle = '#999';
			context.textAlign = 'center';
			context.textBaseline = 'middle';
			context.font = `${Math.round(screenToCanvasLength(16))}px sans-serif`;
			context.fillText('Upload an image', width / 2, height / 2);
		}
		return;
	}

	const blurValue = parseInt(blurAmountInput.value, 10);
	if (blurValue > 0) {
		drawBlurredBackground(context, blurValue);
	}

	context.drawImage(currentImage, Math.round(imageX), Math.round(imageY), Math.round(drawnWidth), Math.round(drawnHeight));

	if (showEditorUI) {
		drawHandles(context);
	}
}

function draw() {
	renderScene(ctx, true);
}

function drawHandles(context) {
	if (showDebugUI) {
		context.strokeStyle = isPointOnImage(lastMousePos) ? 'rgba(0, 255, 0, 1)' : 'rgba(255, 0, 0, 0.5)';
		context.lineWidth = 2;
		context.strokeRect(imageX, imageY, drawnWidth, drawnHeight);
		context.fillStyle = 'rgba(255, 255, 0, 0.7)';
		context.beginPath();
		context.arc(lastMousePos.x, lastMousePos.y, 5, 0, Math.PI * 2);
		context.fill();
	}

	const handleSize = getHandleSize();
	const halfHandle = handleSize / 2;
	const inset = handleSize * 0.3;
	const handles = getHandlePositions();

	for (const corner in handles) {
		const { x, y } = handles[corner];

		// Handle body
		context.fillStyle = 'rgba(0, 123, 255, 0.85)';
		context.strokeStyle = 'white';
		context.lineWidth = screenToCanvasLength(2);
		context.beginPath();
		if (context.roundRect) {
			context.roundRect(x - halfHandle, y - halfHandle, handleSize, handleSize, screenToCanvasLength(4));
		} else {
			context.rect(x - halfHandle, y - halfHandle, handleSize, handleSize);
		}
		context.fill();
		context.stroke();

		// Diagonal indicator showing the resize direction
		context.strokeStyle = 'rgba(255, 255, 255, 0.7)';
		context.lineWidth = screenToCanvasLength(1.5);
		context.beginPath();
		if (corner === 'tl' || corner === 'br') {
			context.moveTo(x - halfHandle + inset, y - halfHandle + inset);
			context.lineTo(x + halfHandle - inset, y + halfHandle - inset);
		} else {
			context.moveTo(x + halfHandle - inset, y - halfHandle + inset);
			context.lineTo(x - halfHandle + inset, y + halfHandle - inset);
		}
		context.stroke();
	}
}

// ---------- Image loading ----------

function handleImageLoadFailure(message) {
	alert(message);
	draw();
}

function applyLoadedImage(img, url) {
	// Release the previous image's object URL
	if (currentImageUrl) {
		URL.revokeObjectURL(currentImageUrl);
	}
	currentImage = img;
	currentImageUrl = url;

	// Reset background scale
	blurScaleInput.value = 100;
	blurScaleValueSpan.textContent = '100%';
	backgroundScale = 1;

	// Reset image size so alignImage fits the new image
	drawnWidth = 0;
	drawnHeight = 0;

	alignImage('center');
	showMobileInstructions();
}

function loadImageFile(file) {
	if (!file || !file.type.startsWith('image/')) {
		alert('Please select a valid image file.');
		return;
	}

	// Ignore results from earlier loads that finish after a newer one starts
	const loadId = ++imageLoadId;
	const url = URL.createObjectURL(file);
	const img = new Image();
	img.onload = () => {
		if (loadId !== imageLoadId) {
			URL.revokeObjectURL(url);
			return;
		}
		applyLoadedImage(img, url);
	};
	img.onerror = () => {
		URL.revokeObjectURL(url);
		if (loadId === imageLoadId) {
			handleImageLoadFailure('Failed to load image. The file may be corrupt or in an unsupported format.');
		}
	};
	img.src = url;
}

function handleImageInputChange(event) {
	loadImageFile(event.target.files[0]);
	// Clear so selecting the same file again still triggers a change event
	event.target.value = '';
}

imageLoader.addEventListener('change', handleImageInputChange);

// ---------- Control inputs ----------

function handleDimensionInputChange() {
	sizePresetSelect.value = '';
	initializeCanvas();
}

function updateBlurValue() {
	blurValueSpan.textContent = `${blurAmountInput.value}px`;
	draw();
}

function updateBlurScale() {
	const value = blurScaleInput.value;
	backgroundScale = value / 100;
	blurScaleValueSpan.textContent = `${value}%`;
	draw();
}

function updateImageScale() {
	if (!currentImage) return;

	const value = parseInt(imageScaleInput.value, 10);
	const centerX = imageX + drawnWidth / 2;
	const centerY = imageY + drawnHeight / 2;

	setImageScale(value / 100);

	// Keep the current alignment, otherwise scale around the image's center
	const alignment = getActiveAlignment();
	if (alignment) {
		positionImage(alignment);
	} else {
		imageX = centerX - drawnWidth / 2;
		imageY = centerY - drawnHeight / 2;
	}

	imageScaleValueSpan.textContent = `${value}%`;
	draw();
}

// Resolve a preset value ("1920x1080" or "aspect_16_9") to canvas dimensions
function getPresetDimensions(value, currentWidth) {
	if (value.startsWith('aspect_')) {
		const parts = value.split('_');
		const ratioX = parseInt(parts[1], 10);
		const ratioY = parseInt(parts[2], 10);
		return { width: currentWidth, height: Math.round(currentWidth * ratioY / ratioX) };
	}
	const dims = value.split('x');
	return { width: parseInt(dims[0], 10), height: parseInt(dims[1], 10) };
}

// Copy the selected preset into the width/height inputs. Returns true if applied.
function applySelectedPreset() {
	const value = sizePresetSelect.value;
	if (!value) return false;

	const currentWidth = readDimension(canvasWidthInput, DEFAULT_CANVAS_WIDTH);
	const { width, height } = getPresetDimensions(value, currentWidth);
	if (!(width >= MIN_CANVAS_SIZE && height >= MIN_CANVAS_SIZE && width <= MAX_CANVAS_SIDE && height <= MAX_CANVAS_SIDE)) {
		console.warn(`Preset "${value}" resulted in invalid dimensions: ${width}x${height}`);
		return false;
	}

	canvasWidthInput.value = width;
	canvasHeightInput.value = height;
	return true;
}

function handlePresetChange() {
	if (applySelectedPreset()) {
		initializeCanvas();
	} else {
		sizePresetSelect.value = '';
	}
}

canvasWidthInput.addEventListener('change', handleDimensionInputChange);
canvasHeightInput.addEventListener('change', handleDimensionInputChange);
blurAmountInput.addEventListener('input', updateBlurValue);
blurScaleInput.addEventListener('input', updateBlurScale);
imageScaleInput.addEventListener('input', updateImageScale);
bgColorInput.addEventListener('input', draw);
sizePresetSelect.addEventListener('change', handlePresetChange);

// ---------- Canvas interaction (mouse + touch) ----------

function updateHoverCursor(pos) {
	if (!currentImage) {
		canvas.style.cursor = 'pointer';
		return;
	}
	const handle = getHandleUnderMouse(pos);
	if (handle) {
		canvas.style.cursor = getResizeCursor(handle);
	} else {
		canvas.style.cursor = isPointOnImage(pos) ? 'grab' : 'default';
	}
}

function startPinch(touches) {
	isPinching = true;
	isDragging = false;
	isResizing = false;
	initialPinchDistance = getTouchDistance(touches);
	initialScale = scale;
	initialImageX = imageX;
	initialImageY = imageY;
	initialDrawnWidth = drawnWidth;
	initialDrawnHeight = drawnHeight;

	// Pinch/zoom is free-form, so the image is no longer aligned
	setActiveAlignment(null);
}

function handleCanvasStart(e) {
	if (e.type === 'mousedown' && e.button !== 0) return;

	if (e.type === 'touchstart') {
		// Prevent scrolling/zooming the page while editing
		e.preventDefault();

		if (e.touches.length === 2 && currentImage) {
			startPinch(e.touches);
			return;
		}
	}

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
		canvas.style.cursor = getResizeCursor(activeHandle);
		resizeStartX = pos.x;
		resizeStartY = pos.y;
		initialImageX = imageX;
		initialImageY = imageY;
		initialDrawnWidth = drawnWidth;
		initialDrawnHeight = drawnHeight;
	} else if (isPointOnImage(pos)) {
		isDragging = true;
		isResizing = false;
		isPinching = false;

		// Offset from the pointer to the image origin
		startX = pos.x - imageX;
		startY = pos.y - imageY;

		canvas.classList.add('grabbing');
		canvas.style.cursor = 'grabbing';
	}
}

function handlePinchMove(touches) {
	if (!initialPinchDistance) return;

	const pinchRatio = getTouchDistance(touches) / initialPinchDistance;
	const center = getTouchCenter(touches);
	const minScale = getMinImageWidth() / currentImage.naturalWidth;
	const newScale = Math.max(minScale, Math.min(MAX_IMAGE_SCALE, initialScale * pinchRatio));

	// Keep the point under the pinch center anchored, using the image state from pinch start
	const anchorRatioX = (center.x - initialImageX) / initialDrawnWidth;
	const anchorRatioY = (center.y - initialImageY) / initialDrawnHeight;

	setImageScale(newScale);
	imageX = center.x - drawnWidth * anchorRatioX;
	imageY = center.y - drawnHeight * anchorRatioY;

	syncScaleSlider();
	draw();
}

function handleResizeMove(pos) {
	const dx = pos.x - resizeStartX;
	const aspect = currentImage.naturalWidth / currentImage.naturalHeight;
	const minWidth = getMinImageWidth();
	const snapThreshold = getSnapThreshold();
	const initialRight = initialImageX + initialDrawnWidth;
	const initialBottom = initialImageY + initialDrawnHeight;
	const anchorsLeft = activeHandle === 'tl' || activeHandle === 'bl';
	const anchorsTop = activeHandle === 'tl' || activeHandle === 'tr';

	// Width follows horizontal pointer movement; the opposite corner stays fixed
	let newWidth = Math.max(minWidth, anchorsLeft ? initialDrawnWidth - dx : initialDrawnWidth + dx);
	let newHeight = newWidth / aspect;
	let newX = anchorsLeft ? initialRight - newWidth : initialImageX;
	let newY = anchorsTop ? initialBottom - newHeight : initialImageY;

	// Snap the moving edges to the canvas edges
	let snappedWidth = null;
	if (anchorsLeft && Math.abs(newX) < snapThreshold) {
		snappedWidth = initialRight;
	} else if (!anchorsLeft && Math.abs(newX + newWidth - canvas.width) < snapThreshold) {
		snappedWidth = canvas.width - initialImageX;
	} else if (anchorsTop && Math.abs(newY) < snapThreshold) {
		snappedWidth = initialBottom * aspect;
	} else if (!anchorsTop && Math.abs(newY + newHeight - canvas.height) < snapThreshold) {
		snappedWidth = (canvas.height - initialImageY) * aspect;
	}

	if (snappedWidth !== null && snappedWidth >= minWidth) {
		newWidth = snappedWidth;
		newHeight = newWidth / aspect;
		newX = anchorsLeft ? initialRight - newWidth : initialImageX;
		newY = anchorsTop ? initialBottom - newHeight : initialImageY;
	}

	imageX = newX;
	imageY = newY;
	drawnWidth = newWidth;
	drawnHeight = newHeight;
	scale = drawnWidth / currentImage.naturalWidth;

	syncScaleSlider();
	draw();
}

function handleDragImageMove(pos) {
	const snapThreshold = getSnapThreshold();
	let targetX = pos.x - startX;
	let targetY = pos.y - startY;
	if (Math.abs(targetX) < snapThreshold) targetX = 0;
	if (Math.abs((targetX + drawnWidth) - canvas.width) < snapThreshold) targetX = canvas.width - drawnWidth;
	if (Math.abs(targetY) < snapThreshold) targetY = 0;
	if (Math.abs((targetY + drawnHeight) - canvas.height) < snapThreshold) targetY = canvas.height - drawnHeight;
	imageX = targetX;
	imageY = targetY;
	draw();
}

function handleCanvasMove(e) {
	const isTouch = e.type === 'touchmove';
	if (isTouch) {
		e.preventDefault();
	} else if (!isDragging && !isResizing && e.target !== canvas) {
		// Window-level mousemove with nothing to do
		return;
	}

	if (isTouch && isPinching) {
		if (e.touches.length === 2 && currentImage) {
			handlePinchMove(e.touches);
		}
		return;
	}

	const pos = isTouch ? getMousePos(e.touches[0]) : getMousePos(e);
	lastMousePos = pos;

	if (!currentImage) {
		if (e.target === canvas) updateHoverCursor(pos);
		return;
	}

	if (isResizing && activeHandle) {
		setActiveAlignment(null);
		handleResizeMove(pos);
	} else if (isDragging) {
		setActiveAlignment(null);
		handleDragImageMove(pos);
	} else if (!isTouch && e.target === canvas) {
		updateHoverCursor(pos);
		if (showDebugUI) draw();
	}
}

function endCanvasInteraction() {
	isDragging = false;
	isResizing = false;
	isPinching = false;
	activeHandle = null;
	canvas.classList.remove('grabbing');
}

function handleCanvasEnd(e) {
	// A finger was lifted but others remain on the screen
	if (e.type === 'touchend' && e.touches.length > 0) {
		if (isPinching && e.touches.length === 1) {
			// End the pinch and continue dragging with the remaining finger if it's on the image
			isPinching = false;
			const pos = getMousePos(e.touches[0]);
			if (isPointOnImage(pos)) {
				isDragging = true;
				startX = pos.x - imageX;
				startY = pos.y - imageY;
			}
		}
		return;
	}

	if (!isDragging && !isResizing && !isPinching) return;
	endCanvasInteraction();

	if (e.type === 'mouseup') {
		if (e.target === canvas) {
			updateHoverCursor(getMousePos(e));
		} else {
			canvas.style.cursor = 'default';
		}
	} else {
		draw();
	}
}

function handleCanvasMouseLeave() {
	// Mouse drags continue outside the canvas (tracked on window), so only reset the hover cursor
	if (!isDragging && !isResizing) {
		canvas.style.cursor = 'default';
	}
}

function handleCanvasTouchCancel() {
	endCanvasInteraction();
	draw();
}

// Mouse: movement and release are tracked on the window so a drag doesn't stop when the
// pointer passes over the controls panel or leaves the canvas.
canvas.addEventListener('mousedown', handleCanvasStart);
window.addEventListener('mousemove', handleCanvasMove);
window.addEventListener('mouseup', handleCanvasEnd);
canvas.addEventListener('mouseleave', handleCanvasMouseLeave);

// Touch: passive: false so preventDefault can stop page scrolling
canvas.addEventListener('touchstart', handleCanvasStart, { passive: false });
canvas.addEventListener('touchmove', handleCanvasMove, { passive: false });
canvas.addEventListener('touchend', handleCanvasEnd);
canvas.addEventListener('touchcancel', handleCanvasTouchCancel);

// ---------- Saving ----------

function downloadBlob(blob, filename) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	link.remove();
	// Give the browser time to start the download before releasing the blob
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function saveImage() {
	if (!currentImage) {
		alert('Please upload an image first.');
		return;
	}

	try {
		// Render to an offscreen canvas so the resize handles aren't included
		const exportCanvas = document.createElement('canvas');
		exportCanvas.width = canvas.width;
		exportCanvas.height = canvas.height;
		const exportCtx = exportCanvas.getContext('2d');
		if (!exportCtx) {
			throw new Error('Could not create a drawing context for export.');
		}
		renderScene(exportCtx, false);

		exportCanvas.toBlob((blob) => {
			if (!blob) {
				alert(`Could not export a ${exportCanvas.width}×${exportCanvas.height} image. It may be too large for this browser — try a smaller size.`);
				return;
			}
			downloadBlob(blob, `${Date.now()}.png`);
		}, 'image/png');
	} catch (error) {
		console.error('Error during saving:', error);
		if (error.name === 'SecurityError') {
			alert('Could not save the image due to security restrictions (cross-origin image). Please upload from your device.');
		} else {
			alert('Could not save the image. Error: ' + error.message);
		}
	}
}

saveButton.addEventListener('click', saveImage);

// ---------- Controls panel dragging ----------

let isDraggingControls = false;
let controlsStartX, controlsStartY;
let controlsInitialRight, controlsInitialTop;

function isInteractiveElement(element) {
	return !!element.closest('input, button, select, option, label, textarea, a');
}

function handleDragStart(e) {
	if (e.type === 'mousedown' && e.button !== 0) return;
	if (isInteractiveElement(e.target)) return;

	// On touch, only the header drags the panel so the content area can still scroll
	if (e.type === 'touchstart' && !e.target.closest('.controls-header')) return;

	isDraggingControls = true;

	const point = e.type === 'mousedown' ? e : e.touches[0];
	controlsStartX = point.clientX;
	controlsStartY = point.clientY;

	const rect = controlsPanel.getBoundingClientRect();
	controlsInitialRight = window.innerWidth - rect.right;
	controlsInitialTop = rect.top;

	e.preventDefault();
}

function handleDragMove(e) {
	if (!isDraggingControls) return;

	const point = e.type === 'mousemove' ? e : e.touches[0];
	const dx = point.clientX - controlsStartX;
	const dy = point.clientY - controlsStartY;

	// The panel may be moved partially outside the window; the reset button brings it back
	controlsPanel.style.right = `${controlsInitialRight - dx}px`;
	controlsPanel.style.left = 'auto';
	controlsPanel.style.top = `${controlsInitialTop + dy}px`;
}

function handleDragEnd() {
	if (!isDraggingControls) return;
	isDraggingControls = false;
	saveControlsPosition();
}

controlsPanel.addEventListener('mousedown', handleDragStart);
document.addEventListener('mousemove', handleDragMove);
document.addEventListener('mouseup', handleDragEnd);
controlsPanel.addEventListener('touchstart', handleDragStart, { passive: false });
document.addEventListener('touchmove', handleDragMove, { passive: false });
document.addEventListener('touchend', handleDragEnd);
document.addEventListener('touchcancel', handleDragEnd);

// Reset controls panel to default position
function resetControlsPosition() {
	controlsPanel.style.right = '65px';
	controlsPanel.style.top = '65px';
	removeStorage('controlsPosRight');
	removeStorage('controlsPosTop');
}

function saveControlsPosition() {
	writeStorage('controlsPosRight', controlsPanel.style.right);
	writeStorage('controlsPosTop', controlsPanel.style.top);
}

resetControlsBtn.addEventListener('click', resetControlsPosition);

// ---------- Alignment and fit buttons ----------

function handleAlignButtonClick(e) {
	// currentTarget is always the button, even if the click landed on its icon
	const alignPosition = e.currentTarget.dataset.align;
	if (!currentImage) {
		alert('Please upload an image first.');
		return;
	}
	alignImage(alignPosition);
}

alignButtons.forEach(button => {
	button.addEventListener('click', handleAlignButtonClick);
});

// Resize the image to fill one canvas dimension, keeping the current alignment
function fitImage(dimension) {
	if (!currentImage) {
		alert('Please upload an image first.');
		return;
	}

	if (dimension === 'width') {
		setImageScale(canvas.width / currentImage.naturalWidth);
	} else {
		setImageScale(canvas.height / currentImage.naturalHeight);
	}
	syncScaleSlider();
	alignImage(getActiveAlignment() || 'center');
}

function fitImageWidth() {
	fitImage('width');
}

function fitImageHeight() {
	fitImage('height');
}

fitWidthBtn.addEventListener('click', fitImageWidth);
fitHeightBtn.addEventListener('click', fitImageHeight);

// ---------- Responsive canvas scaling ----------

function scaleCanvasContainer() {
	const maxViewportWidth = window.innerWidth * 0.85;
	const maxViewportHeight = window.innerHeight * 0.75;

	// Include the canvas padding/border so the whole frame fits on screen
	const frameWidth = canvas.offsetWidth || canvas.width;
	const frameHeight = canvas.offsetHeight || canvas.height;

	const newScale = Math.min(1, maxViewportWidth / frameWidth, maxViewportHeight / frameHeight);

	if (newScale < 1) {
		const scaledWidth = canvas.width * newScale;
		const scaledHeight = canvas.height * newScale;
		canvasContainer.style.transform = `scale(${newScale})`;
		canvasContainer.style.margin = `${(canvas.height - scaledHeight) / 2}px ${(canvas.width - scaledWidth) / 2}px`;
	} else {
		canvasContainer.style.transform = 'none';
		canvasContainer.style.margin = '0';
	}

	displayScale = newScale;
}

function handleWindowResize() {
	scaleCanvasContainer();
	// Handle sizes depend on the display scale
	draw();
}

window.addEventListener('resize', handleWindowResize);

// ---------- Drag and drop ----------

function handleEditorDragOver(e) {
	e.preventDefault();
	e.stopPropagation();
	editorArea.classList.add('drag-over');
}

function handleEditorDragLeave(e) {
	e.preventDefault();
	e.stopPropagation();
	// Ignore dragleave events fired when moving between child elements
	if (editorArea.contains(e.relatedTarget)) return;
	editorArea.classList.remove('drag-over');
}

function handleEditorDrop(e) {
	e.preventDefault();
	e.stopPropagation();
	editorArea.classList.remove('drag-over');

	const files = e.dataTransfer.files;
	if (files.length === 0) return;
	if (!files[0].type.startsWith('image/')) {
		alert('Please drop an image file.');
		return;
	}
	loadImageFile(files[0]);
}

editorArea.addEventListener('dragover', handleEditorDragOver);
editorArea.addEventListener('dragleave', handleEditorDragLeave);
editorArea.addEventListener('drop', handleEditorDrop);

// ---------- Theme ----------

function toggleTheme() {
	const html = document.documentElement;
	const newTheme = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
	html.setAttribute('data-theme', newTheme);
	writeStorage('theme', newTheme);
}

function initTheme() {
	const savedTheme = readStorage('theme');
	if (savedTheme === 'light' || savedTheme === 'dark') {
		document.documentElement.setAttribute('data-theme', savedTheme);
	} else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
		// If no saved preference, use system preference
		document.documentElement.setAttribute('data-theme', 'dark');
	}
}

themeToggle.addEventListener('click', toggleTheme);

// ---------- Controls panel state ----------

function toggleControlsPanel() {
	controlsPanel.classList.toggle('collapsed');
	const isCollapsed = controlsPanel.classList.contains('collapsed');
	writeStorage('controlsCollapsed', isCollapsed ? 'true' : 'false');
}

function initControlsState() {
	if (readStorage('controlsCollapsed') === 'true') {
		controlsPanel.classList.add('collapsed');
	}

	const savedPosRight = readStorage('controlsPosRight');
	const savedPosTop = readStorage('controlsPosTop');
	if (savedPosRight && savedPosTop) {
		controlsPanel.style.right = savedPosRight;
		controlsPanel.style.top = savedPosTop;
	}
}

toggleControlsBtn.addEventListener('click', toggleControlsPanel);

// ---------- Offline status ----------

function showOfflineNotice() {
	// Avoid stacking notices if the connection drops repeatedly
	if (document.getElementById('offline-notice')) return;

	const offlineNotice = document.createElement('div');
	offlineNotice.id = 'offline-notice';
	offlineNotice.style.backgroundColor = 'rgba(0,0,0,0.7)';
	offlineNotice.style.borderRadius = '4px';
	offlineNotice.style.bottom = '20px';
	offlineNotice.style.color = 'white';
	offlineNotice.style.fontSize = '14px';
	offlineNotice.style.left = '20px';
	offlineNotice.style.padding = '8px 16px';
	offlineNotice.style.position = 'fixed';
	offlineNotice.style.zIndex = '9999';
	offlineNotice.textContent = 'You are currently offline. The app will continue to work.';
	document.body.appendChild(offlineNotice);

	setTimeout(() => offlineNotice.remove(), 5000);
}

window.addEventListener('offline', showOfflineNotice);

// ---------- Startup ----------

initTheme();
initControlsState();
setActiveAlignment('center');
applySelectedPreset();
initializeCanvas();
