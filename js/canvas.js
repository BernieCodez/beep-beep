// Canvas drawing functions

function drawCanvas() {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  
  // Draw map background if selected
  if (mapImage) {
    ctx.drawImage(mapImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }

  // Draw field grid
  const gridColor = currentTheme === 'light' ? '#ccc' : '#333';
  ctx.strokeStyle = mapImage ? 'rgba(200, 200, 200, 0.3)' : gridColor;
  ctx.lineWidth = 1;
  for (let i = 0; i <= FIELD_SIZE; i += 12) {
    ctx.beginPath();
    ctx.moveTo(i * SCALE, 0);
    ctx.lineTo(i * SCALE, CANVAS_SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * SCALE);
    ctx.lineTo(CANVAS_SIZE, i * SCALE);
    ctx.stroke();
  }

  // Draw field border
  ctx.strokeStyle = currentTheme === 'light' ? '#000' : '#666';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Draw coordinate labels
  ctx.fillStyle = currentTheme === 'light' ? '#333' : '#999';
  ctx.font = '10px monospace';
  for (let i = -72; i <= 72; i += 24) {
    ctx.fillText(i, (i + 72) * SCALE + 2, 12);
    ctx.fillText(i, 2, (72 - i) * SCALE - 2);
  }

  // Draw both robots' paths
  robots.forEach((robot, robotIdx) => {
    const isActive = robotIdx === activeRobotId;
    const pathColor = robot.color;
    const currentPathColor = robot.color;
    
    // Draw completed paths
    robot.paths.forEach((path, pathIndex) => {
      const showFull = robotIdx !== activeRobotId || pathIndex < robot.paths.length - 1 || !animating;
      drawPath(path.points, path.type, pathColor, showFull, 0.6);
    });

    // Draw current path for active robot
    if (isActive && robot.currentPath.length > 0) {
      drawPath(robot.currentPath, mode, currentPathColor, true, 1);
    }
  });

  // Draw control points for active robot only
  const robot = getActiveRobot();
  if (showControlPoints) {
    [...robot.paths.flatMap(p => p.points), ...robot.currentPath].forEach((point, idx) => {
      if (point.controlPoint1) {
        drawControlPoint(point, point.controlPoint1, 'cp1', idx);
      }
      if (point.controlPoint2) {
        drawControlPoint(point, point.controlPoint2, 'cp2', idx);
      }
    });
  }

  // Draw waypoints for active robot only
  [...robot.paths.flatMap(p => p.points), ...robot.currentPath].forEach((point, idx) => {
    drawWaypoint(point, idx);
  });

  // Draw both robots
  robots.forEach((robot, robotIdx) => {
    const isActive = robotIdx === activeRobotId;
    const shouldAnimate = animating && robot.paths.length > 0;
    
    if (shouldAnimate) {
      // Draw animated position with proper heading
      const animPos = getPositionAtProgress(robot.paths[robot.paths.length - 1].points, animationProgress);
      if (animPos) {
        drawRobot(animPos, robot.color, isActive, robot.size, true);
        // Draw robot name label
        drawRobotLabel(animPos, robot.name, robot.color);
      }
    } else {
      // Draw robot at starting position
      drawRobot(robot.pos, robot.color, isActive, robot.size, false);
      // Draw robot name label
      drawRobotLabel(robot.pos, robot.name, robot.color);
    }
  });
}

function drawPath(points, type, color, showFull, opacity = 1) {
  if (points.length < 2) return;

  // Apply opacity to color
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
  ctx.lineWidth = 2;
  ctx.beginPath();

  if (type === 'spline' && points.length >= 2) {
    ctx.moveTo((points[0].x + 72) * SCALE, (72 - points[0].y) * SCALE);
    
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cp1 = p0.controlPoint2 || { x: p0.x + (p1.x - p0.x) / 3, y: p0.y + (p1.y - p0.y) / 3 };
      const cp2 = p1.controlPoint1 || { x: p0.x + 2 * (p1.x - p0.x) / 3, y: p0.y + 2 * (p1.y - p0.y) / 3 };
      
      ctx.bezierCurveTo(
        (cp1.x + 72) * SCALE, (72 - cp1.y) * SCALE,
        (cp2.x + 72) * SCALE, (72 - cp2.y) * SCALE,
        (p1.x + 72) * SCALE, (72 - p1.y) * SCALE
      );
    }
  } else {
    ctx.moveTo((points[0].x + 72) * SCALE, (72 - points[0].y) * SCALE);
    points.forEach(p => {
      ctx.lineTo((p.x + 72) * SCALE, (72 - p.y) * SCALE);
    });
  }

  ctx.stroke();

  if (showFull) {
    points.forEach((point, idx) => {
      if (idx < points.length - 1) {
        const next = points[idx + 1];
        const angle = Math.atan2(next.y - point.y, next.x - point.x);
        drawArrow(
          ((point.x + next.x) / 2 + 72) * SCALE, 
          (72 - (point.y + next.y) / 2) * SCALE, 
          angle, color
        );
      }
    });
  }
}

