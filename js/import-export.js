// File import/export functions

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  uploadedFileName = file.name;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    uploadedFileContent = e.target.result;
    parseRoadrunnerCode(uploadedFileContent);
  };
  reader.readAsText(file);
  
  // Reset file input so same file can be uploaded again
  event.target.value = '';
}

function openPasteModal() {
  document.getElementById('pasteModal').classList.add('show');
  document.getElementById('pasteTextarea').focus();
}

function closePasteModal() {
  document.getElementById('pasteModal').classList.remove('show');
  document.getElementById('pasteTextarea').value = '';
}

function handlePastedCode() {
  const pastedCode = document.getElementById('pasteTextarea').value.trim();
  
  if (!pastedCode) {
    alert('Please paste some code first!');
    return;
  }
  
  // Set filename to indicate pasted content
  uploadedFileName = 'PastedCode.java';
  uploadedFileContent = pastedCode;
  
  // Parse the pasted code
  parseRoadrunnerCode(pastedCode);
  
  // Close modal
  closePasteModal();
}

function parseRoadrunnerCode(code) {
  const robot = getActiveRobot();
  
  // Clear current paths
  robot.paths = [];
  robot.currentPath = [];
  parsedPathInfo = {
    originalCode: code,
    pathMatches: [],
    variables: {}
  };
  
  // Parse variable declarations (like firing_position_x = 15)
  const varRegex = /(?:double|int|float)\s+(\w+)\s*=\s*([+-]?\d*\.?\d+)/g;
  let varMatch;
  while ((varMatch = varRegex.exec(code)) !== null) {
    parsedPathInfo.variables[varMatch[1]] = parseFloat(varMatch[2]);
  }
  
  // Parse beginPose / starting pose
  const poseRegex = /(?:new\s+)?Pose2d\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/g;
  const poseMatches = [...code.matchAll(poseRegex)];
  
  if (poseMatches.length > 0) {
    const firstPose = poseMatches[0];
    const startX = resolveValue(firstPose[1], parsedPathInfo.variables);
    const startY = resolveValue(firstPose[2], parsedPathInfo.variables);
    const startHeading = resolveAngle(firstPose[3], parsedPathInfo.variables);
    
    robot.pos.x = startX;
    robot.pos.y = startY;
    robot.pos.heading = startHeading;
    
    // Update UI
    document.getElementById('robotX').value = robot.pos.x;
    document.getElementById('robotY').value = robot.pos.y;
    document.getElementById('robotHeading').value = robot.pos.heading;
  }
  
  // Parse the action builder chain
  const pathPoints = [];
  let currentReversed = false;
  
  // Start with robot position
  pathPoints.push({
    x: Math.round(robot.pos.x),
    y: Math.round(robot.pos.y),
    heading: robot.pos.heading,
    waitDuration: 0,
    type: 'start'
  });
  
  // Find all path commands in the action builder chain
  // splineTo patterns
  const splineToRegex = /\.splineTo\s*\(\s*new\s+Vector2d\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)\s*,\s*([^)]+)\s*\)/g;
  let splineMatch;
  while ((splineMatch = splineToRegex.exec(code)) !== null) {
    const x = resolveValue(splineMatch[1], parsedPathInfo.variables);
    const y = resolveValue(splineMatch[2], parsedPathInfo.variables);
    const heading = resolveAngle(splineMatch[3], parsedPathInfo.variables);
    
    pathPoints.push({
      x: Math.round(x),
      y: Math.round(y),
      heading: heading,
      waitDuration: 0,
      type: 'splineTo',
      matchIndex: splineMatch.index,
      matchLength: splineMatch[0].length,
      originalMatch: splineMatch[0]
    });
    
    parsedPathInfo.pathMatches.push({
      type: 'splineTo',
      index: splineMatch.index,
      length: splineMatch[0].length,
      original: splineMatch[0],
      x: x,
      y: y,
      heading: heading
    });
  }
  
  // strafeTo patterns
  const strafeToRegex = /\.strafeTo\s*\(\s*new\s+Vector2d\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)\s*\)/g;
  let strafeMatch;
  while ((strafeMatch = strafeToRegex.exec(code)) !== null) {
    const x = resolveValue(strafeMatch[1], parsedPathInfo.variables);
    const y = resolveValue(strafeMatch[2], parsedPathInfo.variables);
    const lastHeading = pathPoints.length > 0 ? pathPoints[pathPoints.length - 1].heading : robot.pos.heading;
    
    pathPoints.push({
      x: Math.round(x),
      y: Math.round(y),
      heading: lastHeading,
      waitDuration: 0,
      type: 'strafeTo',
      matchIndex: strafeMatch.index,
      matchLength: strafeMatch[0].length,
      originalMatch: strafeMatch[0]
    });
    
    parsedPathInfo.pathMatches.push({
      type: 'strafeTo',
      index: strafeMatch.index,
      length: strafeMatch[0].length,
      original: strafeMatch[0],
      x: x,
      y: y
    });
  }
  
  // lineTo patterns
  const lineToRegex = /\.lineTo\s*\(\s*new\s+Vector2d\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)\s*\)/g;
  let lineMatch;
  while ((lineMatch = lineToRegex.exec(code)) !== null) {
    const x = resolveValue(lineMatch[1], parsedPathInfo.variables);
    const y = resolveValue(lineMatch[2], parsedPathInfo.variables);
    const lastHeading = pathPoints.length > 0 ? pathPoints[pathPoints.length - 1].heading : robot.pos.heading;
    
    pathPoints.push({
      x: Math.round(x),
      y: Math.round(y),
      heading: lastHeading,
      waitDuration: 0,
      type: 'lineTo',
      matchIndex: lineMatch.index,
      matchLength: lineMatch[0].length,
      originalMatch: lineMatch[0]
    });
    
    parsedPathInfo.pathMatches.push({
      type: 'lineTo',
      index: lineMatch.index,
      length: lineMatch[0].length,
      original: lineMatch[0],
      x: x,
      y: y
    });
  }
  
  // lineToX patterns
  const lineToXRegex = /\.lineToX\s*\(\s*([^)]+)\s*\)/g;
  let lineToXMatch;
  while ((lineToXMatch = lineToXRegex.exec(code)) !== null) {
    const x = resolveValue(lineToXMatch[1], parsedPathInfo.variables);
    const lastPoint = pathPoints[pathPoints.length - 1];
    const y = lastPoint ? lastPoint.y : robot.pos.y;
    const lastHeading = lastPoint ? lastPoint.heading : robot.pos.heading;
    
    pathPoints.push({
      x: Math.round(x),
      y: y,
      heading: lastHeading,
      waitDuration: 0,
      type: 'lineToX',
      matchIndex: lineToXMatch.index,
      matchLength: lineToXMatch[0].length,
      originalMatch: lineToXMatch[0]
    });
    
    parsedPathInfo.pathMatches.push({
      type: 'lineToX',
      index: lineToXMatch.index,
      length: lineToXMatch[0].length,
      original: lineToXMatch[0],
      x: x
    });
  }
  
  // lineToY patterns
  const lineToYRegex = /\.lineToY\s*\(\s*([^)]+)\s*\)/g;
  let lineToYMatch;
  while ((lineToYMatch = lineToYRegex.exec(code)) !== null) {
    const y = resolveValue(lineToYMatch[1], parsedPathInfo.variables);
    const lastPoint = pathPoints[pathPoints.length - 1];
    const x = lastPoint ? lastPoint.x : robot.pos.x;
    const lastHeading = lastPoint ? lastPoint.heading : robot.pos.heading;
    
    pathPoints.push({
      x: x,
      y: Math.round(y),
      heading: lastHeading,
      waitDuration: 0,
      type: 'lineToY',
      matchIndex: lineToYMatch.index,
      matchLength: lineToYMatch[0].length,
      originalMatch: lineToYMatch[0]
    });
    
    parsedPathInfo.pathMatches.push({
      type: 'lineToY',
      index: lineToYMatch.index,
      length: lineToYMatch[0].length,
      original: lineToYMatch[0],
      y: y
    });
  }
  
  // splineToLinearHeading patterns
  const splineToLinearRegex = /\.splineToLinearHeading\s*\(\s*new\s+Pose2d\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)\s*,\s*([^)]+)\s*\)/g;
  let splineLinearMatch;
  while ((splineLinearMatch = splineToLinearRegex.exec(code)) !== null) {
    const x = resolveValue(splineLinearMatch[1], parsedPathInfo.variables);
    const y = resolveValue(splineLinearMatch[2], parsedPathInfo.variables);
    const heading = resolveAngle(splineLinearMatch[3], parsedPathInfo.variables);
    
    pathPoints.push({
      x: Math.round(x),
      y: Math.round(y),
      heading: heading,
      waitDuration: 0,
      type: 'splineToLinearHeading',
      matchIndex: splineLinearMatch.index,
      matchLength: splineLinearMatch[0].length,
      originalMatch: splineLinearMatch[0]
    });
    
    parsedPathInfo.pathMatches.push({
      type: 'splineToLinearHeading',
      index: splineLinearMatch.index,
      length: splineLinearMatch[0].length,
      original: splineLinearMatch[0],
      x: x,
      y: y,
      heading: heading
    });
  }
  
  // Parse waitSeconds
  const waitRegex = /\.waitSeconds\s*\(\s*([^)]+)\s*\)/g;
  let waitMatch;
  while ((waitMatch = waitRegex.exec(code)) !== null) {
    const waitTime = resolveValue(waitMatch[1], parsedPathInfo.variables);
    // Find the closest point before this wait
    if (pathPoints.length > 0) {
      // Find which point this wait belongs to based on position in code
      let bestPointIdx = pathPoints.length - 1;
      for (let i = pathPoints.length - 1; i >= 0; i--) {
        if (pathPoints[i].matchIndex && pathPoints[i].matchIndex < waitMatch.index) {
          bestPointIdx = i;
          break;
        }
      }
      pathPoints[bestPointIdx].waitDuration = waitTime;
    }
  }
  
  // Sort path points by their position in the original code
  pathPoints.sort((a, b) => {
    const indexA = a.matchIndex || 0;
    const indexB = b.matchIndex || 0;
    return indexA - indexB;
  });
  
  // Sort parsedPathInfo.pathMatches by index
  parsedPathInfo.pathMatches.sort((a, b) => a.index - b.index);
  
  // Add control points for spline paths
  for (let i = 0; i < pathPoints.length - 1; i++) {
    const p0 = pathPoints[i];
    const p1 = pathPoints[i + 1];
    
    if (p1.type === 'splineTo' || p1.type === 'splineToLinearHeading') {
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      p0.controlPoint2 = { x: p0.x + dx / 3, y: p0.y + dy / 3 };
      p1.controlPoint1 = { x: p0.x + 2 * dx / 3, y: p0.y + 2 * dy / 3 };
    }
  }
  
  // Create path from parsed points
  if (pathPoints.length >= 2) {
    // Determine path type based on commands
    const hasSplines = pathPoints.some(p => p.type === 'splineTo' || p.type === 'splineToLinearHeading');
    robot.paths.push({
      points: pathPoints,
      type: hasSplines ? 'spline' : 'linear'
    });
  }
  
  saveState();
  updateUI();
  updateImportedFileUI();
  drawCanvas();
  
  alert(`Successfully imported "${uploadedFileName}"!\n\nFound ${pathPoints.length} waypoints.\n\nYou can now:\n- Drag points to adjust positions\n- Click "Animate" to preview\n- Click "Export Code" to save with updated positions`);
}

