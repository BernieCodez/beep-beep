// Main application state and initialization

// Global state
const FIELD_SIZE = 144;
const SCALE = 4;
const CANVAS_SIZE = FIELD_SIZE * SCALE;

// Uploaded file storage
let uploadedFileContent = null;
let uploadedFileName = null;
let parsedPathInfo = null; // Stores info about parsed paths for export

// Robot configurations
let robots = [
  {
    id: 0,
    name: 'Robot 1',
    pos: { x: 0, y: 0, heading: 0 },
    size: 18,
    color: '#4CAF50',
    paths: [],
    currentPath: []
  },
  {
    id: 1,
    name: 'Robot 2',
    pos: { x: 0, y: 48, heading: 180 },
    size: 18,
    color: '#FF5722',
    paths: [],
    currentPath: []
  }
];
let activeRobotId = 0;

let selectedPoint = null;
let selectedControlPoint = null;
let isDragging = false;
let draggingRobot = false;
let mode = 'spline';
let showControlPoints = true;
let animating = false;
let animationProgress = 0;

// Undo/Redo state
let history = [];
let historyIndex = -1;
const MAX_HISTORY = 50;

// Map and theme
let currentMap = 'none';
let currentTheme = 'dark';
let mapImage = null;

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = CANVAS_SIZE;
canvas.height = CANVAS_SIZE;

// Initialize
function init() {
  saveState();
  updateRobotButtons();
  drawCanvas();
  updateUI();
  setupEventListeners();
}

// Mode selection
function setMode(newMode) {
  mode = newMode;
  document.getElementById('splineBtn').classList.toggle('active', mode === 'spline');
  document.getElementById('linearBtn').classList.toggle('active', mode === 'linear');
  drawCanvas();
}

// Toggle control points
function toggleControlPoints() {
  showControlPoints = document.getElementById('showControlPoints').checked;
  drawCanvas();
}

// Undo/Redo functions
function saveState() {
  const state = {
    robots: JSON.parse(JSON.stringify(robots)),
    activeRobotId: activeRobotId
  };
  
  // Remove any states after current index
  history = history.slice(0, historyIndex + 1);
  
  // Add new state
  history.push(state);
  
  // Limit history size
  if (history.length > MAX_HISTORY) {
    history.shift();
  } else {
    historyIndex++;
  }
  
  updateUI();
}

function undo() {
  if (historyIndex > 0) {
    historyIndex--;
    restoreState(history[historyIndex]);
  }
}

function redo() {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    restoreState(history[historyIndex]);
  }
}

function restoreState(state) {
  robots = JSON.parse(JSON.stringify(state.robots));
  activeRobotId = state.activeRobotId || 0;
  
  const robot = getActiveRobot();
  document.getElementById('robotX').value = robot.pos.x;
  document.getElementById('robotY').value = robot.pos.y;
  document.getElementById('robotHeading').value = robot.pos.heading;
  document.getElementById('robotSize').value = robot.size;
  document.getElementById('robotName').value = robot.name;
  document.getElementById('robotColor').value = robot.color;
  
  selectedPoint = null;
  selectedControlPoint = null;
  
  updateUI();
  drawCanvas();
}

// Map management
function changeMap(mapName) {
  currentMap = mapName;
  if (mapName === 'none') {
    mapImage = null;
    drawCanvas();
  } else {
    const img = new Image();
    img.onload = function() {
      mapImage = img;
      drawCanvas();
    };
    img.src = `maps/${mapName}.png`;
  }
  updateMapButtons();
}

function updateMapButtons() {
  const buttons = document.querySelectorAll('.btn-map');
  buttons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.map === currentMap);
  });
}

// Theme management
function changeTheme(theme) {
  currentTheme = theme;
  document.body.classList.toggle('light-theme', theme === 'light');
  updateThemeButtons();
  drawCanvas();
}

function updateThemeButtons() {
  const buttons = document.querySelectorAll('.btn-theme');
  buttons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === currentTheme);
  });
}

