// CineSnap - Application Logic

/* --- State Management --- */
let db = null;
let currentFile = null;
let activeVideoName = "";
let isPlaying = false;
let duration = 0;
let isSeeking = false;
let mainVideoFrameRate = 23.976; // Fallback until the real rate is detected
let frameRateDetected = false;
let currentFilmKey = "";          // name|size|lastModified, identifies a film across sessions
let currentVideoUrl = null;       // object URL of the loaded film (revoked on next load)

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
let scanInterval = 2; // Seconds between coarse samples
let scanToken = 0; // Incremented to cancel a running scan loop
let scanComplete = false;
let scanSaveTimer = null;
let detectedShots = []; // Array of { time, thumbUrl, score }
const SCAN_FLOOR_THRESHOLD = 12; // Scan at the most sensitive level; the dropdown filters by score
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
  playPauseAlt: { label: "Play / Pause (alternate)", key: "k", shift: false, alt: false, ctrl: false },
  grabFrameAlt: { label: "Grab Frame (alternate)", key: "Enter", shift: false, alt: false, ctrl: false },
  speedDown: { label: "Slower Playback", key: "[", shift: false, alt: false, ctrl: false },
  speedUp: { label: "Faster Playback", key: "]", shift: false, alt: false, ctrl: false },
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
const shortcutsNotice = document.getElementById('shortcuts-notice');

// Added UI elements
const copyToastText = document.getElementById('toast-text');
const toastAction = document.getElementById('toast-action');
const btnRescan = document.getElementById('btn-rescan');
const btnReopenFilm = document.getElementById('btn-reopen-film');
const btnToggleSound = document.getElementById('btn-toggle-sound');
const btnClearGallery = document.getElementById('btn-clear-gallery');
const galleryScopeSelect = document.getElementById('gallery-scope');
const exportFormatSelect = document.getElementById('export-format');
const reviewTabBadge = document.getElementById('review-tab-badge');
const captureTray = document.getElementById('capture-tray');
const captureTrayImg = document.getElementById('capture-tray-img');
const captureTrayCount = document.getElementById('capture-tray-count');
const videoErrorPanel = document.getElementById('video-error');
const videoErrorMessage = document.getElementById('video-error-message');
const btnCopyFfmpegError = document.getElementById('btn-copy-ffmpeg-error');
const frameRateLabel = document.getElementById('frame-rate-label');
const lightboxDialog = document.getElementById('lightbox-dialog');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxCaption = document.getElementById('lightbox-caption');
const confirmDialogEl = document.getElementById('confirm-dialog');
const confirmMessage = document.getElementById('confirm-message');
const confirmOk = document.getElementById('confirm-ok');
const confirmCancel = document.getElementById('confirm-cancel');
const FFMPEG_TIP = 'ffmpeg -i input.mkv -c copy output.mp4';
let previewVideo = null; // dedicated hidden video for the timeline hover preview

let isResizingY = false;
let isResizingX = false;


/* --- 1. IndexedDB Implementation --- */
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('CineSnapDB', 2);
    request.onerror = (e) => reject(e);
    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    request.onupgradeneeded = (e) => {
      const dbInstance = e.target.result;
      if (!dbInstance.objectStoreNames.contains('screenshots')) {
        const store = dbInstance.createObjectStore('screenshots', { keyPath: 'id', autoIncrement: true });
        store.createIndex('videoName', 'videoName', { unique: false });
      }
      // v2: saved scan results, keyed by film identity
      if (!dbInstance.objectStoreNames.contains('scans')) {
        dbInstance.createObjectStore('scans', { keyPath: 'filmKey' });
      }
      // v2: misc key/value (last film file handle for "Reopen last film")
      if (!dbInstance.objectStoreNames.contains('kv')) {
        dbInstance.createObjectStore('kv');
      }
    };
  });
}

function dbRequest(storeName, mode, fn) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('Database not ready'));
    const tx = db.transaction([storeName], mode);
    const req = fn(tx.objectStore(storeName));
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e);
  });
}

const getScan = (filmKey) => dbRequest('scans', 'readonly', st => st.get(filmKey));
const putScan = (record) => dbRequest('scans', 'readwrite', st => st.put(record));
const kvGet = (key) => dbRequest('kv', 'readonly', st => st.get(key));
const kvSet = (key, value) => dbRequest('kv', 'readwrite', st => st.put(value, key));
const getAllScreenshots = () => dbRequest('screenshots', 'readonly', st => st.getAll())
  .then(list => list.sort((a, b) => (a.videoName.localeCompare(b.videoName)) || (a.timestamp - b.timestamp)));

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
  refreshIcons();
  
  // Initialize Hover Preview Context
  if (scrubPreviewCanvas) scrubPreviewCtx = scrubPreviewCanvas.getContext('2d');
  
  // Load Custom Keybinds from LocalStorage
  loadCustomShortcuts();
  
  // Always start on Import: no film is loaded yet, so Capture/Review would be empty
  switchWorkspace('import');
  updateSoundButton();

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
    refreshIcons();
  } else {
    mainLayout.classList.remove('layout-split');
    const icon = btnToggleLayout.querySelector('i');
    const label = btnToggleLayout.querySelector('span');
    if (icon) icon.setAttribute('data-lucide', 'columns-2');
    if (label) label.textContent = "Split Screen";
    overviewPanel.style.height = '160px';
    overviewPanel.style.width = '';
    refreshIcons();
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

  // Offer one-click "Reopen last film" where the File System Access API is available
  initReopenLastFilm();

  // Installable / offline support
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service worker registration failed', err));
  }
});