// Helper to resolve variable references or Math expressions
function resolveValue(expr, variables) {
  if (!expr) return 0;
  expr = expr.trim();
  
  // Check if it's a variable reference
  if (variables[expr] !== undefined) {
    return variables[expr];
  }
  
  // Check for simple number
  const num = parseFloat(expr);
  if (!isNaN(num)) {
    return num;
  }
  
  // Try to evaluate simple expressions
  try {
    // Replace variable names with their values
    let evalExpr = expr;
    for (const [varName, varValue] of Object.entries(variables)) {
      evalExpr = evalExpr.replace(new RegExp('\\b' + varName + '\\b', 'g'), varValue);
    }
    // Safe evaluation of simple math
    const result = Function('"use strict"; return (' + evalExpr + ')')();
    if (!isNaN(result)) {
      return result;
    }
  } catch (e) {
    // Ignore evaluation errors
  }
  
  return 0;
}

// Helper to resolve angle expressions (Math.toRadians, Math.PI, etc.)
function resolveAngle(expr, variables) {
  if (!expr) return 0;
  expr = expr.trim();
  
  // Math.toRadians(degrees)
  const toRadiansMatch = expr.match(/Math\.toRadians\s*\(\s*([^)]+)\s*\)/);
  if (toRadiansMatch) {
    const degrees = resolveValue(toRadiansMatch[1], variables);
    return degrees;
  }
  
  // Math.PI expressions
  if (expr.includes('Math.PI')) {
    let evalExpr = expr.replace(/Math\.PI/g, Math.PI.toString());
    // Replace variable names
    for (const [varName, varValue] of Object.entries(variables)) {
      evalExpr = evalExpr.replace(new RegExp('\\b' + varName + '\\b', 'g'), varValue);
    }
    try {
      const radians = Function('"use strict"; return (' + evalExpr + ')')();
      return radians * 180 / Math.PI; // Convert to degrees
    } catch (e) {
      // Ignore
    }
  }
  
  // Plain number (radians)
  const num = parseFloat(expr);
  if (!isNaN(num)) {
    return num * 180 / Math.PI; // Convert to degrees
  }
  
  return 0;
}