// UI updates
function updateUI() {
  const robot = getActiveRobot();
  
  document.getElementById('currentPathInfo').textContent = `${robot.currentPath.length} waypoints`;
  document.getElementById('pathCount').textContent = robot.paths.length;
  document.getElementById('finalizeBtn').disabled = robot.currentPath.length < 2;
  const hasAnyPaths = robots.some(r => r.paths.length > 0);
  document.getElementById('animateBtn').disabled = !hasAnyPaths;
  document.getElementById('undoBtn').disabled = historyIndex <= 0;
  document.getElementById('redoBtn').disabled = historyIndex >= history.length - 1;

  const pathsList = document.getElementById('pathsList');
  pathsList.innerHTML = '';
  robot.paths.forEach((path, idx) => {
    const div = document.createElement('div');
    div.className = 'path-item';
    div.textContent = `Path ${idx + 1}: ${path.type} (${path.points.length} points)`;
    pathsList.appendChild(div);
  });

  const selectedPointPanel = document.getElementById('selectedPointPanel');
  const deleteBtn = document.getElementById('deletePointBtn');
  
  if (selectedPoint !== null && selectedPoint < robot.currentPath.length) {
    const point = robot.currentPath[selectedPoint];
    selectedPointPanel.innerHTML = `
      <div class="selected-point">
        <div style="font-weight: 600; margin-bottom: 0.5rem;">Selected Point ${selectedPoint}</div>
        <label>
          Heading: <input type="number" id="selectedHeading" value="${point.heading}" onchange="updateSelectedHeading()">°
        </label>
        <label>
          Wait: <input type="number" id="selectedWait" value="${point.waitDuration || 0}" min="0" step="0.5" onchange="updateSelectedWait()" style="width: 60px;"> sec
        </label>
      </div>
    `;
    deleteBtn.style.display = 'block';
    deleteBtn.disabled = false;
  } else {
    selectedPointPanel.innerHTML = '';
    deleteBtn.style.display = 'none';
    deleteBtn.disabled = true;
  }
}

// Event listeners setup
function setupEventListeners() {
  // Mouse events
  canvas.addEventListener('click', handleCanvasClick);
  canvas.addEventListener('mousedown', handleCanvasMouseDown);
  canvas.addEventListener('mousemove', handleCanvasMouseMove);
  canvas.addEventListener('mouseup', handleCanvasMouseUp);
  canvas.addEventListener('mouseleave', handleCanvasMouseUp);

  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.key === 'z' && e.shiftKey || e.key === 'y') {
        e.preventDefault();
        redo();
      }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedPoint !== null && !e.target.matches('input')) {
        e.preventDefault();
        deleteSelectedPoint();
      }
    }
  });

  // Modal close events
  document.addEventListener('click', function(event) {
    const modal = document.getElementById('pasteModal');
    if (event.target === modal) {
      closePasteModal();
    }
  });

  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
      const modal = document.getElementById('pasteModal');
      if (modal.classList.contains('show')) {
        closePasteModal();
      }
    }
  });
}

// Mouse event handlers
function handleCanvasClick(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX / SCALE - 72;
  const y = 72 - (e.clientY - rect.top) * scaleY / SCALE;

  const robot = getActiveRobot();
  const allPoints = [...robot.paths.flatMap(p => p.points), ...robot.currentPath];
  for (let i = 0; i < allPoints.length; i++) {
    const point = allPoints[i];
    const dist = Math.sqrt(Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2));
    if (dist < 8 / SCALE) {
      selectedPoint = i;
      updateUI();
      return;
    }

    if (showControlPoints && mode === 'spline') {
      if (point.controlPoint1) {
        const dist1 = Math.sqrt(Math.pow(point.controlPoint1.x - x, 2) + Math.pow(point.controlPoint1.y - y, 2));
        if (dist1 < 6 / SCALE) {
          selectedControlPoint = { idx: i, type: 'cp1' };
          updateUI();
          return;
        }
      }
      if (point.controlPoint2) {
        const dist2 = Math.sqrt(Math.pow(point.controlPoint2.x - x, 2) + Math.pow(point.controlPoint2.y - y, 2));
        if (dist2 < 6 / SCALE) {
          selectedControlPoint = { idx: i, type: 'cp2' };
          updateUI();
          return;
        }
      }
    }
  }

  // Only add starting point if there are no paths and no current path
  if (robot.currentPath.length === 0 && robot.paths.length === 0) {
    const startPoint = {
      x: robot.pos.x,
      y: robot.pos.y,
      heading: robot.pos.heading,
      waitDuration: 0
    };
    robot.currentPath.push(startPoint);
  } else if (robot.currentPath.length === 0 && robot.paths.length > 0) {
    // If starting a new path after finalizing, start from the end of the last path
    const lastPath = robot.paths[robot.paths.length - 1];
    const lastPoint = lastPath.points[lastPath.points.length - 1];
    const startPoint = {
      x: lastPoint.x,
      y: lastPoint.y,
      heading: lastPoint.heading,
      waitDuration: 0
    };
    robot.currentPath.push(startPoint);
  }
  
  const newPoint = { 
    x: Math.round(x), 
    y: Math.round(y), 
    heading: robot.currentPath.length > 0 ? robot.currentPath[robot.currentPath.length - 1].heading : robot.pos.heading,
    waitDuration: 0
  };
  
  if (mode === 'spline') {
    if (robot.currentPath.length > 0) {
      const prev = robot.currentPath[robot.currentPath.length - 1];
      const dx = newPoint.x - prev.x;
      const dy = newPoint.y - prev.y;
      prev.controlPoint2 = { x: prev.x + dx / 3, y: prev.y + dy / 3 };
      newPoint.controlPoint1 = { x: prev.x + 2 * dx / 3, y: prev.y + 2 * dy / 3 };
    }
  }
  
  robot.currentPath.push(newPoint);
  selectedPoint = null;
  selectedControlPoint = null;
  saveState();
  updateUI();
  drawCanvas();
}

