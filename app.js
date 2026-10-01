// CineSnap - Application Logic

/* --- State Management --- */
let db = null;
let currentFile = null;
let activeVideoName = "";
let isPlaying = false;
let duration = 0;
let isSeeking = false;
let mainVideoFrameRate = 23.976; // Default movie frame rate

// Zoom/Pan State
let currentZoom = 1;
let isDragging = false;
let startX = 0, startY = 0;
let panX = 0, panY = 0;

// Scanner State
let isScanning = false;
let scannerVideo = null;
let scannerCanvas = null;
let scannerCtx = null;
let lastFrameData = null;
let scanCurrentTime = 0;
let scanInterval = 5; // Scan every 5 seconds
let detectedShots = []; // Array of { time, thumbUrl }
let scenePartitions = [0]; // Dynamic scene start times (always starts with 0)
let sceneTimeBlockSize = 300; // Fallback max scene duration in seconds (5 minutes)
let currentExpandedSceneIdx = -1; // Index of the scene currently being viewed in detail
let currentWorkspace = 'import'; // Active workflow phase workspace

// Explorer Video State (for adjacent frames)
let explorerVideo = null;
let explorerCanvas = null;
let explorerCtx = null;
let adjacentOffsetTime = 0; // Cumulative offset for unsynced adjacent scrubbing

// Keyboard Customization State
const DEFAULT_SHORTCUTS = {
  playPause: { label: "Play / Pause", key: " ", shift: false, alt: false, ctrl: false },
  stepForward1f: { label: "Step Forward 1 Frame", key: "ArrowRight", shift: false, alt: false, ctrl: false },
  stepBackward1f: { label: "Step Backward 1 Frame", key: "ArrowLeft", shift: false, alt: false, ctrl: false },
  stepForward10f: { label: "Step Forward 10 Frames", key: "ArrowRight", shift: true, alt: false, ctrl: false },
  stepBackward10f: { label: "Step Backward 10 Frames", key: "ArrowLeft", shift: true, alt: false, ctrl: false },
  stepForward1s: { label: "Step Forward 1 Second", key: "ArrowRight", shift: false, alt: true, ctrl: false },
  stepBackward1s: { label: "Step Backward 1 Second", key: "ArrowLeft", shift: false, alt: true, ctrl: false },
  stepForward10s: { label: "Step Forward 10 Seconds", key: "ArrowRight", shift: false, alt: false, ctrl: true },
  stepBackward10s: { label: "Step Backward 10 Seconds", key: "ArrowLeft", shift: false, alt: false, ctrl: true },
  stepForward30s: { label: "Step Forward 30 Seconds", key: "ArrowRight", shift: true, alt: false, ctrl: true },
  stepBackward30s: { label: "Step Backward 30 Seconds", key: "ArrowLeft", shift: true, alt: false, ctrl: true },
  grabFrame: { label: "Grab Frame", key: "s", shift: false, alt: false, ctrl: false },
  toggleZoom: { label: "Toggle Zoom", key: "z", shift: false, alt: false, ctrl: false }
};

let shortcuts = JSON.parse(JSON.stringify(DEFAULT_SHORTCUTS)); // Deep clone
let activeRecordAction = null; // Currently recording action keybind

// DOM Elements
const dropZone = document.getElementById('drop-zone');
const videoInput = document.getElementById('video-input');
const mainVideo = document.getElementById('main-video');
const videoContainer = document.getElementById('video-container');
const placeholderView = document.getElementById('placeholder-view');
const controlsPanel = document.getElementById('controls-panel');
const timeCurrent = document.getElementById('time-current');
const timeDuration = document.getElementById('time-duration');
const videoScrubber = document.getElementById('video-scrubber');
const progressBarFill = document.getElementById('progress-bar-fill');
const speedSelect = document.getElementById('speed-select');
const zoomSelect = document.getElementById('zoom-select');
const zoomHud = document.getElementById('zoom-hud');
const zoomHudText = document.getElementById('zoom-hud-text');
const videoLoading = document.getElementById('video-loading');

// Button DOM Elements
const btnPlayPause = document.getElementById('btn-play-pause');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const btnCapture = document.getElementById('btn-capture');
const btnDownloadAll = document.getElementById('btn-download-all');
const btnShortcuts = document.getElementById('btn-shortcuts');
const btnCopyFfmpeg = document.getElementById('btn-copy-ffmpeg');
const copyToast = document.getElementById('copy-toast');

// Dialog Elements
const shortcutsDialog = document.getElementById('shortcuts-dialog');
const btnCloseShortcuts = document.getElementById('btn-close-shortcuts');
const btnCloseShortcutsFooter = document.getElementById('btn-close-shortcuts-footer');

// Gallery Sidebar Elements
const galleryItemsContainer = document.getElementById('gallery-items-container');
const galleryEmptyView = document.getElementById('gallery-empty-view');
const galleryCountBadge = document.getElementById('gallery-count');

// Adjacent Frames Elements
const adjacentFramesPanel = document.getElementById('adjacent-frames-panel');
const adjacentFramesStrip = document.getElementById('adjacent-frames-strip');

// Scanner UI Elements
const scannerControls = document.getElementById('scanner-controls');
const overviewViewOptions = document.getElementById('overview-view-options');
const sceneThumbSizeSelect = document.getElementById('scene-thumb-size');
const sceneViewModeSelect = document.getElementById('scene-view-mode');
const btnToggleLayout = document.getElementById('btn-toggle-layout');
const btnCollapseOverview = document.getElementById('btn-collapse-overview');
const btnCollapseAdjacent = document.getElementById('btn-collapse-adjacent');
const mainLayout = document.getElementById('main-layout');
const adjacentStepSelect = document.getElementById('adjacent-step-select');
const scannerStatusBadge = document.getElementById('scanner-status');
const btnToggleScan = document.getElementById('btn-toggle-scan');
const scanToggleText = document.getElementById('scan-toggle-text');
const sensitivitySelect = document.getElementById('sensitivity-select');
const scanModeSelect = document.getElementById('scan-mode-select');
const scanProgressContainer = document.getElementById('scan-progress-container');
const scanProgressFill = document.getElementById('scan-progress-fill');
const scanPercentText = document.getElementById('scan-percent-text');

// Overview Navigation / Tabs
const overviewTabsContainer = document.getElementById('overview-tabs-container');
const tabScenesBtn = document.getElementById('tab-scenes');
const tabShotsBtn = document.getElementById('tab-shots');
const tabShotsTitle = document.getElementById('tab-shots-title');
const btnBackToScenes = document.getElementById('btn-back-to-scenes');
const overviewContentView = document.getElementById('overview-content-view');

// Resizer DOM Elements & Resize state
const overviewPanel = document.getElementById('overview-panel');
const resizerY = document.getElementById('resizer-y');
const galleryPanel = document.getElementById('gallery-panel');
const resizerX = document.getElementById('resizer-x');

// Hover Preview Elements
const scrubPreview = document.getElementById('scrub-preview');
const scrubPreviewCanvas = document.getElementById('scrub-preview-canvas');
const scrubPreviewTime = document.getElementById('scrub-preview-time');
let scrubPreviewCtx = null;

// Remapping Shortcuts Dialog Elements
const shortcutsBindingList = document.getElementById('shortcuts-binding-list');
const btnResetShortcuts = document.getElementById('btn-reset-shortcuts');

let isResizingY = false;
let isResizingX = false;


/* --- 1. IndexedDB Implementation --- */
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('CineSnapDB', 1);
    request.onerror = (e) => reject(e);
    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    request.onupgradeneeded = (e) => {
      const dbInstance = e.target.result;
      const store = dbInstance.createObjectStore('screenshots', { keyPath: 'id', autoIncrement: true });
      store.createIndex('videoName', 'videoName', { unique: false });
    };
  });
}

function saveScreenshot(videoName, timestamp, timestampFormatted, blob, thumbnailUrl, title, resolution) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['screenshots'], 'readwrite');
    const store = transaction.objectStore('screenshots');
    const record = {
      videoName,
      timestamp,
      timestampFormatted,
      blob,
      thumbnailUrl,
      title,
      resolution,
      dateAdded: Date.now()
    };
    const request = store.add(record);
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e);
  });
}

function getScreenshots(videoName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['screenshots'], 'readonly');
    const store = transaction.objectStore('screenshots');
    const index = store.index('videoName');
    const request = index.getAll(videoName);
    request.onsuccess = () => {
      // Sort by timestamp
      const sorted = request.result.sort((a, b) => a.timestamp - b.timestamp);
      resolve(sorted);
    };
    request.onerror = (e) => reject(e);
  });
}

function updateScreenshotTitle(id, title) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['screenshots'], 'readwrite');
    const store = transaction.objectStore('screenshots');
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const data = getReq.result;
      if (data) {
        data.title = title;
        const putReq = store.put(data);
        putReq.onsuccess = () => resolve();
        putReq.onerror = (e) => reject(e);
      } else {
        reject(new Error('Record not found'));
      }
    };
  });
}

