// Robot management functions

function getActiveRobot() { 
  return robots[activeRobotId]; 
}

function getOtherRobot() { 
  return robots[1 - activeRobotId]; 
}

function switchRobot(robotId) {
  activeRobotId = robotId;
  const robot = getActiveRobot();
  
  document.getElementById('robotX').value = robot.pos.x;
  document.getElementById('robotY').value = robot.pos.y;
  document.getElementById('robotHeading').value = robot.pos.heading;
  document.getElementById('robotSize').value = robot.size;
  document.getElementById('robotName').value = robot.name;
  document.getElementById('robotColor').value = robot.color;
  
  selectedPoint = null;
  selectedControlPoint = null;
  
  updateRobotButtons();
  updateUI();
  drawCanvas();
}

function updateRobotButtons() {
  document.querySelectorAll('.btn-robot').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.robot) === activeRobotId);
  });
}

function updateRobotPos() {
  const robot = getActiveRobot();
  robot.pos.x = Number(document.getElementById('robotX').value);
  robot.pos.y = Number(document.getElementById('robotY').value);
  robot.pos.heading = Number(document.getElementById('robotHeading').value);
  saveState();
  drawCanvas();
}

function updateRobotSize() {
  const newSize = Number(document.getElementById('robotSize').value);
  const robot = getActiveRobot();
  robot.size = Math.max(1, Math.min(18, newSize));
  document.getElementById('robotSize').value = robot.size;
  saveState();
  drawCanvas();
}

function updateRobotName() {
  const robot = getActiveRobot();
  robot.name = document.getElementById('robotName').value || `Robot ${robot.id + 1}`;
  saveState();
  updateUI();
}

function updateRobotColor() {
  const robot = getActiveRobot();
  robot.color = document.getElementById('robotColor').value;
  saveState();
  drawCanvas();
}