/* --- 3. Event Listeners --- */
function setupEvents() {
  // File Loading Event Listeners
  videoInput.addEventListener('change', handleFileSelect);
  
  // Drag and Drop: the whole window is a drop target, so a stray drop never navigates away
  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => {
    if (!hasDraggedFiles(e)) return;
    e.preventDefault();
    dragDepth++;
    document.body.classList.add('dragging-file');
    dropZone.classList.add('dragover');
  });
  window.addEventListener('dragover', (e) => {
    if (!hasDraggedFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  window.addEventListener('dragleave', (e) => {
    if (!hasDraggedFiles(e)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      document.body.classList.remove('dragging-file');
      dropZone.classList.remove('dragover');
    }
  });
  window.addEventListener('drop', async (e) => {
    if (!hasDraggedFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    document.body.classList.remove('dragging-file');
    dropZone.classList.remove('dragover');
    const item = e.dataTransfer.items && e.dataTransfer.items[0];
    // Grab a file handle (Chrome/Edge) before the drop event ends, for "Reopen last film"
    const handlePromise = (item && item.getAsFileSystemHandle) ? item.getAsFileSystemHandle().catch(() => null) : Promise.resolve(null);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!isLikelyVideo(file)) {
      showToast(`"${file.name}" doesn't look like a video file.`, 'error');
      return;
    }
    loadVideoFile(file);
    rememberFileHandle(await handlePromise);
  });

  // Ffmpeg copy button
  btnCopyFfmpeg.addEventListener('click', (e) => {
    e.stopPropagation();
    copyFfmpegCommand();
  });
  btnCopyFfmpegError.addEventListener('click', copyFfmpegCommand);

  const btnLoadFilm = document.getElementById('btn-load-film');
  btnLoadFilm.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btnLoadFilm.click(); }
  });

  // Load Film: use the File System Access picker where available so the film can be reopened later
  document.getElementById('btn-load-film').addEventListener('click', async (e) => {
    if (!window.showOpenFilePicker) return; // fall back to the plain <input type="file">
    e.preventDefault();
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'Video files', accept: { 'video/*': ['.mp4', '.m4v', '.webm', '.mov', '.mkv', '.ogv'] } }]
      });
      const file = await handle.getFile();
      loadVideoFile(file);
      rememberFileHandle(handle);
    } catch (err) {
      if (err && err.name !== 'AbortError') videoInput.click();
    }
  });

  // Playback Control Buttons
  btnPlayPause.addEventListener('click', togglePlay);
  
  // Video events
  mainVideo.addEventListener('loadedmetadata', handleVideoMetadata);
  mainVideo.addEventListener('timeupdate', handleVideoTimeUpdate);
  mainVideo.addEventListener('error', handleVideoError);
  mainVideo.addEventListener('pause', savePlayhead);

  // Warn before closing the tab mid-scan, and save the playhead on the way out
  window.addEventListener('beforeunload', (e) => {
    savePlayhead();
    if (isScanning) {
      saveScanProgress();
      e.preventDefault();
      e.returnValue = '';
    }
  });
  window.addEventListener('pagehide', savePlayhead);
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
  // The picture follows the drag (seeks are coalesced so they never pile up)
  videoScrubber.addEventListener('input', (e) => {
    if (!duration) return;
    isSeeking = true;
    const seekTime = (parseFloat(e.target.value) / 100) * duration;
    timeCurrent.textContent = formatTime(seekTime);
    progressBarFill.style.width = e.target.value + '%';
    seekVideoSafely(seekTime);
  });

  videoScrubber.addEventListener('change', (e) => {
    if (!duration) return;
    seekVideoSafely((parseFloat(e.target.value) / 100) * duration);
    isSeeking = false;
  });

  // Scrubber Hover Preview
  videoScrubber.addEventListener('mouseenter', showScrubPreview);
  videoScrubber.addEventListener('mouseleave', hideScrubPreview);
  videoScrubber.addEventListener('mousemove', updateScrubPreview);

  // Zoom Drag (Pan) logic: pointer events cover mouse, pen and touch
  videoContainer.addEventListener('pointerdown', startPanDrag);
  window.addEventListener('pointermove', panDrag);
  window.addEventListener('pointerup', endPanDrag);
  window.addEventListener('pointercancel', endPanDrag);

  // Gallery Download All, scope, format, clear
  btnDownloadAll.addEventListener('click', downloadAllAsZip);
  galleryScopeSelect.addEventListener('change', refreshGalleryView);
  exportFormatSelect.value = localStorage.getItem('cinesnap_export_format') || 'png';
  exportFormatSelect.addEventListener('change', () => {
    localStorage.setItem('cinesnap_export_format', exportFormatSelect.value);
  });
  btnClearGallery.addEventListener('click', clearShownScreenshots);
  btnToggleSound.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem('cinesnap_sound', soundEnabled ? 'on' : 'off');
    updateSoundButton();
  });
  btnReopenFilm.addEventListener('click', reopenLastFilm);
  lightboxDialog.addEventListener('click', (e) => {
    if (e.target === lightboxDialog || e.target.closest('[data-close]')) lightboxDialog.close();
  });
  lightboxDialog.addEventListener('close', () => {
    if (lightboxUrl) { URL.revokeObjectURL(lightboxUrl); lightboxUrl = null; }
  });

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
  btnRescan.addEventListener('click', () => startBackgroundScan({ fresh: true }));
  // Cuts are scanned at the most sensitive level and filtered by score, so this is instant
  sensitivitySelect.addEventListener('change', () => {
    rerenderOverview();
    saveScanProgress();
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

  // Panel Resizing Event Listeners (pointer events so touch works too)
  resizerY.addEventListener('pointerdown', startResizeY);
  resizerX.addEventListener('pointerdown', startResizeX);
  
  window.addEventListener('pointermove', handleResize);
  window.addEventListener('pointerup', stopResize);
  window.addEventListener('pointercancel', stopResize);
}


/* --- 4. Video Loading Logic --- */
function handleFileSelect(e) {
  if (e.target.files.length > 0) {
    loadVideoFile(e.target.files[0]);
  }
  e.target.value = ''; // allow re-selecting the same file
}

function hasDraggedFiles(e) {
  return e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
}

function isLikelyVideo(file) {
  if (file.type) return file.type.startsWith('video/');
  return /\.(mp4|m4v|mov|webm|mkv|ogv|avi)$/i.test(file.name);
}

function filmKeyFor(file) {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

async function loadVideoFile(file) {
  // Persist anything from the previous film before switching
  savePlayhead();
  if (isScanning) saveScanProgress();

  currentFile = file;
  activeVideoName = file.name;
  currentFilmKey = filmKeyFor(file);
  
  // Stop background scanning of any previous video
  stopBackgroundScan({ silent: true });
  detectedShots = [];
  scenePartitions = [0];
  scanCurrentTime = 0;
  scanComplete = false;
  lastFrameData = null;
  currentExpandedSceneIdx = -1;
  thumbnailCache.clear(); // Clear thumbnail memory cache for new video
  frameRateDetected = false;
  mainVideoFrameRate = 23.976;
  hideVideoError();
  updateFrameRateLabel();
  btnReopenFilm.classList.add('hidden');
  
  // Hide placeholder, show video layout
  placeholderView.classList.add('hidden');
  videoContainer.classList.remove('hidden');
  controlsPanel.classList.remove('disabled');
  
  // Release the previous film's object URL, then create the new one
  if (currentVideoUrl) URL.revokeObjectURL(currentVideoUrl);
  const videoUrl = URL.createObjectURL(file);
  currentVideoUrl = videoUrl;
  mainVideo.src = videoUrl;
  mainVideo.playbackRate = parseFloat(speedSelect.value);
  if (isPlaying) togglePlay();
  
  // Initialize Secondary Background Videos
  initBackgroundVideos(videoUrl);
  
  // Reset zoom
  setZoom(1);
  zoomSelect.value = "1";
  
  // Land on Import & Scan for a newly loaded film
  switchWorkspace('import');
  
  // Update UI & load from cache
  refreshGalleryView();
  
  // Reset Scanner UI
  scannerControls.classList.remove('hidden');
  if (overviewViewOptions) overviewViewOptions.classList.remove('hidden');
  overviewTabsContainer.classList.add('hidden');
  setScanUiState('ready');
  
  overviewContentView.innerHTML = `
    <div class="overview-empty-state">
      <p>Film loaded! Press <strong>Scan Film</strong> above to detect scenes and camera cuts.</p>
    </div>
  `;

  // Restore a saved scan for this exact film (name + size + modified date)
  try {
    const saved = await getScan(currentFilmKey);
    if (saved && currentFilmKey === filmKeyFor(file)) restoreSavedScan(saved);
  } catch (err) {
    console.warn('Could not read saved scan', err);
  }
}

function restoreSavedScan(saved) {
  detectedShots = saved.shots || [];
  scenePartitions = (saved.partitions && saved.partitions.length) ? saved.partitions : [0];
  scanCurrentTime = saved.scanTime || 0;
  scanComplete = !!saved.complete;
  if (saved.sensitivity && [...sensitivitySelect.options].some(o => o.value === String(saved.sensitivity))) {
    sensitivitySelect.value = String(saved.sensitivity);
  }
  if (saved.interval && [...scanModeSelect.options].some(o => o.value === String(saved.interval))) {
    scanModeSelect.value = String(saved.interval);
  }
  overviewTabsContainer.classList.remove('hidden');
  setScanUiState(scanComplete ? 'complete' : 'paused');
  const restoreUi = () => {
    if (!scanComplete && duration > 0) updateScanProgressUi();
    showScenesOverview();
  };
  if (duration) restoreUi(); else mainVideo.addEventListener('loadedmetadata', restoreUi, { once: true });
  showToast(scanComplete
    ? 'Restored your saved scan for this film.'
    : 'Restored a partial scan. Press Resume Scan to continue.');
}

function createHelperVideo(url) {
  const v = document.createElement('video');
  v.src = url;
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  return v;
}

function disposeVideo(v) {
  if (!v) return;
  v.removeAttribute('src');
  v.load();
}

function initBackgroundVideos(url) {
  // Explorer Video (adjacent frame strip)
  disposeVideo(explorerVideo);
  explorerVideo = createHelperVideo(url);
  explorerCanvas = document.createElement('canvas');
  explorerCtx = explorerCanvas.getContext('2d');
  explorerQueue = Promise.resolve();

  // Preview Video (timeline hover preview) - separate so it can't race the strip
  disposeVideo(previewVideo);
  previewVideo = createHelperVideo(url);
  
  // Scanner Video (Background scene analyzer)
  disposeVideo(scannerVideo);
  scannerVideo = createHelperVideo(url);
  scannerCanvas = document.createElement('canvas');
  scannerCanvas.width = SCAN_W;
  scannerCanvas.height = SCAN_H;
  scannerCtx = scannerCanvas.getContext('2d', { willReadFrequently: true });
}

function handleVideoMetadata() {
  duration = mainVideo.duration;
  timeDuration.textContent = formatTime(duration);
  timeCurrent.textContent = formatTime(0);
  
  videoScrubber.disabled = false;
  videoScrubber.value = "0";
  progressBarFill.style.width = "0%";

  // Some codecs (e.g. HEVC in some browsers) load audio but no picture
  if (!mainVideo.videoWidth || !mainVideo.videoHeight) {
    showVideoError("This file's video track can't be decoded by your browser, so only a black picture would show.");
    return;
  }

  // Return to where you left off in this film
  const savedPos = parseFloat(localStorage.getItem(playheadKey()) || '');
  if (savedPos > 0.5 && savedPos < duration - 0.5) {
    mainVideo.currentTime = savedPos;
    showToast(`Resumed at ${formatTime(savedPos)}.`);
  }

  detectFrameRate(currentVideoUrl);
}

/* Frame-rate detection: play a hidden muted copy for a moment and measure the
   spacing of presented frames with requestVideoFrameCallback, then snap to a
   standard rate. Falls back to 23.976 if the API isn't available. */
const STANDARD_RATES = [23.976, 24, 25, 29.97, 30, 47.952, 48, 50, 59.94, 60, 120];

function snapFrameRate(fps) {
  let best = fps, bestErr = Infinity;
  for (const r of STANDARD_RATES) {
    const err = Math.abs(r - fps) / r;
    if (err < bestErr) { bestErr = err; best = r; }
  }
  return bestErr < 0.02 ? best : Math.round(fps * 1000) / 1000;
}

async function detectFrameRate(url) {
  if (!('requestVideoFrameCallback' in HTMLVideoElement.prototype) || !url) return;
  const probe = createHelperVideo(url);
  probe.className = 'frame-rate-probe';
  document.body.appendChild(probe); // must be in the document for frame callbacks to fire
  try {
    const deltas = [];
    let lastMediaTime = null, lastFrames = null;
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 2500);
      const onFrame = (now, meta) => {
        if (lastMediaTime !== null && meta.presentedFrames - lastFrames === 1) {
          const d = meta.mediaTime - lastMediaTime;
          if (d > 0.004 && d < 0.2) deltas.push(d);
        }
        lastMediaTime = meta.mediaTime;
        lastFrames = meta.presentedFrames;
        if (deltas.length >= 24) { clearTimeout(timeout); resolve(); return; }
        probe.requestVideoFrameCallback(onFrame);
      };
      probe.requestVideoFrameCallback(onFrame);
      probe.currentTime = Math.min(1, (mainVideo.duration || 2) / 4);
      probe.play().catch(() => { clearTimeout(timeout); resolve(); });
    });
    if (url !== currentVideoUrl) return; // a different film was loaded meanwhile
    if (deltas.length >= 5) {
      deltas.sort((a, b) => a - b);
      const median = deltas[Math.floor(deltas.length / 2)];
      mainVideoFrameRate = snapFrameRate(1 / median);
      frameRateDetected = true;
      thumbnailCache.clear();
      renderAdjacentFrames();
      console.log('Detected frame rate', mainVideoFrameRate);
    }
  } finally {
    probe.pause();
    disposeVideo(probe);
    probe.remove();
    updateFrameRateLabel();
  }
}