function deleteScreenshot(id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['screenshots'], 'readwrite');
    const store = transaction.objectStore('screenshots');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e);
  });
}


/* --- 2. Initial Setup --- */
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Lucide Icons
  lucide.createIcons();
  
  // Initialize Hover Preview Context
  if (scrubPreviewCanvas) scrubPreviewCtx = scrubPreviewCanvas.getContext('2d');
  
  // Load Custom Keybinds from LocalStorage
  loadCustomShortcuts();
  
  // Restore last selected workspace
  const savedWS = localStorage.getItem('cinesnap_workspace') || 'import';
  switchWorkspace(savedWS);

  // Restore layout split state (defaults to true / split layout)
  const savedLayout = localStorage.getItem('cinesnap_layout_split') !== 'false';
  if (savedLayout) {
    mainLayout.classList.add('layout-split');
    const icon = btnToggleLayout.querySelector('i');
    const label = btnToggleLayout.querySelector('span');
    if (icon) icon.setAttribute('data-lucide', 'layout-list');
    if (label) label.textContent = "Stacked Layout";
    overviewPanel.style.width = '320px';
    overviewPanel.style.height = '';
    lucide.createIcons();
  } else {
    mainLayout.classList.remove('layout-split');
    const icon = btnToggleLayout.querySelector('i');
    const label = btnToggleLayout.querySelector('span');
    if (icon) icon.setAttribute('data-lucide', 'columns-2');
    if (label) label.textContent = "Split Screen";
    overviewPanel.style.height = '160px';
    overviewPanel.style.width = '';
    lucide.createIcons();
  }

  // Restore scenes size/mode configurations
  const savedSize = localStorage.getItem('cinesnap_scene_size') || 'medium';
  const savedMode = localStorage.getItem('cinesnap_scene_mode') || 'grid';
  if (sceneThumbSizeSelect) sceneThumbSizeSelect.value = savedSize;
  if (sceneViewModeSelect) sceneViewModeSelect.value = savedMode;
  if (overviewContentView) {
    overviewContentView.className = `overview-content thumb-${savedSize}`;
  }

  // Initialize Database
  try {
    await initDB();
    console.log("IndexedDB Initialized Successfully");
  } catch (err) {
    console.error("IndexedDB Failed to Initialize", err);
  }
  
  // Set up events
  setupEvents();
});


/* --- 3. Event Listeners --- */
function setupEvents() {
  // File Loading Event Listeners
  videoInput.addEventListener('change', handleFileSelect);
  
  // Drag and Drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });
  
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('video/')) {
        loadVideoFile(file);
      } else {
        alert("Please load a valid video file.");
      }
    }
  });

  // Ffmpeg copy button
  btnCopyFfmpeg.addEventListener('click', (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText("ffmpeg -i input.mkv -c copy output.mp4");
    showToast();
  });

  // Playback Control Buttons
  btnPlayPause.addEventListener('click', togglePlay);
  
  // Video events
  mainVideo.addEventListener('loadedmetadata', handleVideoMetadata);
  mainVideo.addEventListener('timeupdate', handleVideoTimeUpdate);
  mainVideo.addEventListener('seeked', () => {
    videoLoading.classList.add('hidden');
    adjacentOffsetTime = 0; // Reset local offset on main player seek
    renderAdjacentFrames();
    
    if (pendingSeekTime !== null) {
      const target = pendingSeekTime;
      pendingSeekTime = null;
      mainVideo.currentTime = target;
    }
  });
  
  // Speed selection
  speedSelect.addEventListener('change', (e) => {
    mainVideo.playbackRate = parseFloat(e.target.value);
  });
  
  // Zoom selection
  zoomSelect.addEventListener('change', (e) => {
    setZoom(parseFloat(e.target.value));
  });

  // Frame Stepping Button mapping
  document.getElementById('btn-step-back-1f').addEventListener('click', () => stepFrames(-1));
  document.getElementById('btn-step-forward-1f').addEventListener('click', () => stepFrames(1));
  document.getElementById('btn-step-back-10f').addEventListener('click', () => stepFrames(-10));
  document.getElementById('btn-step-forward-10f').addEventListener('click', () => stepFrames(10));
  document.getElementById('btn-step-back-1s').addEventListener('click', () => jumpTime(-1));
  document.getElementById('btn-step-forward-1s').addEventListener('click', () => jumpTime(1));
  document.getElementById('btn-jump-back-10').addEventListener('click', () => jumpTime(-10));
  document.getElementById('btn-jump-forward-10').addEventListener('click', () => jumpTime(10));
  
  // Capture
  btnCapture.addEventListener('click', captureCurrentFrame);
  
  // Scrubber dragging
  videoScrubber.addEventListener('input', (e) => {
    if (!duration) return;
    const seekTime = (parseFloat(e.target.value) / 100) * duration;
    timeCurrent.textContent = formatTime(seekTime);
    progressBarFill.style.width = e.target.value + '%';
  });

  videoScrubber.addEventListener('change', (e) => {
    if (!duration) return;
    isSeeking = true;
    mainVideo.currentTime = (parseFloat(e.target.value) / 100) * duration;
    isSeeking = false;
  });

  // Scrubber Hover Preview
  videoScrubber.addEventListener('mouseenter', showScrubPreview);
  videoScrubber.addEventListener('mouseleave', hideScrubPreview);
  videoScrubber.addEventListener('mousemove', updateScrubPreview);

  // Zoom Drag (Pan) logic
  videoContainer.addEventListener('mousedown', startPanDrag);
  window.addEventListener('mousemove', panDrag);
  window.addEventListener('mouseup', endPanDrag);

  // Gallery Download All
  btnDownloadAll.addEventListener('click', downloadAllAsZip);

  // Shortcuts Dialog
  btnShortcuts.addEventListener('click', () => shortcutsDialog.showModal());
  btnCloseShortcuts.addEventListener('click', () => shortcutsDialog.close());
  btnCloseShortcutsFooter.addEventListener('click', () => shortcutsDialog.close());
  btnResetShortcuts.addEventListener('click', resetDefaultShortcuts);
  
  // Close dialog on clicking backdrop
  shortcutsDialog.addEventListener('click', (e) => {
    const rect = shortcutsDialog.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
      shortcutsDialog.close();
    }
  });

  // Overview Tab Switching
  tabScenesBtn.addEventListener('click', showScenesOverview);
  btnBackToScenes.addEventListener('click', showScenesOverview);
  
  // Background scanner controls
  btnToggleScan.addEventListener('click', toggleBackgroundScan);
  sensitivitySelect.addEventListener('change', () => {
    if (isScanning) {
      // Restart scan with new sensitivity if currently running
      stopBackgroundScan();
      startBackgroundScan();
    }
  });

  // Workspace tabs click listeners
  document.querySelectorAll('.ws-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchWorkspace(tab.getAttribute('data-ws'));
    });
  });

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', handleKeyboardShortcuts);

  // Layout switcher trigger
  btnToggleLayout.addEventListener('click', toggleWorkspaceLayout);

  // Panel Collapse triggers
  btnCollapseOverview.addEventListener('click', toggleCollapseOverview);
  btnCollapseAdjacent.addEventListener('click', toggleCollapseAdjacent);

  // Scenes view mode & size changes
  sceneThumbSizeSelect.addEventListener('change', updateScenesViewSettings);
  sceneViewModeSelect.addEventListener('change', updateScenesViewSettings);

  // Adjacent Frames step change
  adjacentStepSelect.addEventListener('change', () => {
    renderAdjacentFrames();
  });

  // Adjacent frames panel wheel scroll scrubbing (unsynced)
  adjacentFramesPanel.addEventListener('wheel', (e) => {
    e.preventDefault();
    const direction = Math.sign(e.deltaY || e.deltaX);
    if (direction !== 0) {
      scrubAdjacentUnsynced(direction);
    }
  }, { passive: false });

  // Video container wheel swipe scrubbing & pinch-to-zoom gestures
  let scrollScrubAccumulator = 0;
  const SCROLL_SCRUB_THRESHOLD = 30;
  
  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      // Pinch to Zoom
      const zoomDelta = -e.deltaY * 0.015;
      let newZoom = currentZoom + zoomDelta;
      newZoom = Math.max(1, Math.min(10, newZoom));
      setZoom(newZoom);
      if (zoomSelect) zoomSelect.value = String(Math.round(newZoom));
    }
  }, { passive: false });

  videoContainer.addEventListener('wheel', (e) => {
    if (e.ctrlKey) return; // Handled by global window listener
    
    // Swipe left/right to scrub playhead
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault();
      scrollScrubAccumulator += e.deltaX;
      
      if (Math.abs(scrollScrubAccumulator) >= SCROLL_SCRUB_THRESHOLD) {
        const direction = Math.sign(scrollScrubAccumulator);
        scrollScrubAccumulator = 0;
        scrubByStep(direction);
      }
    }
  }, { passive: false });

  // Playback panel double click grabs frame
  videoContainer.addEventListener('dblclick', (e) => {
    e.preventDefault();
    captureCurrentFrame();
  });

  // Panel Resizing Event Listeners
  resizerY.addEventListener('mousedown', startResizeY);
  resizerX.addEventListener('mousedown', startResizeX);
  
  window.addEventListener('mousemove', handleResize);
  window.addEventListener('mouseup', stopResize);
}


