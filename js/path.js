// Path operations and animation

function finalizePath() {
  const robot = getActiveRobot();
  if (robot.currentPath.length < 2) return;
  robot.paths.push({ points: robot.currentPath, type: mode });
  robot.currentPath = [];
  selectedPoint = null;
  selectedControlPoint = null;
  saveState();
  updateUI();
  drawCanvas();
}

function clearAll() {
  if (confirm('Are you sure you want to clear all paths for all robots?')) {
    robots.forEach(robot => {
      robot.paths = [];
      robot.currentPath = [];
    });
    selectedPoint = null;
    selectedControlPoint = null;
    // Also clear imported file
    uploadedFileContent = null;
    uploadedFileName = null;
    parsedPathInfo = null;
    saveState();
    updateUI();
    updateImportedFileUI();
    drawCanvas();
  }
}

function animatePath() {
  // Check if any robot has paths
  const hasAnyPaths = robots.some(robot => robot.paths.length > 0);
  if (!hasAnyPaths) return;
  
  animating = true;
  animationProgress = 0;
  
  // Calculate total duration including wait times
  let maxDuration = 0;
  robots.forEach(robot => {
    if (robot.paths.length > 0) {
      let totalWait = 0;
      robot.paths.forEach(path => {
        path.points.forEach(point => {
          totalWait += (point.waitDuration || 0);
        });
      });
      const robotDuration = 3000 + (totalWait * 1000);
      maxDuration = Math.max(maxDuration, robotDuration);
    }
  });
  
  const startTime = Date.now();
  const duration = maxDuration || 3000;
  
  function animate() {
    const elapsed = Date.now() - startTime;
    animationProgress = Math.min(elapsed / duration, 1);
    drawCanvas();
    
    if (animationProgress < 1) {
      requestAnimationFrame(animate);
    } else {
      animating = false;
      drawCanvas();
    }
  }
  
  animate();
}

function getPositionAtProgress(points, t) {
  if (points.length < 2) return null;
  
  // Calculate total movement time and wait time
  let totalWaitTime = 0;
  points.forEach(point => {
    totalWaitTime += (point.waitDuration || 0);
  });
  
  const baseDuration = 3000; // Base movement time in ms
  const totalDuration = baseDuration + (totalWaitTime * 1000);
  const currentTime = t * totalDuration;
  
  // Find which segment we're in, accounting for wait times
  let accumulatedTime = 0;
  const segmentDuration = baseDuration / (points.length - 1);
  
  for (let i = 0; i < points.length - 1; i++) {
    const segmentEnd = accumulatedTime + segmentDuration;
    const waitTime = (points[i + 1].waitDuration || 0) * 1000;
    
    // Check if we're in the movement phase of this segment
    if (currentTime <= segmentEnd) {
      const segmentT = (currentTime - accumulatedTime) / segmentDuration;
      return calculateBezierPosition(points[i], points[i + 1], segmentT);
    }
    
    accumulatedTime = segmentEnd;
    
    // Check if we're in the wait phase
    if (currentTime <= accumulatedTime + waitTime) {
      // Robot is waiting at this point
      const p = points[i + 1];
      return { x: p.x, y: p.y, heading: p.heading };
    }
    
    accumulatedTime += waitTime;
  }
  
  // If we've passed all segments, return the last point
  const lastPoint = points[points.length - 1];
  return { x: lastPoint.x, y: lastPoint.y, heading: lastPoint.heading };
}

function calculateBezierPosition(p0, p1, segmentT) {
  const cp1 = p0.controlPoint2 || { x: p0.x + (p1.x - p0.x) / 3, y: p0.y + (p1.y - p0.y) / 3 };
  const cp2 = p1.controlPoint1 || { x: p0.x + 2 * (p1.x - p0.x) / 3, y: p0.y + 2 * (p1.y - p0.y) / 3 };
  
  const x = Math.pow(1-segmentT, 3) * p0.x + 
            3 * Math.pow(1-segmentT, 2) * segmentT * cp1.x +
            3 * (1-segmentT) * Math.pow(segmentT, 2) * cp2.x +
            Math.pow(segmentT, 3) * p1.x;
  const y = Math.pow(1-segmentT, 3) * p0.y + 
            3 * Math.pow(1-segmentT, 2) * segmentT * cp1.y +
            3 * (1-segmentT) * Math.pow(segmentT, 2) * cp2.y +
            Math.pow(segmentT, 3) * p1.y;
  
  // Calculate tangent for movement direction
  const dx = 3 * Math.pow(1-segmentT, 2) * (cp1.x - p0.x) +
             6 * (1-segmentT) * segmentT * (cp2.x - cp1.x) +
             3 * Math.pow(segmentT, 2) * (p1.x - cp2.x);
  const dy = 3 * Math.pow(1-segmentT, 2) * (cp1.y - p0.y) +
             6 * (1-segmentT) * segmentT * (cp2.y - cp1.y) +
             3 * Math.pow(segmentT, 2) * (p1.y - cp2.y);
  
  const tangentHeading = Math.atan2(dy, dx) * 180 / Math.PI;
  
  // Smoothly interpolate between start and end headings
  // Use the tangent direction but blend with target heading
  let heading;
  if (segmentT < 0.3) {
    // Early in segment: blend from start heading to tangent
    const blendFactor = segmentT / 0.3;
    heading = lerpAngle(p0.heading, tangentHeading, blendFactor);
  } else if (segmentT > 0.7) {
    // Late in segment: blend from tangent to end heading
    const blendFactor = (segmentT - 0.7) / 0.3;
    heading = lerpAngle(tangentHeading, p1.heading, blendFactor);
  } else {
    // Middle of segment: use tangent direction
    heading = tangentHeading;
  }
  
  return { x, y, heading };
}

// Linear interpolation for angles (handles wraparound)
function lerpAngle(a, b, t) {
  // Normalize angles to -180 to 180
  a = ((a % 360) + 360) % 360;
  b = ((b % 360) + 360) % 360;
  
  // Find shortest path
  let diff = b - a;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  
  return a + diff * t;
}

function deleteSelectedPoint() {
  const robot = getActiveRobot();
  if (selectedPoint !== null && selectedPoint < robot.currentPath.length) {
    robot.currentPath.splice(selectedPoint, 1);
    selectedPoint = null;
    saveState();
    updateUI();
    drawCanvas();
  }
}

function updateSelectedHeading() {
  const robot = getActiveRobot();
  if (selectedPoint !== null && selectedPoint < robot.currentPath.length) {
    robot.currentPath[selectedPoint].heading = Number(document.getElementById('selectedHeading').value);
    drawCanvas();
  }
}

function updateSelectedWait() {
  const robot = getActiveRobot();
  if (selectedPoint !== null && selectedPoint < robot.currentPath.length) {
    robot.currentPath[selectedPoint].waitDuration = Number(document.getElementById('selectedWait').value);
  }
}