function updateFrameRateLabel() {
  if (!frameRateLabel) return;
  frameRateLabel.textContent = currentFile
    ? `${mainVideoFrameRate} fps${frameRateDetected ? '' : ' (assumed)'}`
    : '';
  frameRateLabel.title = frameRateDetected
    ? 'Frame rate measured from the file'
    : 'Could not measure the frame rate in this browser; assuming 23.976 fps';
}

function handleVideoError() {
  const err = mainVideo.error;
  if (!err || !currentFile) return;
  const reasons = {
    2: "A network error interrupted loading this file.",
    3: "Your browser couldn't decode this file.",
    4: "Your browser can't play this file's format or codec."
  };
  showVideoError(reasons[err.code] || "This file couldn't be played.");
}

function showVideoError(message) {
  videoErrorMessage.textContent = message;
  videoErrorPanel.classList.remove('hidden');
  videoLoading.classList.add('hidden');
}

function hideVideoError() {
  videoErrorPanel.classList.add('hidden');
}

function copyFfmpegCommand() {
  navigator.clipboard.writeText(FFMPEG_TIP)
    .then(() => showToast('ffmpeg command copied to clipboard.'))
    .catch(() => showToast('Copy failed. Select the command and copy it manually.', 'error'));
}

/* Playhead memory, per film */
function playheadKey() {
  return `cinesnap_playhead_${currentFilmKey}`;
}

function savePlayhead() {
  if (!currentFilmKey || !duration) return;
  try {
    localStorage.setItem(playheadKey(), String(mainVideo.currentTime));
  } catch (err) { /* storage full or blocked */ }
}

let lastPlayheadSave = 0;
function handleVideoTimeUpdate() {
  if (!duration) return;
  if (Date.now() - lastPlayheadSave > 3000) {
    lastPlayheadSave = Date.now();
    savePlayhead();
  }
  if (isSeeking) return;
  
  const pct = (mainVideo.currentTime / duration) * 100;
  videoScrubber.value = pct.toFixed(3);
  progressBarFill.style.width = pct.toFixed(3) + '%';
  timeCurrent.textContent = formatTime(mainVideo.currentTime);
}

/* "Reopen last film" via File System Access API (Chrome / Edge) */
async function rememberFileHandle(handle) {
  if (!handle || handle.kind !== 'file') return;
  try {
    await kvSet('lastFilmHandle', handle);
  } catch (err) {
    console.warn('Could not store file handle', err);
  }
}