/* --- 4. Video Loading Logic --- */
function handleFileSelect(e) {
  if (e.target.files.length > 0) {
    loadVideoFile(e.target.files[0]);
  }
}

function loadVideoFile(file) {
  currentFile = file;
  activeVideoName = file.name;
  
  // Stop background scanning of any previous video
  stopBackgroundScan();
  detectedShots = [];
  scenePartitions = [0];
  currentExpandedSceneIdx = -1;
  thumbnailCache.clear(); // Clear thumbnail memory cache for new video
  
  // Hide placeholder, show video layout
  placeholderView.classList.add('hidden');
  videoContainer.classList.remove('hidden');
  controlsPanel.classList.remove('disabled');
  
  // Create object URL
  const videoUrl = URL.createObjectURL(file);
  mainVideo.src = videoUrl;
  mainVideo.playbackRate = parseFloat(speedSelect.value);
  
  // Initialize Secondary Background Videos
  initBackgroundVideos(videoUrl);
  
  // Reset zoom
  setZoom(1);
  zoomSelect.value = "1";
  
  // Update UI & load from cache
  refreshGalleryView();
  
  // Reset Scanner UI
  scannerControls.classList.remove('hidden');
  if (overviewViewOptions) overviewViewOptions.classList.remove('hidden');
  scannerStatusBadge.textContent = "Ready to Scan";
  scannerStatusBadge.className = "badge badge-outline";
  scanProgressContainer.classList.add('hidden');
  scanProgressFill.style.width = "0%";
  scanPercentText.textContent = "0%";
  
  // Set overview empty state while preparing
  overviewContentView.innerHTML = `
    <div class="overview-empty-state">
      <p>Film loaded! Hit <strong>Scan Film</strong> below to detect visual scenes and camera cuts.</p>
    </div>
  `;
}

function initBackgroundVideos(url) {
  // Explorer Video (Adjacent frame generator)
  if (explorerVideo) {
    explorerVideo.src = "";
  }
  explorerVideo = document.createElement('video');
  explorerVideo.src = url;
  explorerVideo.muted = true;
  explorerVideo.playsInline = true;
  explorerVideo.preload = "auto";
  
  explorerCanvas = document.createElement('canvas');
  explorerCtx = explorerCanvas.getContext('2d');
  
  // Scanner Video (Background scene analyzer)
  if (scannerVideo) {
    scannerVideo.src = "";
  }
  scannerVideo = document.createElement('video');
  scannerVideo.src = url;
  scannerVideo.muted = true;
  scannerVideo.playsInline = true;
  scannerVideo.preload = "auto";
  
  scannerCanvas = document.createElement('canvas');
  scannerCanvas.width = 30; // Small resolution for rapid delta calculation
  scannerCanvas.height = 20;
  scannerCtx = scannerCanvas.getContext('2d');
  
  // Listen to scanner events
  scannerVideo.addEventListener('seeked', handleScannerVideoSeeked);
}

function handleVideoMetadata() {
  duration = mainVideo.duration;
  timeDuration.textContent = formatTime(duration);
  timeCurrent.textContent = formatTime(0);
  
  videoScrubber.disabled = false;
  videoScrubber.value = "0";
  progressBarFill.style.width = "0%";
  
  // Check frame rate estimate
  // High-res films are typically 23.976 fps. Standard files are 24, 25, 29.97, or 30 fps.
  // We default to 23.976, which is standard cinematic.
  mainVideoFrameRate = 23.976;
}

function handleVideoTimeUpdate() {
  if (isSeeking || !duration) return;
  
  const pct = (mainVideo.currentTime / duration) * 100;
  videoScrubber.value = pct.toFixed(3);
  progressBarFill.style.width = pct.toFixed(3) + '%';
  timeCurrent.textContent = formatTime(mainVideo.currentTime);
}


/* --- 5. Custom Controls Operations --- */
function togglePlay() {
  if (!currentFile) return;
  
  if (isPlaying) {
    mainVideo.pause();
    isPlaying = false;
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    renderAdjacentFrames();
  } else {
    if (currentWorkspace === 'import') {
      switchWorkspace('capture');
    }
    mainVideo.play();
    isPlaying = true;
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
  }
}

function stepFrames(frameCount) {
  if (!currentFile) return;
  
  // Pause playback if playing
  if (isPlaying) togglePlay();
  
  const stepTime = 1 / mainVideoFrameRate;
  let targetTime = mainVideo.currentTime + (frameCount * stepTime);
  
  // Clamp boundaries
  targetTime = Math.max(0, Math.min(duration, targetTime));
  mainVideo.currentTime = targetTime;
}

function jumpTime(seconds) {
  if (!currentFile) return;
  
  let targetTime = mainVideo.currentTime + seconds;
  targetTime = Math.max(0, Math.min(duration, targetTime));
  mainVideo.currentTime = targetTime;
}


/* --- 6. Zoom & Pan HUD Operations --- */
function setZoom(scale) {
  currentZoom = scale;
  
  if (scale === 1) {
    panX = 0;
    panY = 0;
    mainVideo.style.transform = `scale(1) translate(0px, 0px)`;
    mainVideo.classList.remove('zoomable');
    zoomHud.classList.add('hidden');
  } else {
    mainVideo.style.transform = `scale(${currentZoom}) translate(${panX}px, ${panY}px)`;
    mainVideo.classList.add('zoomable');
    zoomHud.classList.remove('hidden');
    zoomHudText.textContent = `Zoom: ${scale}x`;
  }
}

function startPanDrag(e) {
  if (currentZoom === 1) return;
  e.preventDefault();
  isDragging = true;
  startX = e.clientX - panX;
  startY = e.clientY - panY;
}

function panDrag(e) {
  if (!isDragging) return;
  
  // Compute new offset
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  
  // Restrict panning boundary so they don't drag frame off-screen
  // Max bounds depend on screen size and scale
  const limitX = (mainVideo.clientWidth * (currentZoom - 1)) / (2 * currentZoom);
  const limitY = (mainVideo.clientHeight * (currentZoom - 1)) / (2 * currentZoom);
  
  panX = Math.max(-limitX, Math.min(limitX, dx));
  panY = Math.max(-limitY, Math.min(limitY, dy));
  
  mainVideo.style.transform = `scale(${currentZoom}) translate(${panX}px, ${panY}px)`;
}

function endPanDrag() {
  isDragging = false;
}


/* --- 7. Adjacent Frame Explorer --- */
let renderAdjacentTimeout = null;

function renderAdjacentFrames() {
  if (!currentFile || isPlaying) return;
  
  adjacentFramesPanel.classList.remove('hidden');
  
  if (renderAdjacentTimeout) {
    clearTimeout(renderAdjacentTimeout);
  }
  
  renderAdjacentTimeout = setTimeout(async () => {
    // Check playback state again after timeout
    if (isPlaying) return;
    
    adjacentFramesStrip.innerHTML = '<div style="grid-column: span 7; text-align: center; font-size: 0.8rem; color: var(--text-secondary); padding: 20px 0;">Rendering frames...</div>';
    
    const stepVal = adjacentStepSelect ? adjacentStepSelect.value : '1f';
    let stepInterval = 1 / mainVideoFrameRate; // Default 1 frame
    
    if (stepVal === '10f') {
      stepInterval = 10 / mainVideoFrameRate;
    } else if (stepVal === '1s') {
      stepInterval = 1.0;
    } else if (stepVal === '5s') {
      stepInterval = 5.0;
    } else if (stepVal === '10s') {
      stepInterval = 10.0;
    }
    
    const currentTime = mainVideo.currentTime + adjacentOffsetTime;
    const offsets = [-3, -2, -1, 0, 1, 2, 3];
    const renderedFrames = [];
    
    // Generate each adjacent frame canvas
    for (let i = 0; i < offsets.length; i++) {
      const offset = offsets[i];
      const targetTime = Math.max(0, Math.min(duration, currentTime + (offset * stepInterval)));
      
      try {
        const dataUrl = await generateFrameThumbnail(targetTime, 160, 90);
        renderedFrames.push({
          offset,
          time: targetTime,
          dataUrl
        });
      } catch (err) {
        console.error("Failed to render adjacent frame", offset, err);
        renderedFrames.push({
          offset,
          time: targetTime,
          dataUrl: null
        });
      }
    }
    
    // Check playback state one more time before DOM insertion
    if (isPlaying) return;
    
    // Display the frames
    adjacentFramesStrip.innerHTML = '';
    renderedFrames.forEach(frame => {
      const card = document.createElement('div');
      card.className = `frame-strip-card ${(frame.offset === 0 && adjacentOffsetTime === 0) ? 'current' : ''}`;
      
      const thumb = document.createElement('div');
      thumb.className = 'frame-strip-thumb';
      
      if (frame.dataUrl) {
        const img = document.createElement('img');
        img.src = frame.dataUrl;
        img.alt = `Offset ${frame.offset}`;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        thumb.appendChild(img);
      } else {
        thumb.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; font-size:0.6rem; color:var(--text-muted);">Failed</div>`;
      }
      
      // Offset badge
      const badge = document.createElement('span');
      badge.className = 'frame-offset-badge';
      badge.textContent = frame.offset === 0 ? 'Current' : (frame.offset > 0 ? `+${frame.offset}` : `${frame.offset}`);
      thumb.appendChild(badge);
      card.appendChild(thumb);
      
      // Time label
      const timeLabel = document.createElement('span');
      timeLabel.className = 'frame-strip-time';
      timeLabel.textContent = formatTimeMs(frame.time);
      card.appendChild(timeLabel);
      
      // Click action: Seek main player to frame
      card.addEventListener('click', () => {
        mainVideo.currentTime = frame.time;
      });
      
      adjacentFramesStrip.appendChild(card);
    });
  }, 100);
}