function drawWaypoint(point, idx) {
  const isSelected = selectedPoint === idx;
  ctx.fillStyle = isSelected ? '#FF9800' : '#2196F3';
  ctx.beginPath();
  ctx.arc((point.x + 72) * SCALE, (72 - point.y) * SCALE, isSelected ? 8 : 6, 0, 2 * Math.PI);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (point.heading !== undefined) {
    const headingRad = point.heading * Math.PI / 180;
    ctx.strokeStyle = isSelected ? '#FF9800' : '#2196F3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo((point.x + 72) * SCALE, (72 - point.y) * SCALE);
    ctx.lineTo(
      (point.x + Math.cos(headingRad) * 8 + 72) * SCALE,
      (72 - (point.y + Math.sin(headingRad) * 8)) * SCALE
    );
    ctx.stroke();
  }
}

function drawControlPoint(point, controlPoint, type, idx) {
  const isSelected = selectedControlPoint?.idx === idx && selectedControlPoint?.type === type;
  
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo((point.x + 72) * SCALE, (72 - point.y) * SCALE);
  ctx.lineTo((controlPoint.x + 72) * SCALE, (72 - controlPoint.y) * SCALE);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = isSelected ? '#FF5722' : '#FFC107';
  ctx.beginPath();
  ctx.arc((controlPoint.x + 72) * SCALE, (72 - controlPoint.y) * SCALE, isSelected ? 6 : 4, 0, 2 * Math.PI);
  ctx.fill();
}

function drawRobot(pos, color, isDraggable = false, size = 18, isAnimating = false) {
  const x = (pos.x + 72) * SCALE;
  const y = (72 - pos.y) * SCALE;
  const heading = pos.heading * Math.PI / 180;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-heading);

  // Parse color for alpha
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.5)`;
  ctx.fillRect(-size * SCALE / 2, -size * SCALE / 2, size * SCALE, size * SCALE);
  ctx.strokeStyle = color;
  ctx.lineWidth = (isDraggable && draggingRobot) || isAnimating ? 3 : 2;
  ctx.strokeRect(-size * SCALE / 2, -size * SCALE / 2, size * SCALE, size * SCALE);

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(size * SCALE / 2, 0);
  ctx.lineTo(size * SCALE / 2 - 8, -6);
  ctx.lineTo(size * SCALE / 2 - 8, 6);
  ctx.fill();

  ctx.restore();
}

function drawRobotLabel(pos, name, color) {
  const x = (pos.x + 72) * SCALE;
  const y = (72 - pos.y) * SCALE;
  
  ctx.save();
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  
  // Draw background
  const textWidth = ctx.measureText(name).width;
  const padding = 4;
  const bgHeight = 16;
  
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
  ctx.fillRect(x - textWidth / 2 - padding, y - 50 - bgHeight, textWidth + padding * 2, bgHeight);
  
  // Draw text
  ctx.fillStyle = '#fff';
  ctx.fillText(name, x, y - 50);
  
  ctx.restore();
}

function drawArrow(x, y, angle, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(0, -4);
  ctx.lineTo(0, 4);
  ctx.fill();
  ctx.restore();
}