async function initReopenLastFilm() {
  if (!window.showOpenFilePicker || !db) return;
  try {
    const handle = await kvGet('lastFilmHandle');
    if (handle && !currentFile) {
      btnReopenFilm.querySelector('span').textContent = `Reopen ${handle.name}`;
      btnReopenFilm.classList.remove('hidden');
    }
  } catch (err) { /* nothing saved */ }
}

async function reopenLastFilm() {
  try {
    const handle = await kvGet('lastFilmHandle');
    if (!handle) return;
    let perm = await handle.queryPermission({ mode: 'read' });
    if (perm !== 'granted') perm = await handle.requestPermission({ mode: 'read' });
    if (perm !== 'granted') {
      showToast('Permission to read the film was not granted.', 'error');
      return;
    }
    loadVideoFile(await handle.getFile());
  } catch (err) {
    console.warn('Reopen failed', err);
    showToast("Couldn't reopen the last film. It may have been moved or renamed.", 'error');
    btnReopenFilm.classList.add('hidden');
  }
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
  
  // Work in whole frames and seek to the middle of the target frame, so
  // rounding can never land on the wrong frame or skip one.
  const base = pendingSeekTime !== null ? pendingSeekTime : mainVideo.currentTime;
  const targetFrame = frameIndexAt(base) + frameCount;
  seekVideoSafely(clampTime(timeForFrame(targetFrame)));
}

function frameIndexAt(time) {
  return Math.floor(time * mainVideoFrameRate + 1e-3);
}

function timeForFrame(frameIndex) {
  return (Math.max(0, frameIndex) + 0.5) / mainVideoFrameRate;
}

function clampTime(t) {
  // Keep a little clear of the very end, where some browsers show a black frame
  return Math.max(0, Math.min(Math.max(0, duration - 0.5 / mainVideoFrameRate), t));
}

function jumpTime(seconds) {
  if (!currentFile) return;
  
  seekVideoSafely(clampTime(mainVideo.currentTime + seconds));
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
  if (currentZoom === 1 || e.button > 0) return;
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
let adjacentRenderId = 0;

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
    
    const stepInterval = getStepInterval();
    const isFrameStep = adjacentStepSelect && adjacentStepSelect.value.endsWith('f');
    
    const currentTime = mainVideo.currentTime + adjacentOffsetTime;
    const currentFrame = frameIndexAt(currentTime);
    const offsets = [-3, -2, -1, 0, 1, 2, 3];
    const renderedFrames = [];
    const renderId = ++adjacentRenderId;
    
    // Generate each adjacent frame canvas
    for (let i = 0; i < offsets.length; i++) {
      if (renderId !== adjacentRenderId) return; // superseded by a newer render
      const offset = offsets[i];
      const targetTime = isFrameStep
        ? clampTime(timeForFrame(currentFrame + Math.round(offset * stepInterval * mainVideoFrameRate)))
        : clampTime(currentTime + (offset * stepInterval));
      
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
    if (isPlaying || renderId !== adjacentRenderId) return;
    
    // Display the frames
    adjacentFramesStrip.innerHTML = '';
    renderedFrames.forEach(frame => {
      const card = document.createElement('div');
      card.className = `frame-strip-card ${(frame.offset === 0 && adjacentOffsetTime === 0) ? 'current' : ''}`;
      makeActivatable(card, `Go to ${formatTime(frame.time)}`);
      
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
        seekVideoSafely(frame.time);
      });
      
      adjacentFramesStrip.appendChild(card);
    });
  }, 100);
}

// Small LRU cache of strip thumbnails (Map keeps insertion order)
const thumbnailCache = new Map();
const THUMB_CACHE_LIMIT = 240;
let explorerQueue = Promise.resolve();

function cacheThumbnail(key, value) {
  thumbnailCache.delete(key);
  thumbnailCache.set(key, value);
  while (thumbnailCache.size > THUMB_CACHE_LIMIT) {
    thumbnailCache.delete(thumbnailCache.keys().next().value);
  }
}

function seekAndWait(video, time) {
  return new Promise((resolve, reject) => {
    const onSeeked = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error('seek failed')); };
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.currentTime = time;
  });
}

function generateFrameThumbnail(time, width, height) {
  const frameIndex = frameIndexAt(time);
  const cacheKey = `${frameIndex}_${width}x${height}`;
  
  if (thumbnailCache.has(cacheKey)) {
    const hit = thumbnailCache.get(cacheKey);
    cacheThumbnail(cacheKey, hit);
    return Promise.resolve(hit);
  }
  if (!explorerVideo) return Promise.reject(new Error("Explorer video not initialized"));
  
  // Serialize seeks on the explorer video so concurrent requests can't swap frames
  const video = explorerVideo;
  const job = explorerQueue.then(async () => {
    await seekAndWait(video, time);
    explorerCanvas.width = width;
    explorerCanvas.height = height;
    explorerCtx.drawImage(video, 0, 0, width, height);
    const dataUrl = explorerCanvas.toDataURL('image/jpeg', 0.65);
    cacheThumbnail(cacheKey, dataUrl);
    return dataUrl;
  });
  explorerQueue = job.catch(() => {});
  return job;
}


/* --- 8. Full-Resolution Capture Engine --- */
let isCapturing = false;

async function captureCurrentFrame() {
  if (!currentFile || isCapturing || !mainVideo.videoWidth) return;
  if (isPlaying) togglePlay(); // grab exactly the frame on screen

  const captureTime = mainVideo.currentTime;

  // Skip duplicates: same film, same frame
  try {
    const existing = await getScreenshots(activeVideoName);
    const frame = frameIndexAt(captureTime);
    if (existing.some(item => frameIndexAt(item.timestamp) === frame)) {
      showToast(`Frame at ${formatTime(captureTime)} is already in your captures.`, 'warn');
      return;
    }
  } catch (err) { /* if the check fails, capture anyway */ }

  isCapturing = true;
  
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
  
  const formattedTime = formatTimeFilename(captureTime);
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
      const defaultTitle = `${stripExtension(activeVideoName)}_${formattedTime}`;
      
      try {
        await saveScreenshot(
          activeVideoName,
          captureTime,
          formatTime(captureTime),
          blob,
          thumbUrl,
          defaultTitle,
          resolution
        );
        
        await refreshGalleryView();
        showCaptureTray(thumbUrl);
      } catch (err) {
        console.error("Failed to cache screenshot", err);
        showToast('Saving the frame failed. Your browser storage may be full.', 'error');
      }
    }
    
    // Clear visual feedback
    videoLoading.classList.add('hidden');
    document.querySelector('#video-loading span').textContent = "Seeking to frame...";
    isCapturing = false;
  }, 'image/png');
}

function stripExtension(name) {
  return name.substring(0, name.lastIndexOf('.')) || name;
}

/* Small thumbnail tray shown in the Capture step so you can see each grab land */
let captureTrayTimer = null;
function showCaptureTray(thumbUrl) {
  captureTrayImg.src = thumbUrl;
  captureTrayCount.textContent = `${capturedCount} captured`;
  captureTray.classList.remove('hidden');
  captureTray.classList.remove('pop');
  void captureTray.offsetWidth;
  captureTray.classList.add('pop');
  clearTimeout(captureTrayTimer);
  captureTrayTimer = setTimeout(() => captureTray.classList.add('hidden'), 2500);
}