function handleCanvasMouseDown(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX / SCALE - 72;
  const y = 72 - (e.clientY - rect.top) * scaleY / SCALE;

  const robot = getActiveRobot();
  
  // Check if clicking on active robot
  const robotDist = Math.sqrt(Math.pow(robot.pos.x - x, 2) + Math.pow(robot.pos.y - y, 2));
  if (robotDist < robot.size / 2) {
    draggingRobot = true;
    isDragging = true;
    return;
  }

  // Check control points first (they're smaller and should have priority)
  if (showControlPoints && mode === 'spline') {
    for (let i = 0; i < robot.currentPath.length; i++) {
      const point = robot.currentPath[i];
      if (point.controlPoint1) {
        const dist1 = Math.sqrt(Math.pow(point.controlPoint1.x - x, 2) + Math.pow(point.controlPoint1.y - y, 2));
        if (dist1 < 6 / SCALE) {
          selectedControlPoint = { idx: i, type: 'cp1' };
          isDragging = true;
          updateUI();
          return;
        }
      }
      if (point.controlPoint2) {
        const dist2 = Math.sqrt(Math.pow(point.controlPoint2.x - x, 2) + Math.pow(point.controlPoint2.y - y, 2));
        if (dist2 < 6 / SCALE) {
          selectedControlPoint = { idx: i, type: 'cp2' };
          isDragging = true;
          updateUI();
          return;
        }
      }
    }
  }

  // Then check waypoints
  for (let i = 0; i < robot.currentPath.length; i++) {
    const point = robot.currentPath[i];
    const dist = Math.sqrt(Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2));
    if (dist < 8 / SCALE) {
      selectedPoint = i;
      isDragging = true;
      updateUI();
      return;
    }
  }
}

function handleCanvasMouseMove(e) {
  if (!isDragging) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = Math.round((e.clientX - rect.left) * scaleX / SCALE - 72);
  const y = Math.round(72 - (e.clientY - rect.top) * scaleY / SCALE);

  const robot = getActiveRobot();
  
  if (draggingRobot) {
    robot.pos.x = Math.max(-72, Math.min(72, x));
    robot.pos.y = Math.max(-72, Math.min(72, y));
    document.getElementById('robotX').value = robot.pos.x;
    document.getElementById('robotY').value = robot.pos.y;
    drawCanvas();
  } else if (selectedPoint !== null) {
    robot.currentPath[selectedPoint] = { ...robot.currentPath[selectedPoint], x, y };
    drawCanvas();
  } else if (selectedControlPoint) {
    const point = robot.currentPath[selectedControlPoint.idx];
    if (selectedControlPoint.type === 'cp1') {
      point.controlPoint1 = { x, y };
    } else {
      point.controlPoint2 = { x, y };
    }
    drawCanvas();
  }
}

function handleCanvasMouseUp() {
  if (isDragging && (draggingRobot || selectedPoint !== null || selectedControlPoint !== null)) {
    saveState();
  }
  isDragging = false;
  draggingRobot = false;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