function clearImportedFile() {
  uploadedFileContent = null;
  uploadedFileName = null;
  parsedPathInfo = null;
  updateImportedFileUI();
}

function updateImportedFileUI() {
  const fileInfo = document.getElementById('importedFileInfo');
  const clearBtn = document.getElementById('clearImportBtn');
  
  if (uploadedFileName) {
    fileInfo.innerHTML = `<strong style="color: #10b981;">📄 ${uploadedFileName}</strong>`;
    clearBtn.style.display = 'block';
  } else {
    fileInfo.textContent = 'No file imported';
    clearBtn.style.display = 'none';
  }
}

function exportCode() {
  const robot = getActiveRobot();
  
  if (robot.paths.length === 0) {
    alert('No paths to export for the active robot!');
    return;
  }
  
  // If we have uploaded file content, export with updated values
  if (uploadedFileContent && parsedPathInfo) {
    exportUpdatedFile();
    return;
  }
  
  // Otherwise, generate new code
  let code = '// Roadrunner Path Code\n';
  code += '// Generated by FTC Roadrunner Visual Path Planner\n\n';
  
  code += `// ======== ${robot.name} ========\n`;
  code += `// Starting Position: (${robot.pos.x}, ${robot.pos.y})\n`;
  code += `// Starting Heading: ${robot.pos.heading}°\n`;
  code += `// Robot Size: ${robot.size} inches\n`;
  code += `// Color: ${robot.color}\n\n`;
  
  code += `Pose2d startPose = new Pose2d(${robot.pos.x}, ${robot.pos.y}, Math.toRadians(${robot.pos.heading}));\n`;
  code += `drive.setPoseEstimate(startPose);\n\n`;
  
  robot.paths.forEach((path, idx) => {
    code += `// Path ${idx + 1} (${path.type})\n`;
    code += `TrajectorySequence trajectory${idx + 1} = drive.trajectorySequenceBuilder(${idx === 0 ? 'startPose' : `trajectory${idx}.end()`})\n`;
    
    path.points.forEach((point, pidx) => {
      if (pidx === 0 && idx === 0) return;
      
      if (path.type === 'spline') {
        code += `        .splineTo(new Vector2d(${point.x}, ${point.y}), Math.toRadians(${point.heading}))`;
      } else {
        code += `        .lineTo(new Vector2d(${point.x}, ${point.y}))`;
      }
      code += '\n';
      
      // Add wait if specified
      if (point.waitDuration && point.waitDuration > 0) {
        code += `        .waitSeconds(${point.waitDuration})\n`;
      }
    });
    code += '        .build();\n\n';
  });
  
  code += `// Execute ${robot.name} trajectories\n`;
  robot.paths.forEach((path, idx) => {
    code += `drive.followTrajectorySequence(trajectory${idx + 1});\n`;
  });
  
  const blob = new Blob([code], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `roadrunner_path_${robot.name.replace(/\s+/g, '_')}.java`;
  a.click();
}

function exportUpdatedFile() {
  const robot = getActiveRobot();
  let modifiedCode = uploadedFileContent;
  
  // Get the current path points (flattened from all paths)
  const currentPoints = robot.paths.flatMap(p => p.points);
  
  // We need to track how much the string has shifted due to replacements
  let offset = 0;
  
  // Update the starting pose first
  const poseRegex = /(?:new\s+)?Pose2d\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/;
  const poseMatch = modifiedCode.match(poseRegex);
  if (poseMatch) {
    const oldPose = poseMatch[0];
    const newPose = `new Pose2d(${robot.pos.x}, ${robot.pos.y}, Math.toRadians(${robot.pos.heading}))`;
    modifiedCode = modifiedCode.replace(oldPose, newPose);
  }
  
  // Now update each path command with new values
  // We'll rebuild the code by replacing each path command
  
  // Collect all path commands and their replacements
  const replacements = [];
  
  // Track which point we're on (skip the first one as it's the starting position)
  let pointIndex = 1;
  
  // Find all path commands in order
  const allCommands = [];
  
  // splineTo
  const splineToRegex = /\.splineTo\s*\(\s*new\s+Vector2d\s*\(\s*[^,]+\s*,\s*[^)]+\s*\)\s*,\s*[^)]+\s*\)/g;
  let match;
  while ((match = splineToRegex.exec(uploadedFileContent)) !== null) {
    allCommands.push({ type: 'splineTo', index: match.index, original: match[0] });
  }
  
  // strafeTo
  const strafeToRegex = /\.strafeTo\s*\(\s*new\s+Vector2d\s*\(\s*[^,]+\s*,\s*[^)]+\s*\)\s*\)/g;
  while ((match = strafeToRegex.exec(uploadedFileContent)) !== null) {
    allCommands.push({ type: 'strafeTo', index: match.index, original: match[0] });
  }
  
  // lineTo
  const lineToRegex = /\.lineTo\s*\(\s*new\s+Vector2d\s*\(\s*[^,]+\s*,\s*[^)]+\s*\)\s*\)/g;
  while ((match = lineToRegex.exec(uploadedFileContent)) !== null) {
    allCommands.push({ type: 'lineTo', index: match.index, original: match[0] });
  }
  
  // lineToX
  const lineToXRegex = /\.lineToX\s*\(\s*[^)]+\s*\)/g;
  while ((match = lineToXRegex.exec(uploadedFileContent)) !== null) {
    allCommands.push({ type: 'lineToX', index: match.index, original: match[0] });
  }
  
  // lineToY
  const lineToYRegex = /\.lineToY\s*\(\s*[^)]+\s*\)/g;
  while ((match = lineToYRegex.exec(uploadedFileContent)) !== null) {
    allCommands.push({ type: 'lineToY', index: match.index, original: match[0] });
  }
  
  // splineToLinearHeading
  const splineToLinearRegex = /\.splineToLinearHeading\s*\(\s*new\s+Pose2d\s*\(\s*[^,]+\s*,\s*[^,]+\s*,\s*[^)]+\s*\)\s*,\s*[^)]+\s*\)/g;
  while ((match = splineToLinearRegex.exec(uploadedFileContent)) !== null) {
    allCommands.push({ type: 'splineToLinearHeading', index: match.index, original: match[0] });
  }
  
  // Sort commands by their position in the file
  allCommands.sort((a, b) => a.index - b.index);
  
  // Create replacements for each command
  allCommands.forEach((cmd, idx) => {
    if (pointIndex < currentPoints.length) {
      const point = currentPoints[pointIndex];
      let newCommand;
      
      switch (cmd.type) {
        case 'splineTo':
          newCommand = `.splineTo(new Vector2d(${point.x}, ${point.y}), Math.toRadians(${Math.round(point.heading)}))`;
          break;
        case 'strafeTo':
          newCommand = `.strafeTo(new Vector2d(${point.x}, ${point.y}))`;
          break;
        case 'lineTo':
          newCommand = `.lineTo(new Vector2d(${point.x}, ${point.y}))`;
          break;
        case 'lineToX':
          newCommand = `.lineToX(${point.x})`;
          break;
        case 'lineToY':
          newCommand = `.lineToY(${point.y})`;
          break;
        case 'splineToLinearHeading':
          newCommand = `.splineToLinearHeading(new Pose2d(${point.x}, ${point.y}, Math.toRadians(${Math.round(point.heading)})), Math.toRadians(${Math.round(point.heading)}))`;
          break;
      }
      
      if (newCommand) {
        replacements.push({
          original: cmd.original,
          replacement: newCommand
        });
      }
      pointIndex++;
    }
  });
  
  // Apply replacements
  replacements.forEach(r => {
    modifiedCode = modifiedCode.replace(r.original, r.replacement);
  });
  
  // Download the modified file
  const blob = new Blob([modifiedCode], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = uploadedFileName || 'updated_path.java';
  a.click();
  
  alert(`Exported "${uploadedFileName}" with updated path positions!`);
}