/* --- 9. Gallery Sidebar Operations --- */
let capturedCount = 0;
let lightboxUrl = null;
let galleryRenderUrls = [];

function updateCaptureBadges(count) {
  capturedCount = count;
  galleryCountBadge.textContent = count;
  reviewTabBadge.textContent = count;
  reviewTabBadge.classList.toggle('hidden', count === 0);
}

async function getShownScreenshots() {
  if (galleryScopeSelect.value === 'all') return getAllScreenshots();
  if (!activeVideoName) return [];
  return getScreenshots(activeVideoName);
}

async function refreshGalleryView() {
  if (!db) return;
  
  try {
    const showingAll = galleryScopeSelect.value === 'all';
    const list = await getShownScreenshots();

    // The badges always count the current film's captures
    if (activeVideoName) {
      const own = showingAll ? list.filter(i => i.videoName === activeVideoName).length : list.length;
      updateCaptureBadges(own);
    } else {
      updateCaptureBadges(0);
    }
    
    galleryRenderUrls.forEach(u => URL.revokeObjectURL(u));
    galleryRenderUrls = [];

    if (list.length === 0) {
      galleryEmptyView.classList.remove('hidden');
      btnDownloadAll.classList.add('disabled');
      btnClearGallery.classList.add('disabled');
      galleryItemsContainer.innerHTML = '';
      galleryItemsContainer.appendChild(galleryEmptyView);
      return;
    }
    
    galleryEmptyView.classList.add('hidden');
    btnDownloadAll.classList.remove('disabled');
    btnClearGallery.classList.remove('disabled');
    
    // Render list
    galleryItemsContainer.innerHTML = '';
    let lastFilm = null;
    
    list.forEach(item => {
      if (showingAll && item.videoName !== lastFilm) {
        lastFilm = item.videoName;
        const heading = document.createElement('div');
        heading.className = 'gallery-film-heading';
        heading.textContent = item.videoName;
        galleryItemsContainer.appendChild(heading);
      }

      const card = document.createElement('div');
      card.className = 'gallery-card';
      card.dataset.id = item.id;
      
      // Image container (opens a large preview)
      const thumb = document.createElement('div');
      thumb.className = 'gallery-card-thumb';
      makeActivatable(thumb, `Open large preview of ${item.title}`);
      thumb.addEventListener('click', () => openLightbox(item));
      
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
      titleInput.setAttribute('aria-label', 'Capture name');
      titleInput.addEventListener('change', async (e) => {
        try {
          await updateScreenshotTitle(item.id, e.target.value);
          item.title = e.target.value;
        } catch (err) {
          console.error("Rename failed", err);
        }
      });
      info.appendChild(titleInput);
      
      // Action row
      const actions = document.createElement('div');
      actions.className = 'gallery-card-actions';
      
      // Seek button (only for the film that's loaded)
      if (item.videoName === activeVideoName && currentFile) {
        const btnSeek = makeIconButton('history', 'Show this frame in the player');
        btnSeek.addEventListener('click', () => {
          switchWorkspace('capture');
          seekVideoSafely(item.timestamp);
        });
        actions.appendChild(btnSeek);
      }
      
      // Download button
      const btnDownload = makeIconButton('download', `Download as ${exportFormatSelect.value.toUpperCase()}`);
      btnDownload.addEventListener('click', async () => {
        const fmt = exportFormatSelect.value;
        const blob = await convertBlob(item.blob, fmt);
        downloadIndividualFile(blob, `${safeFileName(titleInput.value)}.${EXPORT_EXT[fmt]}`);
      });
      actions.appendChild(btnDownload);
      
      // Delete button (undoable)
      const btnDel = makeIconButton('trash-2', 'Delete capture', 'btn-danger');
      btnDel.addEventListener('click', () => deleteWithUndo([item]));
      actions.appendChild(btnDel);
      
      info.appendChild(actions);
      card.appendChild(info);
      
      galleryItemsContainer.appendChild(card);
    });
    
    // Create new Lucide icons inside dynamic nodes
    refreshIcons();
    
  } catch (err) {
    console.error("Failed to load gallery items", err);
  }
}

function makeIconButton(icon, label, variant = 'btn-secondary') {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `btn ${variant}`;
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.innerHTML = `<i data-lucide="${icon}" style="width:14px; height:14px;" aria-hidden="true"></i>`;
  return btn;
}

function openLightbox(item) {
  if (lightboxUrl) URL.revokeObjectURL(lightboxUrl);
  lightboxUrl = URL.createObjectURL(item.blob);
  lightboxImg.src = lightboxUrl;
  lightboxImg.alt = item.title;
  lightboxCaption.textContent = `${item.title} · ${item.timestampFormatted} · ${item.resolution}`;
  lightboxDialog.showModal();
}

async function deleteWithUndo(items) {
  try {
    for (const item of items) await deleteScreenshot(item.id);
  } catch (err) {
    console.error("Delete failed", err);
    showToast('Delete failed.', 'error');
  }
  await refreshGalleryView();
  const label = items.length === 1 ? 'Capture deleted.' : `${items.length} captures deleted.`;
  showToast(label, 'info', {
    actionLabel: 'Undo',
    onAction: async () => {
      for (const item of items) {
        await dbRequest('screenshots', 'readwrite', st => st.put(item));
      }
      refreshGalleryView();
    }
  });
}

async function clearShownScreenshots() {
  const list = await getShownScreenshots();
  if (!list.length) return;
  const scope = galleryScopeSelect.value === 'all' ? 'from all films' : `from ${activeVideoName}`;
  const ok = await confirmDialog(`Delete all ${list.length} captures ${scope}?`, 'Delete all');
  if (ok) deleteWithUndo(list);
}

function downloadIndividualFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const EXPORT_EXT = { png: 'png', jpeg: 'jpg', webp: 'webp' };