const thumbnailCache = new Map();

function generateFrameThumbnail(time, width, height) {
  const frameIndex = Math.round(time * mainVideoFrameRate);
  const cacheKey = `${frameIndex}_${width}x${height}`;
  
  if (thumbnailCache.has(cacheKey)) {
    return Promise.resolve(thumbnailCache.get(cacheKey));
  }
  
  return new Promise((resolve, reject) => {
    if (!explorerVideo) return reject("Explorer video not initialized");
    
    const onSeeked = () => {
      explorerVideo.removeEventListener('seeked', onSeeked);
      
      explorerCanvas.width = width;
      explorerCanvas.height = height;
      explorerCtx.drawImage(explorerVideo, 0, 0, width, height);
      
      const dataUrl = explorerCanvas.toDataURL('image/jpeg', 0.65);
      thumbnailCache.set(cacheKey, dataUrl);
      resolve(dataUrl);
    };
    
    explorerVideo.addEventListener('seeked', onSeeked);
    explorerVideo.currentTime = time;
  });
}


/* --- 8. Full-Resolution Capture Engine --- */
async function captureCurrentFrame() {
  if (!currentFile) return;
  
  // Trigger camera shutter flash feedback
  triggerFlashFeedback();
  
  // Visual Feedback overlay indicator
  videoLoading.classList.remove('hidden');
  document.querySelector('#video-loading span').textContent = "Capturing...";
  
  // Setup full-res canvas with Wide Color Gamut (Display P3) support if supported by system
  const canvas = document.createElement('canvas');
  canvas.width = mainVideo.videoWidth;
  canvas.height = mainVideo.videoHeight;
  
  let colorSpace = 'srgb';
  if (window.matchMedia && window.matchMedia('(color-gamut: p3)').matches) {
    colorSpace = 'display-p3';
  }
  const ctx = canvas.getContext('2d', { colorSpace: colorSpace });
  
  // Draw active frame
  ctx.drawImage(mainVideo, 0, 0, canvas.width, canvas.height);
  
  const formattedTime = formatTimeFilename(mainVideo.currentTime);
  const resolution = `${canvas.width}x${canvas.height}`;
  
  // Get small preview base64 for UI sidebar
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = 160;
  thumbCanvas.height = 90;
  const thumbCtx = thumbCanvas.getContext('2d');
  thumbCtx.drawImage(canvas, 0, 0, 160, 90);
  const thumbUrl = thumbCanvas.toDataURL('image/jpeg', 0.7);
  
  // Export high-res frame to Blob
  canvas.toBlob(async (blob) => {
    if (blob) {
      // Default file title prefix (strips file extension)
      const baseName = activeVideoName.substring(0, activeVideoName.lastIndexOf('.')) || activeVideoName;
      const defaultTitle = `${baseName}_${formattedTime}`;
      
      try {
        await saveScreenshot(
          activeVideoName,
          mainVideo.currentTime,
          formatTime(mainVideo.currentTime),
          blob,
          thumbUrl,
          defaultTitle,
          resolution
        );
        
        console.log("Screenshot cached in IndexedDB");
        refreshGalleryView();
      } catch (err) {
        console.error("Failed to cache screenshot", err);
      }
    }
    
    // Clear visual feedback
    videoLoading.classList.add('hidden');
    document.querySelector('#video-loading span').textContent = "Seeking to frame...";
  }, 'image/png');
}


/* --- 9. Gallery Sidebar Operations --- */
async function refreshGalleryView() {
  if (!activeVideoName) return;
  
  try {
    const list = await getScreenshots(activeVideoName);
    
    // Update badge count
    galleryCountBadge.textContent = list.length;
    
    if (list.length === 0) {
      galleryEmptyView.classList.remove('hidden');
      btnDownloadAll.classList.add('disabled');
      galleryItemsContainer.innerHTML = '';
      galleryItemsContainer.appendChild(galleryEmptyView);
      return;
    }
    
    galleryEmptyView.classList.add('hidden');
    btnDownloadAll.classList.remove('disabled');
    
    // Render list
    galleryItemsContainer.innerHTML = '';
    
    list.forEach(item => {
      const card = document.createElement('div');
      card.className = 'gallery-card';
      card.dataset.id = item.id;
      
      // Image container
      const thumb = document.createElement('div');
      thumb.className = 'gallery-card-thumb';
      
      const img = document.createElement('img');
      img.src = item.thumbnailUrl;
      img.alt = item.title;
      thumb.appendChild(img);
      
      const meta = document.createElement('div');
      meta.className = 'gallery-card-meta';
      
      const timeSpan = document.createElement('span');
      timeSpan.className = 'gallery-card-time';
      timeSpan.textContent = item.timestampFormatted;
      meta.appendChild(timeSpan);
      
      const resSpan = document.createElement('span');
      resSpan.className = 'gallery-card-res';
      resSpan.textContent = item.resolution;
      meta.appendChild(resSpan);
      
      thumb.appendChild(meta);
      card.appendChild(thumb);
      
      // Info Panel
      const info = document.createElement('div');
      info.className = 'gallery-card-info';
      
      // Title input
      const titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.className = 'gallery-card-title-input';
      titleInput.value = item.title;
      titleInput.title = "Click to rename";
      titleInput.addEventListener('change', async (e) => {
        try {
          await updateScreenshotTitle(item.id, e.target.value);
          console.log("Screenshot renamed");
        } catch (err) {
          console.error("Rename failed", err);
        }
      });
      info.appendChild(titleInput);
      
      // Action row
      const actions = document.createElement('div');
      actions.className = 'gallery-card-actions';
      
      // Seek button
      const btnSeek = document.createElement('button');
      btnSeek.className = 'btn btn-secondary';
      btnSeek.title = 'Jump player to this timestamp';
      btnSeek.innerHTML = '<i data-lucide="history" style="width:14px; height:14px;"></i>';
      btnSeek.addEventListener('click', () => {
        mainVideo.currentTime = item.timestamp;
      });
      actions.appendChild(btnSeek);
      
      // Download button
      const btnDownload = document.createElement('button');
      btnDownload.className = 'btn btn-secondary';
      btnDownload.title = 'Download PNG file';
      btnDownload.innerHTML = '<i data-lucide="download" style="width:14px; height:14px;"></i>';
      btnDownload.addEventListener('click', () => {
        downloadIndividualFile(item.blob, `${titleInput.value}.png`);
      });
      actions.appendChild(btnDownload);
      
      // Delete button
      const btnDel = document.createElement('button');
      btnDel.className = 'btn btn-danger';
      btnDel.title = 'Delete screenshot';
      btnDel.innerHTML = '<i data-lucide="trash-2" style="width:14px; height:14px;"></i>';
      btnDel.addEventListener('click', async () => {
        if (confirm("Delete this screenshot from memory?")) {
          try {
            await deleteScreenshot(item.id);
            refreshGalleryView();
          } catch (err) {
            console.error("Delete failed", err);
          }
        }
      });
      actions.appendChild(btnDel);
      
      info.appendChild(actions);
      card.appendChild(info);
      
      galleryItemsContainer.appendChild(card);
    });
    
    // Create new Lucide icons inside dynamic nodes
    lucide.createIcons();
    
  } catch (err) {
    console.error("Failed to load gallery items", err);
  }
}

function downloadIndividualFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadAllAsZip() {
  if (!activeVideoName) return;
  
  try {
    const list = await getScreenshots(activeVideoName);
    if (list.length === 0) return;
    
    // Visual Feedback
    btnDownloadAll.innerHTML = '<div class="spinner" style="width:12px; height:12px; border-width:2px; margin:0;"></div><span>Zipping...</span>';
    btnDownloadAll.classList.add('disabled');
    
    const zip = new JSZip();
    
    // Add each image to zip
    list.forEach(item => {
      // Clean name of characters invalid in filenames
      const cleanTitle = item.title.replace(/[\\/:*?"<>|]/g, "_");
      zip.file(`${cleanTitle}.png`, item.blob);
    });
    
    // Generate ZIP
    const content = await zip.generateAsync({ type: 'blob' });
    
    const zipName = `${activeVideoName.substring(0, activeVideoName.lastIndexOf('.')) || activeVideoName}_captures.zip`;
    downloadIndividualFile(content, zipName);
    
    // Reset Button
    btnDownloadAll.innerHTML = '<i data-lucide="archive-restore"></i><span>Download All</span>';
    btnDownloadAll.classList.remove('disabled');
    lucide.createIcons();
    
  } catch (err) {
    console.error("Failed to bundle ZIP archive", err);
    alert("Zipping failed. Please try downloading files individually.");
    btnDownloadAll.innerHTML = '<i data-lucide="archive-restore"></i><span>Download All</span>';
    btnDownloadAll.classList.remove('disabled');
    lucide.createIcons();
  }
}


/* --- 10. Background Scene & Shot Detector --- */
function toggleBackgroundScan() {
  if (isScanning) {
    stopBackgroundScan();
  } else {
    startBackgroundScan();
  }
}

function startBackgroundScan() {
  if (!currentFile || !scannerVideo) return;
  
  isScanning = true;
  detectedShots = [];
  scenePartitions = [0];
  lastFrameData = null;
  scanCurrentTime = 0;
  
  // Read scan speed interval
  scanInterval = parseInt(scanModeSelect.value);
  
  // Disable scan controls during processing
  scanModeSelect.disabled = true;
  sensitivitySelect.disabled = true;
  
  // UI Changes
  scanProgressContainer.classList.remove('hidden');
  btnToggleScan.querySelector('.btn-icon-play').classList.add('hidden');
  btnToggleScan.querySelector('.btn-icon-pause').classList.remove('hidden');
  scanToggleText.textContent = "Pause Scan";
  scannerStatusBadge.textContent = "Scanning film...";
  scannerStatusBadge.className = "badge badge-outline";
  
  overviewTabsContainer.classList.remove('hidden');
  
  // Set first sample seek
  scannerVideo.currentTime = 0;
}

function stopBackgroundScan() {
  isScanning = false;
  
  // Re-enable configuration select boxes
  if (scanModeSelect) scanModeSelect.disabled = false;
  if (sensitivitySelect) sensitivitySelect.disabled = false;
  
  if (btnToggleScan) {
    const playIco = btnToggleScan.querySelector('.btn-icon-play');
    const pauseIco = btnToggleScan.querySelector('.btn-icon-pause');
    if (playIco) playIco.classList.remove('hidden');
    if (pauseIco) pauseIco.classList.add('hidden');
    scanToggleText.textContent = "Resume Scan";
  }
  
  if (scannerStatusBadge) {
    scannerStatusBadge.textContent = "Scan Paused";
    scannerStatusBadge.className = "badge";
  }
}

function finishBackgroundScan() {
  isScanning = false;
  
  // Re-enable config select boxes
  if (scanModeSelect) scanModeSelect.disabled = false;
  if (sensitivitySelect) sensitivitySelect.disabled = false;
  
  btnToggleScan.classList.add('hidden'); // Hide scan button when complete
  scannerStatusBadge.textContent = "Scan Complete";
  scannerStatusBadge.className = "badge badge-outline";
  scanProgressContainer.classList.add('hidden');
  
  // Re-render overview to ensure latest shots
  showScenesOverview();
  
  // Auto-switch to Capture workspace when scan finishes so they can immediately begin grabbing!
  switchWorkspace('capture');
}

function handleScannerVideoSeeked() {
  if (!isScanning) return;
  
  // Analyze current frames
  analyzeScannerFrame();
  
  // Step scanner forward
  scanCurrentTime += scanInterval;
  
  // Update progress
  if (duration > 0) {
    const pct = Math.min(100, (scanCurrentTime / duration) * 100);
    scanProgressFill.style.width = `${pct}%`;
    scanPercentText.textContent = `${Math.round(pct)}%`;
  }
  
  if (scanCurrentTime >= duration) {
    finishBackgroundScan();
  } else {
    // Schedule next frame check using small timeout to avoid thread blocking
    setTimeout(() => {
      if (isScanning) {
        scannerVideo.currentTime = scanCurrentTime;
      }
    }, 12);
  }
}

function analyzeScannerFrame() {
  // Draw current scanner video frame onto tiny analysis canvas
  scannerCtx.drawImage(scannerVideo, 0, 0, 30, 20);
  const imgData = scannerCtx.getImageData(0, 0, 30, 20).data;
  
  // Calculate average luminance to detect Fade-to-Black scene transition boundaries
  let totalLuminance = 0;
  for (let i = 0; i < imgData.length; i += 4) {
    const r = imgData[i];
    const g = imgData[i+1];
    const b = imgData[i+2];
    totalLuminance += 0.299 * r + 0.587 * g + 0.114 * b;
  }
  const avgLuminance = totalLuminance / (30 * 20);
  const isBlackFrame = avgLuminance < 7; // Black threshold
  
  const lastPartition = scenePartitions[scenePartitions.length - 1];
  let partitionCreated = false;
  
  if (isBlackFrame) {
    // Start a new scene at fade-to-black if it's been at least 15s since the last scene partition
    if (scannerVideo.currentTime - lastPartition > 15) {
      scenePartitions.push(scannerVideo.currentTime);
      partitionCreated = true;
      console.log("Scene transition (fade-to-black) detected at time:", scannerVideo.currentTime);
    }
  } else if (scannerVideo.currentTime - lastPartition > sceneTimeBlockSize) {
    // Fallback: If 5 minutes have passed without a fade-to-black, start a new scene partition
    scenePartitions.push(scannerVideo.currentTime);
    partitionCreated = true;
  }
  
  if (lastFrameData) {
    // Compute pixel delta difference
    let diff = 0;
    for (let i = 0; i < imgData.length; i += 4) {
      diff += Math.abs(imgData[i] - lastFrameData[i]);       // R
      diff += Math.abs(imgData[i+1] - lastFrameData[i+1]);   // G
      diff += Math.abs(imgData[i+2] - lastFrameData[i+2]);   // B
    }
    
    // Average RGB pixel value change per pixel (0-255)
    const avgDiff = diff / (30 * 20 * 3);
    
    // Threshold set by user dropdown
    const threshold = parseInt(sensitivitySelect.value);
    
    if (avgDiff > threshold) {
      // Shot Cut Detected! Cache a display thumbnail
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 160;
      thumbCanvas.height = 90;
      const thumbCtx = thumbCanvas.getContext('2d');
      thumbCtx.drawImage(scannerVideo, 0, 0, 160, 90);
      const thumbUrl = thumbCanvas.toDataURL('image/jpeg', 0.65);
      
      detectedShots.push({
        time: scannerVideo.currentTime,
        thumbUrl: thumbUrl
      });
    }
    
    // Dynamically update UI list if active
    if (partitionCreated || avgDiff > threshold) {
      if (currentExpandedSceneIdx === -1) {
        renderScenesGrid();
      } else {
        // Update shots list if they expanded the scene we are currently scanning in
        let currentSceneIdx = scenePartitions.length - 1;
        for (let i = 0; i < scenePartitions.length; i++) {
          const start = scenePartitions[i];
          const end = (i + 1 < scenePartitions.length) ? scenePartitions[i + 1] : duration;
          if (scannerVideo.currentTime >= start && scannerVideo.currentTime < end) {
            currentSceneIdx = i;
            break;
          }
        }
        if (currentSceneIdx === currentExpandedSceneIdx) {
          renderShotsGrid(currentExpandedSceneIdx);
        }
      }
    }
  } else {
    // First sample of the film: Always register as first shot so we have a starting thumbnail!
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 160;
    thumbCanvas.height = 90;
    const thumbCtx = thumbCanvas.getContext('2d');
    thumbCtx.drawImage(scannerVideo, 0, 0, 160, 90);
    const thumbUrl = thumbCanvas.toDataURL('image/jpeg', 0.65);
    
    detectedShots.push({
      time: 0,
      thumbUrl: thumbUrl
    });
    
    renderScenesGrid();
  }
  
  // Save current pixel buffer for next step comparison
  lastFrameData = imgData;
}


/* --- 11. Hierarchical Overview Rendering (Scenes & Shots) --- */
function showScenesOverview() {
  currentExpandedSceneIdx = -1;
  tabScenesBtn.classList.add('active');
  tabShotsBtn.classList.add('hidden');
  btnBackToScenes.classList.add('hidden');
  
  renderScenesGrid();
}

function renderScenesGrid() {
  if (!duration) return;
  
  overviewContentView.innerHTML = '';
  
  const grid = document.createElement('div');
  const viewMode = sceneViewModeSelect ? sceneViewModeSelect.value : 'grid';
  grid.className = `scenes-grid ${viewMode === 'list' ? 'view-list' : ''}`;
  
  for (let i = 0; i < scenePartitions.length; i++) {
    const startTime = scenePartitions[i];
    const endTime = (i + 1 < scenePartitions.length) ? scenePartitions[i + 1] : duration;
    
    // Find shots that fall within this scene partition range
    const shotsInBlock = detectedShots.filter(s => s.time >= startTime && s.time < endTime);
    
    // Card representation
    const card = document.createElement('div');
    card.className = 'scene-card';
    
    // Thumb selection: first shot in this scene, or fallback to closest prior shot
    let thumbUrl = "";
    if (shotsInBlock.length > 0) {
      thumbUrl = shotsInBlock[0].thumbUrl;
    } else {
      const priorShots = detectedShots.filter(s => s.time < startTime);
      if (priorShots.length > 0) {
        thumbUrl = priorShots[priorShots.length - 1].thumbUrl;
      }
    }
    
    const thumbContainer = document.createElement('div');
    thumbContainer.className = 'scene-card-thumb';
    
    if (thumbUrl) {
      const img = document.createElement('img');
      img.src = thumbUrl;
      img.alt = `Scene ${i+1}`;
      thumbContainer.appendChild(img);
    } else {
      thumbContainer.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; font-size:0.75rem; color:var(--text-muted);">Unscanned</div>`;
    }
    
    const timeLabel = document.createElement('span');
    timeLabel.className = 'scene-card-duration';
    timeLabel.textContent = `${formatTimeShort(startTime)} - ${formatTimeShort(endTime)}`;
    thumbContainer.appendChild(timeLabel);
    card.appendChild(thumbContainer);
    
    // Text labels
    const info = document.createElement('div');
    info.className = 'scene-card-info';
    
    const title = document.createElement('div');
    title.className = 'scene-card-title';
    title.textContent = `Scene ${i+1}`;
    info.appendChild(title);
    
    const sub = document.createElement('div');
    sub.className = 'scene-card-subtext';
    sub.textContent = `${shotsInBlock.length} camera cut${shotsInBlock.length === 1 ? '' : 's'} detected`;
    info.appendChild(sub);
    
    card.appendChild(info);
    
    // Click: Drill down into this scene's shots
    card.addEventListener('click', () => {
      showShotsInScene(i);
    });
    
    grid.appendChild(card);
  }
  
  overviewContentView.appendChild(grid);
}

function showShotsInScene(sceneIdx) {
  currentExpandedSceneIdx = sceneIdx;
  
  // Update Tab States
  tabScenesBtn.classList.remove('active');
  tabShotsBtn.classList.remove('hidden');
  tabShotsBtn.classList.add('active');
  tabShotsTitle.textContent = `Scene ${sceneIdx+1} Shots`;
  btnBackToScenes.classList.remove('hidden');
  
  renderShotsGrid(sceneIdx);
}

function renderShotsGrid(sceneIdx) {
  const startTime = scenePartitions[sceneIdx];
  const endTime = (sceneIdx + 1 < scenePartitions.length) ? scenePartitions[sceneIdx + 1] : duration;
  
  // Fetch matching shots
  const shots = detectedShots.filter(s => s.time >= startTime && s.time < endTime);
  
  overviewContentView.innerHTML = '';
  
  // Create Split Container
  const splitContainer = document.createElement('div');
  splitContainer.className = 'overview-split-container';
  
  const viewMode = sceneViewModeSelect ? sceneViewModeSelect.value : 'grid';
  if (viewMode === 'list') {
    splitContainer.classList.add('scenes-compact');
  }
  
  // Left Sidebar: Scenes
  const sidebar = document.createElement('div');
  sidebar.className = 'scenes-sidebar';
  
  for (let i = 0; i < scenePartitions.length; i++) {
    const item = document.createElement('div');
    item.className = `sidebar-scene-item ${i === sceneIdx ? 'active' : ''}`;
    
    // Thumbnail (rendered for Normal view, hidden by CSS in Compact view)
    const img = document.createElement('img');
    img.className = 'sidebar-scene-item-thumb';
    const sceneStartTime = scenePartitions[i];
    const firstShot = detectedShots.find(s => s.time >= sceneStartTime);
    img.src = firstShot ? firstShot.thumbUrl : 'placeholder.jpg';
    item.appendChild(img);
    
    const title = document.createElement('span');
    title.className = 'sidebar-scene-item-text';
    title.textContent = `Scene ${i + 1}`;
    item.appendChild(title);
    
    const time = document.createElement('span');
    time.className = 'sidebar-scene-item-time';
    time.textContent = formatTime(sceneStartTime);
    item.appendChild(time);
    
    item.addEventListener('click', () => {
      showShotsInScene(i);
    });
    
    sidebar.appendChild(item);
  }
  
  splitContainer.appendChild(sidebar);
  
  // Right detail pane: Shots
  const detailPane = document.createElement('div');
  detailPane.className = 'shots-detail-pane';
  
  if (shots.length === 0) {
    detailPane.innerHTML = `
      <div class="overview-empty-state">
        <p>No shots detected in this scene yet.</p>
      </div>
    `;
  } else {
    const grid = document.createElement('div');
    grid.className = 'shots-grid';
    
    shots.forEach((shot, idx) => {
      const card = document.createElement('div');
      card.className = 'shot-card';
      
      const thumb = document.createElement('div');
      thumb.className = 'shot-card-thumb';
      
      const img = document.createElement('img');
      img.src = shot.thumbUrl;
      img.alt = `Shot ${idx+1}`;
      thumb.appendChild(img);
      
      const timeLabel = document.createElement('span');
      timeLabel.className = 'shot-card-time';
      timeLabel.textContent = formatTime(shot.time);
      thumb.appendChild(timeLabel);
      
      card.appendChild(thumb);
      
      card.addEventListener('click', () => {
        if (currentWorkspace !== 'capture') {
          switchWorkspace('capture');
        }
        mainVideo.currentTime = shot.time;
        if (isPlaying) togglePlay(); // Pause to inspect frame
      });
      
      grid.appendChild(card);
    });
    detailPane.appendChild(grid);
  }
  
  splitContainer.appendChild(detailPane);
  overviewContentView.appendChild(splitContainer);
}


/* --- 12. Keyboard Shortcuts Handler --- */
function handleKeyboardShortcuts(e) {
  if (!currentFile) return;
  
  // Disable shortcuts if typing in text input fields or if currently remapping a key
  if ((e.target.tagName === 'INPUT' && e.target.type === 'text') || activeRecordAction !== null) {
    return;
  }
  
  // Workspace direct switcher keys (1, 2, 3)
  if (e.key === '1') {
    e.preventDefault();
    switchWorkspace('import');
    return;
  } else if (e.key === '2') {
    e.preventDefault();
    switchWorkspace('capture');
    return;
  } else if (e.key === '3') {
    e.preventDefault();
    switchWorkspace('review');
    return;
  }
  
  // Custom matcher checking
  if (matchShortcut(e, shortcuts.playPause)) {
    e.preventDefault();
    togglePlay();
  }
  else if (matchShortcut(e, shortcuts.stepForward1f)) {
    e.preventDefault();
    stepFrames(1);
  }
  else if (matchShortcut(e, shortcuts.stepBackward1f)) {
    e.preventDefault();
    stepFrames(-1);
  }
  else if (matchShortcut(e, shortcuts.stepForward10f)) {
    e.preventDefault();
    stepFrames(10);
  }
  else if (matchShortcut(e, shortcuts.stepBackward10f)) {
    e.preventDefault();
    stepFrames(-10);
  }
  else if (matchShortcut(e, shortcuts.stepForward1s)) {
    e.preventDefault();
    jumpTime(1);
  }
  else if (matchShortcut(e, shortcuts.stepBackward1s)) {
    e.preventDefault();
    jumpTime(-1);
  }
  else if (matchShortcut(e, shortcuts.stepForward10s)) {
    e.preventDefault();
    jumpTime(10);
  }
  else if (matchShortcut(e, shortcuts.stepBackward10s)) {
    e.preventDefault();
    jumpTime(-10);
  }
  else if (matchShortcut(e, shortcuts.stepForward30s)) {
    e.preventDefault();
    jumpTime(30);
  }
  else if (matchShortcut(e, shortcuts.stepBackward30s)) {
    e.preventDefault();
    jumpTime(-30);
  }
  else if (matchShortcut(e, shortcuts.grabFrame)) {
    e.preventDefault();
    captureCurrentFrame();
  }
  else if (matchShortcut(e, shortcuts.toggleZoom)) {
    e.preventDefault();
    // Cycle Zoom: 1x -> 2x -> 4x -> 1x
    let nextZoom = 1;
    if (currentZoom === 1) nextZoom = 2;
    else if (currentZoom === 2) nextZoom = 4;
    setZoom(nextZoom);
    zoomSelect.value = String(nextZoom);
  }
}

function matchShortcut(e, config) {
  if (!config) return false;
  
  // Normalize key name comparison (space, arrows, characters)
  const eventKey = e.key === ' ' ? ' ' : e.key.toLowerCase();
  const configKey = config.key === ' ' ? ' ' : config.key.toLowerCase();
  
  if (eventKey !== configKey) return false;
  
  // Verify modifier status
  const eventCtrl = e.ctrlKey || e.metaKey;
  if (config.ctrl !== eventCtrl) return false;
  if (config.shift !== e.shiftKey) return false;
  if (config.alt !== e.altKey) return false;
  
  return true;
}

function decreaseSpeed() {
  const speeds = [0.1, 0.25, 0.5, 1.0, 1.5, 2.0, 4.0];
  const curIdx = speeds.indexOf(parseFloat(speedSelect.value));
  if (curIdx > 0) {
    const nextVal = speeds[curIdx - 1];
    speedSelect.value = String(nextVal);
    mainVideo.playbackRate = nextVal;
  }
}

function increaseSpeed() {
  const speeds = [0.1, 0.25, 0.5, 1.0, 1.5, 2.0, 4.0];
  const curIdx = speeds.indexOf(parseFloat(speedSelect.value));
  if (curIdx < speeds.length - 1) {
    const nextVal = speeds[curIdx + 1];
    speedSelect.value = String(nextVal);
    mainVideo.playbackRate = nextVal;
  }
}


/* --- 13. Helpers & Time Formatters --- */
function formatTime(seconds) {
  if (isNaN(seconds)) return "00:00:00.00";
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  
  return [
    padZero(hrs),
    padZero(mins),
    padZero(secs)
  ].join(':') + '.' + padZero(ms);
}

function formatTimeMs(seconds) {
  // Format to focus on seconds and milliseconds (useful for adjacent steps)
  if (isNaN(seconds)) return "00.000";
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${padZero(secs)}.${padZero(ms, 3)}`;
}

function formatTimeShort(seconds) {
  if (isNaN(seconds)) return "00:00";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${padZero(hrs)}:${padZero(mins)}:${padZero(secs)}`;
  } else {
    return `${padZero(mins)}:${padZero(secs)}`;
  }
}

function formatTimeFilename(seconds) {
  // Convert standard time string to safe filename format (e.g. 01h_24m_15s_22ms)
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${padZero(hrs)}h-${padZero(mins)}m-${padZero(secs)}s-${padZero(ms, 3)}ms`;
}

function padZero(num, size = 2) {
  let s = num + "";
  while (s.length < size) s = "0" + s;
  return s;
}

function showToast() {
  copyToast.classList.remove('hidden');
  setTimeout(() => {
    copyToast.classList.add('hidden');
  }, 3000);
}

/* --- 14. Panel Resizing Logic --- */
function startResizeY(e) {
  e.preventDefault();
  isResizingY = true;
  resizerY.classList.add('dragging');
  const isSplit = mainLayout.classList.contains('layout-split');
  document.body.style.cursor = isSplit ? 'col-resize' : 'row-resize';
  document.body.style.userSelect = 'none';
}

function startResizeX(e) {
  e.preventDefault();
  isResizingX = true;
  resizerX.classList.add('dragging');
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
}

function handleResize(e) {
  if (isResizingY) {
    const isSplit = mainLayout.classList.contains('layout-split');
    if (isSplit) {
      let newWidth = e.clientX;
      newWidth = Math.max(250, Math.min(600, newWidth));
      overviewPanel.style.width = newWidth + 'px';
    } else {
      const headerHeight = document.querySelector('.app-header').getBoundingClientRect().height;
      let newHeight = e.clientY - headerHeight;
      newHeight = Math.max(120, Math.min(window.innerHeight * 0.6, newHeight));
      overviewPanel.style.height = newHeight + 'px';
    }
  }
  
  if (isResizingX) {
    let newWidth = window.innerWidth - e.clientX;
    newWidth = Math.max(250, Math.min(600, newWidth));
    galleryPanel.style.width = newWidth + 'px';
  }
}

function stopResize() {
  if (isResizingY) {
    isResizingY = false;
    resizerY.classList.remove('dragging');
  }
  if (isResizingX) {
    isResizingX = false;
    resizerX.classList.remove('dragging');
  }
  document.body.style.cursor = 'default';
  document.body.style.userSelect = 'auto';
}

/* --- 15. Timeline Hover Preview Logic --- */
let isScrubSeeking = false;
let pendingScrubTime = null;

function showScrubPreview(e) {
  if (!duration) return;
  scrubPreview.classList.remove('hidden');
  updateScrubPreview(e);
}

function hideScrubPreview() {
  scrubPreview.classList.add('hidden');
}

function updateScrubPreview(e) {
  if (!duration) return;
  
  const rect = videoScrubber.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  const hoverTime = Math.max(0, Math.min(duration, pct * duration));
  
  // Position preview box horizontally (centered over cursor)
  const previewWidth = 124;
  let x = e.clientX - rect.left - (previewWidth / 2);
  x = Math.max(-10, Math.min(rect.width - previewWidth + 10, x)); // Allow slight overflow
  scrubPreview.style.left = x + 'px';
  
  // Update time code
  scrubPreviewTime.textContent = formatTime(hoverTime);
  
  // Draw frame asynchronously
  triggerScrubSeek(hoverTime);
}

function triggerScrubSeek(time) {
  if (!explorerVideo) return;
  
  if (isScrubSeeking) {
    pendingScrubTime = time;
    return;
  }
  
  isScrubSeeking = true;
  
  // Handle seeked event once
  const onSeeked = () => {
    explorerVideo.removeEventListener('seeked', onSeeked);
    
    // Draw explorer frame to scrub canvas
    scrubPreviewCanvas.width = 120;
    scrubPreviewCanvas.height = 68;
    if (scrubPreviewCtx) {
      scrubPreviewCtx.drawImage(explorerVideo, 0, 0, 120, 68);
    }
    
    isScrubSeeking = false;
    
    // Process any deferred seek requests
    if (pendingScrubTime !== null) {
      const nextTime = pendingScrubTime;
      pendingScrubTime = null;
      triggerScrubSeek(nextTime);
    }
  };
  
  explorerVideo.addEventListener('seeked', onSeeked);
  explorerVideo.currentTime = time;
}

/* --- 16. Keyboard Shortcuts Remapping Logic --- */
function loadCustomShortcuts() {
  const saved = localStorage.getItem('cinesnap_shortcuts');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Merge saved bindings to maintain label fields
      for (const action in DEFAULT_SHORTCUTS) {
        if (parsed[action]) {
          shortcuts[action].key = parsed[action].key;
          shortcuts[action].shift = parsed[action].shift;
          shortcuts[action].alt = parsed[action].alt;
          shortcuts[action].ctrl = parsed[action].ctrl;
        }
      }
    } catch (err) {
      console.error("Failed to parse custom shortcuts", err);
    }
  }
}

function saveCustomShortcuts() {
  localStorage.setItem('cinesnap_shortcuts', JSON.stringify(shortcuts));
}

function resetDefaultShortcuts() {
  if (confirm("Restore all shortcuts to factory defaults?")) {
    shortcuts = JSON.parse(JSON.stringify(DEFAULT_SHORTCUTS));
    saveCustomShortcuts();
    renderShortcutsEditor();
    alert("Shortcuts reset to defaults.");
  }
}

function renderShortcutsEditor() {
  if (!shortcutsBindingList) return;
  
  shortcutsBindingList.innerHTML = '';
  
  for (const action in shortcuts) {
    const config = shortcuts[action];
    
    const row = document.createElement('div');
    row.className = 'shortcut-edit-row';
    
    const label = document.createElement('span');
    row.appendChild(label);
    label.className = 'shortcut-edit-label';
    label.textContent = config.label;
    
    const keyBtn = document.createElement('button');
    keyBtn.className = 'btn-keybind-record';
    keyBtn.textContent = formatKeybindString(config);
    keyBtn.title = "Click to remap this keybind";
    
    keyBtn.addEventListener('click', () => {
      startRecordKeybind(action, keyBtn);
    });
    
    row.appendChild(keyBtn);
    shortcutsBindingList.appendChild(row);
  }
}

function formatKeybindString(config) {
  let parts = [];
  if (config.ctrl) parts.push("Ctrl/Cmd");
  if (config.shift) parts.push("Shift");
  if (config.alt) parts.push("Alt");
  
  let keyDisplayName = config.key;
  if (config.key === " ") {
    keyDisplayName = "Space";
  } else if (config.key === "ArrowRight") {
    keyDisplayName = "Right Arrow";
  } else if (config.key === "ArrowLeft") {
    keyDisplayName = "Left Arrow";
  } else if (config.key.length === 1) {
    keyDisplayName = config.key.toUpperCase();
  }
  
  parts.push(keyDisplayName);
  return parts.join(" + ");
}

function startRecordKeybind(action, element) {
  // If already recording another, cancel it
  if (activeRecordAction !== null) {
    stopRecordingUI();
  }
  
  activeRecordAction = action;
  element.classList.add('recording');
  element.textContent = "[ Press keys... ]";
  
  // Bind windows listeners to capture key combination
  window.addEventListener('keydown', captureNewKeybind, true);
}

function captureNewKeybind(e) {
  e.preventDefault();
  e.stopPropagation();
  
  // Ignore modifier-only keydowns
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
    return;
  }
  
  if (activeRecordAction !== null) {
    const action = activeRecordAction;
    
    // Save new config
    shortcuts[action].key = e.key;
    shortcuts[action].shift = e.shiftKey;
    shortcuts[action].alt = e.altKey;
    shortcuts[action].ctrl = e.ctrlKey || e.metaKey;
    
    saveCustomShortcuts();
    stopRecordingUI();
    renderShortcutsEditor();
  }
}

function stopRecordingUI() {
  window.removeEventListener('keydown', captureNewKeybind, true);
  activeRecordAction = null;
  const recordingBtns = document.querySelectorAll('.btn-keybind-record.recording');
  recordingBtns.forEach(btn => btn.classList.remove('recording'));
}

// Override showModal to render UI upon dialog opening
shortcutsDialog.addEventListener('close', () => {
  stopRecordingUI();
});

const originalShowModal = shortcutsDialog.showModal;
shortcutsDialog.showModal = function() {
  renderShortcutsEditor();
  originalShowModal.apply(shortcutsDialog);
};

/* --- 17. Workspace Layout Controller --- */
function switchWorkspace(wsName) {
  currentWorkspace = wsName;
  localStorage.setItem('cinesnap_workspace', wsName);
  
  // Toggle active switcher tabs class
  document.querySelectorAll('.ws-tab').forEach(tab => {
    if (tab.getAttribute('data-ws') === wsName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  // Apply workspace layout class to body
  document.body.className = `ws-${wsName}`;
  
  // If moving into review mode, refresh screenshots grid
  if (wsName === 'review') {
    refreshGalleryView();
  }
}

function toggleWorkspaceLayout() {
  const isSplit = mainLayout.classList.toggle('layout-split');
  localStorage.setItem('cinesnap_layout_split', isSplit ? 'true' : 'false');
  
  const icon = btnToggleLayout.querySelector('i');
  const label = btnToggleLayout.querySelector('span');
  if (isSplit) {
    if (icon) icon.setAttribute('data-lucide', 'layout-list');
    if (label) label.textContent = "Stacked Layout";
    
    // Reset sizes to split-mode defaults
    overviewPanel.style.width = '320px';
    overviewPanel.style.height = '';
  } else {
    if (icon) icon.setAttribute('data-lucide', 'columns-2');
    if (label) label.textContent = "Split Screen";
    
    // Reset sizes to stacked-mode defaults
    overviewPanel.style.height = '160px';
    overviewPanel.style.width = '';
  }
  
  lucide.createIcons();
}

function updateScenesViewSettings() {
  const size = sceneThumbSizeSelect.value;
  const mode = sceneViewModeSelect.value;
  
  // Update overview content classes
  overviewContentView.className = `overview-content thumb-${size}`;
  
  // Force update scenes grid class if present
  const grid = overviewContentView.querySelector('.scenes-grid');
  if (grid) {
    if (mode === 'list') {
      grid.classList.add('view-list');
    } else {
      grid.classList.remove('view-list');
    }
  }
  
  // Force update split container compact class if present
  const splitContainer = overviewContentView.querySelector('.overview-split-container');
  if (splitContainer) {
    if (mode === 'list') {
      splitContainer.classList.add('scenes-compact');
    } else {
      splitContainer.classList.remove('scenes-compact');
    }
  }
  
  // Save configurations
  localStorage.setItem('cinesnap_scene_size', size);
  localStorage.setItem('cinesnap_scene_mode', mode);
}

let pendingSeekTime = null;

function seekVideoSafely(targetTime) {
  if (!mainVideo) return;
  if (!mainVideo.seeking) {
    mainVideo.currentTime = targetTime;
  } else {
    pendingSeekTime = targetTime;
  }
}

function scrubByStep(direction) {
  if (!currentFile) return;
  
  const stepVal = adjacentStepSelect ? adjacentStepSelect.value : '1f';
  let stepInterval = 1 / mainVideoFrameRate; // default 1 frame
  
  if (stepVal === '10f') {
    stepInterval = 10 / mainVideoFrameRate;
  } else if (stepVal === '1s') {
    stepInterval = 1.0;
  } else if (stepVal === '5s') {
    stepInterval = 5.0;
  } else if (stepVal === '10s') {
    stepInterval = 10.0;
  }
  
  const seekTime = Math.max(0, Math.min(duration, mainVideo.currentTime + (direction * stepInterval)));
  seekVideoSafely(seekTime);
}

function scrubAdjacentUnsynced(direction) {
  if (!currentFile) return;
  
  const stepVal = adjacentStepSelect ? adjacentStepSelect.value : '1f';
  let stepInterval = 1 / mainVideoFrameRate;
  
  if (stepVal === '10f') stepInterval = 10 / mainVideoFrameRate;
  else if (stepVal === '1s') stepInterval = 1.0;
  else if (stepVal === '5s') stepInterval = 5.0;
  else if (stepVal === '10s') stepInterval = 10.0;
  
  adjacentOffsetTime += direction * stepInterval;
  
  // Clamp boundaries to video length
  const targetBase = mainVideo.currentTime + adjacentOffsetTime;
  if (targetBase < 0) adjacentOffsetTime = -mainVideo.currentTime;
  if (targetBase > duration) adjacentOffsetTime = duration - mainVideo.currentTime;
  
  renderAdjacentFrames();
}

function toggleCollapseOverview() {
  const isCollapsed = overviewPanel.classList.toggle('collapsed');
  const icon = btnCollapseOverview.querySelector('i');
  if (icon) {
    icon.setAttribute('data-lucide', isCollapsed ? 'chevron-down' : 'chevron-up');
  }
  lucide.createIcons();
  
  if (isCollapsed) {
    overviewPanel.style.height = '';
    overviewPanel.style.width = '';
  } else {
    const isSplit = mainLayout.classList.contains('layout-split');
    if (isSplit) {
      overviewPanel.style.width = '320px';
    } else {
      overviewPanel.style.height = '160px';
    }
  }
}

function toggleCollapseAdjacent() {
  const isCollapsed = adjacentFramesPanel.classList.toggle('collapsed');
  const icon = btnCollapseAdjacent.querySelector('i');
  if (icon) {
    icon.setAttribute('data-lucide', isCollapsed ? 'chevron-down' : 'chevron-up');
  }
  lucide.createIcons();
}

function triggerFlashFeedback() {
  let flash = document.getElementById('shutter-flash');
  if (!flash) {
    flash = document.createElement('div');
    flash.id = 'shutter-flash';
    flash.className = 'flash-overlay';
    videoContainer.appendChild(flash);
  }
  flash.classList.add('active');
  // Trigger DOM layout update to apply non-transition active class
  flash.offsetWidth;
  flash.classList.remove('active');
  
  // Play mechanical shutter click sound
  playShutterSound();
}

function playShutterSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // 1. Shutter snap click (White Noise)
    const noiseDuration = 0.08;
    const bufferSize = audioCtx.sampleRate * noiseDuration;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = buffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1100;
    filter.Q.value = 3.5;
    
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + noiseDuration);
    
    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    
    // 2. Metallic ring resonance (Sine Sweep)
    const osc = audioCtx.createOscillator();
    const oscGain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(3200, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.12);
    
    oscGain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
    
    osc.connect(oscGain);
    oscGain.connect(audioCtx.destination);
    
    // Fire mechanical sound
    noiseSource.start();
    osc.start();
    osc.stop(audioCtx.currentTime + 0.13);
  } catch (err) {
    console.warn("Mechanical shutter sound failed", err);
  }
}