function safeFileName(name) {
  return (name || 'frame').replace(/[\\/:*?"<>|]/g, "_").trim() || 'frame';
}

// Re-encode a stored PNG into the chosen export format
async function convertBlob(blob, format) {
  if (format === 'png') return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  bitmap.close();
  const type = format === 'jpeg' ? 'image/jpeg' : 'image/webp';
  const out = await new Promise(res => canvas.toBlob(res, type, 0.92));
  return out || blob;
}

async function downloadAllAsZip() {
  if (btnDownloadAll.classList.contains('disabled')) return;
  
  try {
    const list = await getShownScreenshots();
    if (list.length === 0) return;
    const fmt = exportFormatSelect.value;
    const ext = EXPORT_EXT[fmt];
    const showingAll = galleryScopeSelect.value === 'all';
    
    // Visual Feedback
    btnDownloadAll.innerHTML = '<div class="spinner" style="width:12px; height:12px; border-width:2px; margin:0;"></div><span>Zipping...</span>';
    btnDownloadAll.classList.add('disabled');
    
    const zip = new JSZip();
    const usedNames = new Set();
    
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const folder = showingAll ? `${safeFileName(stripExtension(item.videoName))}/` : '';
      // Never let two captures share a filename (JSZip would silently overwrite one)
      let base = `${folder}${safeFileName(item.title)}`;
      let name = `${base}.${ext}`;
      for (let n = 2; usedNames.has(name.toLowerCase()); n++) name = `${base} (${n}).${ext}`;
      usedNames.add(name.toLowerCase());
      zip.file(name, await convertBlob(item.blob, fmt));
      btnDownloadAll.querySelector('span').textContent = `Preparing ${i + 1}/${list.length}`;
    }
    
    // Images are already compressed, so store them as-is: much faster and lighter on memory
    const content = await zip.generateAsync({ type: 'blob', compression: 'STORE', streamFiles: true });
    
    const zipName = showingAll ? 'CineSnap_all_captures.zip' : `${stripExtension(activeVideoName)}_captures.zip`;
    downloadIndividualFile(content, zipName);
  } catch (err) {
    console.error("Failed to bundle ZIP archive", err);
    showToast("Zipping failed. Try downloading files individually.", 'error');
  } finally {
    btnDownloadAll.innerHTML = '<i data-lucide="archive-restore" aria-hidden="true"></i><span>Download All</span>';
    btnDownloadAll.classList.remove('disabled');
    refreshIcons();
  }
}


/* --- 10. Background Scene & Shot Detector --- */
/* How it works: the scanner samples a tiny copy of the picture every few
   seconds. When two samples differ, it binary-searches between them to find
   the exact frame of each cut, so cuts are frame-accurate and several cuts
   inside one interval are all found. Every cut keeps its difference score, and
   the Detection Threshold dropdown just filters by score, so changing it never
   needs a rescan. Progress is saved to IndexedDB as the scan runs. */
const SCAN_W = 32;
const SCAN_H = 18;
const MAX_CUTS_PER_INTERVAL = 12;

function toggleBackgroundScan() {
  if (isScanning) {
    stopBackgroundScan();
  } else {
    startBackgroundScan();
  }
}

function setScanUiState(state) {
  const playIco = btnToggleScan.querySelector('.btn-icon-play');
  const pauseIco = btnToggleScan.querySelector('.btn-icon-pause');
  const running = state === 'scanning';
  playIco.classList.toggle('hidden', running);
  pauseIco.classList.toggle('hidden', !running);
  scanModeSelect.disabled = running;

  btnToggleScan.classList.toggle('hidden', state === 'complete');
  btnRescan.classList.toggle('hidden', state === 'ready' || state === 'scanning');
  btnRescan.querySelector('span').textContent = state === 'complete' ? 'Rescan' : 'Start Over';
  scanProgressContainer.classList.toggle('hidden', !(running || state === 'paused'));

  const cuts = Math.max(0, visibleShots().length - 1);
  const labels = {
    ready: ['Scan Film', 'Not scanned yet'],
    scanning: ['Pause Scan', 'Scanning…'],
    paused: ['Resume Scan', 'Paused'],
    complete: ['Scan Film', `Scan complete · ${cuts} cut${cuts === 1 ? '' : 's'}`]
  };
  scanToggleText.textContent = labels[state][0];
  scannerStatusBadge.textContent = labels[state][1];
  scannerStatusBadge.dataset.state = state;
}

function updateScanProgressUi() {
  if (duration > 0) {
    const pct = Math.min(100, (scanCurrentTime / duration) * 100);
    scanProgressFill.style.width = `${pct}%`;
    scanPercentText.textContent = `${Math.round(pct)}%`;
  }
}

async function startBackgroundScan({ fresh = false } = {}) {
  if (!currentFile || !scannerVideo || !duration) return;
  if (isScanning) stopBackgroundScan({ silent: true });

  if (fresh || scanComplete || scanCurrentTime <= 0) {
    detectedShots = [];
    scenePartitions = [0];
    scanCurrentTime = 0;
    scanComplete = false;
    lastFrameData = null;
  }
  scanInterval = parseFloat(scanModeSelect.value);
  
  isScanning = true;
  const token = ++scanToken;
  setScanUiState('scanning');
  updateScanProgressUi();
  overviewTabsContainer.classList.remove('hidden');
  if (detectedShots.length) rerenderOverview(true);

  clearInterval(scanSaveTimer);
  scanSaveTimer = setInterval(saveScanProgress, 4000);

  try {
    await runScanLoop(token);
  } catch (err) {
    if (err && err.cancelled) return;
    console.error('Scan failed', err);
    showToast('The scan stopped because a frame could not be read.', 'error');
    stopBackgroundScan();
  }
}

function stopBackgroundScan({ silent = false } = {}) {
  const wasScanning = isScanning;
  isScanning = false;
  scanToken++;
  clearInterval(scanSaveTimer);
  if (wasScanning) saveScanProgress();
  if (!silent && currentFile) setScanUiState('paused');
}

function finishBackgroundScan() {
  isScanning = false;
  scanComplete = true;
  scanCurrentTime = duration;
  clearInterval(scanSaveTimer);
  saveScanProgress();
  setScanUiState('complete');
  
  // Re-render overview to ensure latest shots
  showScenesOverview();
  
  // Move on to Capture once the scan is done, if they're still on Import
  if (currentWorkspace === 'import') switchWorkspace('capture');
}

function saveScanProgress() {
  if (!currentFilmKey || !db) return Promise.resolve();
  if (!detectedShots.length && scanCurrentTime === 0) return Promise.resolve();
  return putScan({
    filmKey: currentFilmKey,
    videoName: activeVideoName,
    shots: detectedShots,
    partitions: scenePartitions,
    scanTime: scanCurrentTime,
    complete: scanComplete,
    sensitivity: parseInt(sensitivitySelect.value, 10),
    interval: parseFloat(scanModeSelect.value),
    savedAt: Date.now()
  }).catch(err => console.warn('Saving scan failed', err));
}

function cancelledError() {
  const e = new Error('scan cancelled');
  e.cancelled = true;
  return e;
}

async function sampleAt(time, token) {
  await seekAndWait(scannerVideo, time);
  if (token !== scanToken) throw cancelledError();
  scannerCtx.drawImage(scannerVideo, 0, 0, SCAN_W, SCAN_H);
  return scannerCtx.getImageData(0, 0, SCAN_W, SCAN_H).data;
}

function frameDiff(a, b) {
  let diff = 0;
  for (let i = 0; i < a.length; i += 4) {
    diff += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
  }
  return diff / (SCAN_W * SCAN_H * 3); // average channel change, 0-255
}

function averageLuminance(data) {
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return total / (SCAN_W * SCAN_H);
}

async function thumbnailAt(time, token) {
  await seekAndWait(scannerVideo, time);
  if (token !== scanToken) throw cancelledError();
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 90;
  c.getContext('2d').drawImage(scannerVideo, 0, 0, 160, 90);
  return c.toDataURL('image/jpeg', 0.65);
}

function checkSceneBoundary(time, data) {
  const lastPartition = scenePartitions[scenePartitions.length - 1];
  if (averageLuminance(data) < 7) {
    // Fade-to-black starts a new scene if it's been at least 15s since the last one
    if (time - lastPartition > 15) {
      scenePartitions.push(time);
      return true;
    }
  } else if (time - lastPartition > sceneTimeBlockSize) {
    // Fallback: no fade-to-black for 5 minutes, so start a new block
    scenePartitions.push(time);
    return true;
  }
  return false;
}

async function addCut(time, score, token) {
  const snapped = timeForFrame(frameIndexAt(time));
  const frameDur = 1 / mainVideoFrameRate;
  if (detectedShots.some(s => Math.abs(s.time - snapped) < frameDur * 0.75)) return;
  const thumbUrl = await thumbnailAt(snapped, token);
  detectedShots.push({ time: snapped, thumbUrl, score: Math.round(score * 10) / 10 });
  detectedShots.sort((a, b) => a.time - b.time);
}

// Find every cut between two samples that differ, to single-frame accuracy
async function refineCuts(lo, loData, hi, hiData, token) {
  const frameDur = 1 / mainVideoFrameRate;
  for (let found = 0; found < MAX_CUTS_PER_INTERVAL && hi - lo > frameDur * 1.01; found++) {
    let a = lo, aData = loData, b = hi, bData = hiData;
    while (b - a > frameDur * 1.01) {
      const m = (a + b) / 2;
      const mData = await sampleAt(m, token);
      if (frameDiff(aData, mData) > SCAN_FLOOR_THRESHOLD) { b = m; bData = mData; }
      else { a = m; aData = mData; }
    }
    const score = frameDiff(aData, bData);
    if (score > SCAN_FLOOR_THRESHOLD) await addCut(b, score, token);
    // Anything else changing between this cut and the end of the interval?
    if (frameDiff(bData, hiData) <= SCAN_FLOOR_THRESHOLD) break;
    lo = b;
    loData = bData;
  }
}

async function runScanLoop(token) {
  let prevT = scanCurrentTime;
  let prev = await sampleAt(prevT, token);

  if (prevT === 0 && detectedShots.length === 0) {
    // Always register the opening shot so the first scene has a thumbnail
    detectedShots.push({ time: 0, thumbUrl: await thumbnailAt(0, token), score: Infinity });
    rerenderOverview(true);
  }

  const end = Math.max(0, duration - 0.5 / mainVideoFrameRate);
  while (prevT < end) {
    const t = Math.min(end, prevT + scanInterval);
    const cur = await sampleAt(t, token);
    const newScene = checkSceneBoundary(t, cur);
    const shotsBefore = detectedShots.length;
    if (frameDiff(prev, cur) > SCAN_FLOOR_THRESHOLD) {
      await refineCuts(prevT, prev, t, cur, token);
      // the refine step moved the scanner; nothing else needs restoring
    }
    prevT = t;
    prev = cur;
    scanCurrentTime = t;
    lastFrameData = cur;
    updateScanProgressUi();
    if (newScene || detectedShots.length !== shotsBefore) rerenderOverview();
    // Yield so the UI stays responsive
    await new Promise(r => setTimeout(r, 0));
    if (token !== scanToken) return;
  }
  if (token === scanToken) finishBackgroundScan();
}

// Shots that pass the current Detection Threshold
function visibleShots() {
  const threshold = parseInt(sensitivitySelect.value, 10);
  return detectedShots.filter(s => s.score === undefined || s.score >= threshold);
}

let overviewRenderTimer = null;
function rerenderOverview(immediate = false) {
  const doRender = () => {
    overviewRenderTimer = null;
    if (currentExpandedSceneIdx === -1) renderScenesGrid();
    else renderShotsGrid(currentExpandedSceneIdx);
    if (scannerStatusBadge.dataset.state === 'complete') setScanUiState('complete');
  };
  if (immediate) { clearTimeout(overviewRenderTimer); doRender(); return; }
  if (!overviewRenderTimer) overviewRenderTimer = setTimeout(doRender, 400);
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
  
  const shotsList = visibleShots();
  for (let i = 0; i < scenePartitions.length; i++) {
    const startTime = scenePartitions[i];
    const endTime = (i + 1 < scenePartitions.length) ? scenePartitions[i + 1] : duration;
    
    // Find shots that fall within this scene partition range
    const shotsInBlock = shotsList.filter(s => s.time >= startTime && s.time < endTime);
    
    // Card representation
    const card = document.createElement('div');
    card.className = 'scene-card';
    makeActivatable(card, `Scene ${i + 1}, ${formatTimeShort(startTime)} to ${formatTimeShort(endTime)}`);
    
    // Thumb selection: first shot in this scene, or fallback to closest prior shot
    let thumbUrl = "";
    if (shotsInBlock.length > 0) {
      thumbUrl = shotsInBlock[0].thumbUrl;
    } else {
      const priorShots = shotsList.filter(s => s.time < startTime);
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
    sub.textContent = `${shotsInBlock.length} shot${shotsInBlock.length === 1 ? '' : 's'}`;
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
  const shotsList = visibleShots();
  const shots = shotsList.filter(s => s.time >= startTime && s.time < endTime);
  
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
    makeActivatable(item, `Scene ${i + 1}`);
    
    // Thumbnail (rendered for Normal view, hidden by CSS in Compact view)
    const img = document.createElement('img');
    img.className = 'sidebar-scene-item-thumb';
    const sceneStartTime = scenePartitions[i];
    const firstShot = shotsList.find(s => s.time >= sceneStartTime) || shotsList[shotsList.length - 1];
    img.alt = '';
    if (firstShot) img.src = firstShot.thumbUrl;
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
      makeActivatable(card, `Shot ${idx + 1} at ${formatTime(shot.time)}`);
      
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
        if (isPlaying) togglePlay(); // Pause to inspect frame
        seekVideoSafely(shot.time);
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
  if (activeRecordAction !== null || e.defaultPrevented) return;
  if (document.querySelector('dialog[open]')) return; // dialogs own the keyboard

  // Don't steal keys from focused controls: inputs, dropdowns and text areas keep
  // every key; buttons and clickable cards keep Space and Enter (their own activation).
  const t = e.target;
  const tag = t && t.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) return;
  const isActivator = tag === 'BUTTON' || tag === 'A' || tag === 'LABEL' || (t && t.getAttribute && t.getAttribute('role') === 'button');
  if (isActivator && (e.key === ' ' || e.key === 'Enter')) return;

  if (!currentFile) return;
  
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
  if (matchShortcut(e, shortcuts.playPause) || matchShortcut(e, shortcuts.playPauseAlt)) {
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
  else if (matchShortcut(e, shortcuts.grabFrame) || matchShortcut(e, shortcuts.grabFrameAlt)) {
    e.preventDefault();
    captureCurrentFrame();
  }
  else if (matchShortcut(e, shortcuts.speedDown)) {
    e.preventDefault();
    decreaseSpeed();
  }
  else if (matchShortcut(e, shortcuts.speedUp)) {
    e.preventDefault();
    increaseSpeed();
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
  if (!config || !config.key) return false;
  
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
    showToast(`Speed ${nextVal}x`);
  }
}

function increaseSpeed() {
  const speeds = [0.1, 0.25, 0.5, 1.0, 1.5, 2.0, 4.0];
  const curIdx = speeds.indexOf(parseFloat(speedSelect.value));
  if (curIdx < speeds.length - 1) {
    const nextVal = speeds[curIdx + 1];
    speedSelect.value = String(nextVal);
    mainVideo.playbackRate = nextVal;
    showToast(`Speed ${nextVal}x`);
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

// In-app toast (replaces native alert). type: info | warn | error
let toastTimer = null;
function showToast(message, type = 'info', { actionLabel, onAction, duration: ms } = {}) {
  copyToastText.textContent = message;
  copyToast.dataset.type = type;
  copyToast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toastAction.classList.toggle('hidden', !actionLabel);
  toastAction.onclick = null;
  if (actionLabel) {
    toastAction.textContent = actionLabel;
    toastAction.onclick = () => {
      copyToast.classList.add('hidden');
      onAction && onAction();
    };
  }
  copyToast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => copyToast.classList.add('hidden'), ms || (actionLabel ? 6000 : 3000));
}

// In-app confirm (replaces native confirm). Resolves true/false.
function confirmDialog(message, okLabel = 'OK') {
  return new Promise((resolve) => {
    confirmMessage.textContent = message;
    confirmOk.textContent = okLabel;
    const finish = (val) => {
      confirmOk.onclick = confirmCancel.onclick = null;
      confirmDialogEl.removeEventListener('close', onClose);
      if (confirmDialogEl.open) confirmDialogEl.close();
      resolve(val);
    };
    const onClose = () => finish(false);
    confirmOk.onclick = () => finish(true);
    confirmCancel.onclick = () => finish(false);
    confirmDialogEl.addEventListener('close', onClose);
    confirmDialogEl.showModal();
    confirmCancel.focus();
  });
}

// Make a non-button element keyboard-reachable and announce it as a button
function makeActivatable(el, label) {
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  if (label) el.setAttribute('aria-label', label);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      el.click();
    }
  });
}

function refreshIcons() {
  if (window.lucide) lucide.createIcons();
}

/* --- 14. Panel Resizing Logic --- */
function startResizeY(e) {
  e.preventDefault();
  if (resizerY.setPointerCapture) resizerY.setPointerCapture(e.pointerId);
  isResizingY = true;
  resizerY.classList.add('dragging');
  const isSplit = mainLayout.classList.contains('layout-split');
  document.body.style.cursor = isSplit ? 'col-resize' : 'row-resize';
  document.body.style.userSelect = 'none';
}

function startResizeX(e) {
  e.preventDefault();
  if (resizerX.setPointerCapture) resizerX.setPointerCapture(e.pointerId);
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
  if (!previewVideo) return;
  
  if (isScrubSeeking) {
    pendingScrubTime = time;
    return;
  }
  
  isScrubSeeking = true;
  
  // Handle seeked event once
  const video = previewVideo;
  const onSeeked = () => {
    video.removeEventListener('seeked', onSeeked);
    
    // Draw preview frame to scrub canvas (own video element, so it can't clash with the frame strip)
    scrubPreviewCanvas.width = 120;
    scrubPreviewCanvas.height = 68;
    if (scrubPreviewCtx) {
      scrubPreviewCtx.drawImage(video, 0, 0, 120, 68);
    }
    
    isScrubSeeking = false;
    
    // Process any deferred seek requests
    if (pendingScrubTime !== null) {
      const nextTime = pendingScrubTime;
      pendingScrubTime = null;
      triggerScrubSeek(nextTime);
    }
  };
  
  video.addEventListener('seeked', onSeeked);
  video.currentTime = time;
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
  shortcuts = JSON.parse(JSON.stringify(DEFAULT_SHORTCUTS));
  saveCustomShortcuts();
  renderShortcutsEditor();
  setShortcutsNotice('All shortcuts restored to their defaults.');
}

function setShortcutsNotice(text) {
  if (shortcutsNotice) shortcutsNotice.textContent = text;
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
    keyBtn.type = 'button';
    keyBtn.title = "Click to remap this keybind";
    keyBtn.setAttribute('aria-label', `${config.label}: ${formatKeybindString(config)}. Activate to change.`);
    
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
  
  if (!config.key) return "Unbound";
  let keyDisplayName = config.key;
  if (config.key === " ") {
    keyDisplayName = "Space";
  } else if (config.key === "ArrowRight") {
    keyDisplayName = "Right Arrow";
  } else if (config.key === "ArrowLeft") {
    keyDisplayName = "Left Arrow";
  } else if (config.key === "Enter") {
    keyDisplayName = "Enter";
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
  
  // Escape cancels recording
  if (e.key === 'Escape') {
    stopRecordingUI();
    renderShortcutsEditor();
    return;
  }

  if (activeRecordAction !== null) {
    const action = activeRecordAction;
    const combo = { key: e.key, shift: e.shiftKey, alt: e.altKey, ctrl: e.ctrlKey || e.metaKey };

    if (['1', '2', '3'].includes(e.key) && !combo.shift && !combo.alt && !combo.ctrl) {
      setShortcutsNotice('1, 2 and 3 are reserved for switching workspaces. Pick another key.');
      stopRecordingUI();
      renderShortcutsEditor();
      return;
    }

    // Unbind any other action already using this combination, and say so
    const conflicts = [];
    for (const other in shortcuts) {
      const o = shortcuts[other];
      if (other !== action && o.key && o.key.toLowerCase() === combo.key.toLowerCase() &&
          o.shift === combo.shift && o.alt === combo.alt && o.ctrl === combo.ctrl) {
        o.key = '';
        conflicts.push(o.label);
      }
    }
    
    // Save new config
    Object.assign(shortcuts[action], combo);
    setShortcutsNotice(conflicts.length
      ? `${formatKeybindString(combo)} was used by "${conflicts.join('", "')}", which is now unbound.`
      : `${shortcuts[action].label} is now ${formatKeybindString(combo)}.`);
    
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
  
  // Toggle active switcher tabs class
  document.querySelectorAll('.ws-tab').forEach(tab => {
    const active = tab.getAttribute('data-ws') === wsName;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  
  // Apply workspace layout class to body (keeping unrelated state classes)
  document.body.classList.remove('ws-import', 'ws-capture', 'ws-review');
  document.body.classList.add(`ws-${wsName}`);

  // Leaving Capture: pause playback so it doesn't run unseen
  if (wsName === 'review' && isPlaying) togglePlay();
  
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
  
  refreshIcons();
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

function getStepInterval() {
  const stepVal = adjacentStepSelect ? adjacentStepSelect.value : '1f';
  const steps = { '1f': 1 / mainVideoFrameRate, '10f': 10 / mainVideoFrameRate, '1s': 1, '5s': 5, '10s': 10 };
  return steps[stepVal] || steps['1f'];
}

function scrubByStep(direction) {
  if (!currentFile) return;
  const stepVal = adjacentStepSelect ? adjacentStepSelect.value : '1f';
  if (stepVal.endsWith('f')) {
    stepFrames(direction * parseInt(stepVal, 10));
  } else {
    seekVideoSafely(clampTime(mainVideo.currentTime + direction * getStepInterval()));
  }
}

function scrubAdjacentUnsynced(direction) {
  if (!currentFile) return;
  
  adjacentOffsetTime += direction * getStepInterval();
  
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
  refreshIcons();
  
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
  refreshIcons();
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
  
  // Play mechanical shutter click sound (can be muted)
  if (soundEnabled) playShutterSound();
}

let soundEnabled = localStorage.getItem('cinesnap_sound') !== 'off';
let sharedAudioCtx = null;

function updateSoundButton() {
  const label = soundEnabled ? 'Shutter sound on (click to mute)' : 'Shutter sound off (click to unmute)';
  btnToggleSound.title = label;
  btnToggleSound.setAttribute('aria-label', label);
  btnToggleSound.setAttribute('aria-pressed', soundEnabled ? 'false' : 'true');
  btnToggleSound.innerHTML = `<i data-lucide="${soundEnabled ? 'volume-2' : 'volume-x'}" aria-hidden="true"></i>`;
  refreshIcons();
}

function playShutterSound() {
  try {
    // One shared AudioContext; creating one per grab leaks audio resources
    if (!sharedAudioCtx) sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioCtx = sharedAudioCtx;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
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



