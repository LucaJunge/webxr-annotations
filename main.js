import "./style.css";
import * as THREE from "three";
import { ArcballControls } from "three/examples/jsm/controls/ArcballControls";
import { radToDeg } from "three/src/math/MathUtils";

let container;
let camera, scene, renderer, canvas;
let controls, controller;
let box;
let debugLog;

let reticle;
let hitTestSource = null;
let hitTestSourceRequested = false;
let arrow = null;
let annotations = [];
let movables = new THREE.Group();
let positions = [
  {
    x: 0.25,
    y: 0.25,
    z: 0.25,
  },
  {
    x: -0.25,
    y: 0.25,
    z: 0.25,
  },
  {
    x: 0.25,
    y: -0.25,
    z: 0.25,
  },
  {
    x: -0.25,
    y: -0.25,
    z: 0.25,
  },
  {
    x: 0.25,
    y: 0.25,
    z: -0.25,
  },
  {
    x: -0.25,
    y: 0.25,
    z: -0.25,
  },
  {
    x: 0.25,
    y: -0.25,
    z: -0.25,
  },
  {
    x: -0.25,
    y: -0.25,
    z: -0.25,
  },
];
let currentSession = null;
let cameraVector = new THREE.Vector3();
let annotationPositionVector = new THREE.Vector3();
let arOffset = 0.05;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(-1, -1);

let sessionInit = {
  optionalFeatures: ["dom-overlay"],
  requiredFeatures: ["hit-test"],
  domOverlay: {
    root: document.querySelector("#annotations"),
  },
};

init();
animate();
setupAR();

function init() {
  container = document.querySelector("#app");

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.01,
    10000
  );
  camera.position.set(0, 0, 3);

  const light = new THREE.AmbientLight(0xffffff, 1);
  scene.add(light);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  controls = new ArcballControls(camera, renderer.domElement, scene);
  container.appendChild(renderer.domElement);
  canvas = renderer.domElement;

  const geometry = new THREE.BoxBufferGeometry(0.5, 0.5, 0.5);
  const material = new THREE.MeshNormalMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8,
  });
  box = new THREE.Mesh(geometry, material);
  box.name = "box";
  movables.add(box);

  let axesHelper = new THREE.AxesHelper(3);
  axesHelper.name = "axesHelper";
  movables.add(axesHelper);

  controller = renderer.xr.getController(0);
  controller.addEventListener("select", onSelect);
  scene.add(controller);

  arrow = new THREE.ArrowHelper(
    raycaster.ray.direction,
    raycaster.ray.origin,
    100,
    Math.random() * 0xffffff
  );
  scene.add(arrow);

  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial()
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  window.addEventListener("resize", onWindowResize);
  window.addEventListener("mousemove", onMouseMove, false);

  //debug scale
  debugLog = document.createElement("div");
  debugLog.style.position = "absolute";
  debugLog.style.top = "5px";
  debugLog.style.left = "5px";
  debugLog.innerHTML = "DEBUG";
  debugLog.style.fontFamily = "monospace";
  debugLog.style.fontSize = "2em";
  debugLog.style.fontWeight = "bold";
  document.querySelector("#annotations").appendChild(debugLog);

  //let annotation = createAnnotation({ x: 0.25, y: 0.25, z: 0.25 });
  //annotations.push(annotation);
  for (let i = 0; i < positions.length; i++) {
    let annotation = createAnnotation({
      x: positions[i]["x"],
      y: positions[i]["y"],
      z: positions[i]["z"],
    });
    annotation.name = "annotation" + i;
    annotations.push(annotation);
  }

  /*let testAnnotation = createAnnotation({
    x: 0.25,
    y: 0.25 + 0.05,
    z: 0.25,
  });
  testAnnotation.name = "testannotation";
  annotations.push(testAnnotation);*/

  scene.add(movables);
  //console.log(movables);
}

function onSelect() {
  if (reticle.visible) {
    movables.visible = true;
    movables.position.setFromMatrixPosition(reticle.matrix);
  }
}

function randomNumber(min, max) {
  return min + Math.random() * (max - min);
}

function onMouseMove(event) {
  // calculate mouse position in normalized device coordinates
  // (-1 to +1) for both components

  // my approach
  //mouse.x = (event.offsetX / canvas.clientWidth) * 2 - 1;
  //mouse.y = -(event.offsetY / canvas.clientHeight) * 2 + 1;

  // https://stackoverflow.com/questions/13542175/three-js-ray-intersect-fails-by-adding-div/13544277#13544277
  var rect = renderer.domElement.getBoundingClientRect();
  console.log(rect);
  mouse.x = ((event.offsetX - rect.left) / (rect.width - rect.left)) * 2 - 1;
  mouse.y = -((event.offsetY - rect.top) / (rect.bottom - rect.top)) * 2 + 1;
}

function createAnnotation(position) {
  // DOM Element to click on
  let DOMannotation = document.createElement("div");
  DOMannotation.classList.add("annotation");
  DOMannotation.style.width = "24px";
  DOMannotation.style.height = "24px";
  DOMannotation.style.borderRadius = "50%";
  DOMannotation.style.boxSizing = "border-box";
  DOMannotation.style.border = "2px solid #ddd";
  DOMannotation.style.opacity = 1.0;
  DOMannotation.style.position = "absolute";

  document.querySelector("#annotations").appendChild(DOMannotation);

  //let annotation3D = new THREE.Object3D();
  let annotation3D = createSphere(position);
  annotation3D.domElement = DOMannotation;

  annotation3D.updatePosition = function () {
    annotation3D.updateWorldMatrix(true, false);
    annotation3D.getWorldPosition(annotationPositionVector);
    annotationPositionVector.project(camera);

    let x =
      (0.5 + annotationPositionVector.x / 2) *
      (canvas.width / Math.min(window.devicePixelRatio, 2));

    let y =
      (0.5 - annotationPositionVector.y / 2) *
      (canvas.height / Math.min(window.devicePixelRatio, 2)); // the formula Math.min(devicePixelratio, 2) makes problems on mobile devices

    // move the annotation on the screen with top/left
    //DOMannotation.style.top = `${vector.y - 24}px`;
    //DOMannotation.style.left = `${vector.x - 12}px`;

    // move the annotation on the screen with transform
    DOMannotation.style.transform = `translate(${x - 12}px, ${y - 12}px)`; // + 56 for chrome address bar? somehow sometimes  + 91
  };

  movables.add(annotation3D);
  return annotation3D;
}

function createSphere(position = { x: 0, y: 0, z: 0 }, color = 0xbb0000) {
  let geometry = new THREE.SphereBufferGeometry(0.08, 16, 16);
  let material = new THREE.MeshBasicMaterial({
    color: color,
  });
  let sphere = new THREE.Mesh(geometry, material);
  sphere.position.set(position.x, position.y, position.z);
  return sphere;
}

function setupAR() {
  let annotations = document.querySelectorAll(".annotation");
  for (let annotation of annotations) {
    annotation.addEventListener("click", () => {
      if (currentSession === null) {
        navigator.xr
          .requestSession("immersive-ar", sessionInit)
          .then(onSessionStarted);
      } else {
        currentSession.end();
      }
    });
  }

  if ("xr" in navigator) {
    navigator.xr.isSessionSupported("immersive-ar").then(function (supported) {
      supported ? console.log("AR supported") : alert("AR not supported");
    });
  }
}

async function onSessionStarted(session) {
  session.addEventListener("end", onSessionEnded);
  renderer.xr.setReferenceSpaceType("local");

  // hide objects to place at start (so they are not in the camera)
  movables.visible = false;
  reticle.visible = false;
  await renderer.xr.setSession(session);
  currentSession = session;
}

function onSessionEnded() {
  currentSession.removeEventListener("end", onSessionEnded);
  currentSession = null;
  camera.position.set(0, 0, -3);
  movables.position.set(0, 0, 0);
}

function onWindowResize() {
  console.log("onWindowResize");
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
  arrow.setDirection(raycaster.ray.direction);

  raycaster.setFromCamera(mouse, camera);
  let intersects = raycaster.intersectObjects(annotations, false);

  if (intersects.length > 0) {
    intersects[0].object.material.color.set(0x0000ff);
  }

  renderer.render(scene, camera);

  let xrCamera = renderer.xr.getCamera(camera); // xrCamera is an array of subCameras, the xr camera is a different one than the perspective camera of the scene

  //console.log(camera.fov, xrCamera.fov);

  /*debugLog.innerText =
    radToDeg(camera.rotation.z).toFixed(4) +
    "° rotation Z, " +
    annotationPositionVector.x +
    ", " +
    annotationPositionVector.y;*/

  for (let annotation of annotations) {
    camera.updateMatrixWorld(); // this is it
    annotation.updatePosition();
  }

  if (frame) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const session = renderer.xr.getSession();

    if (hitTestSourceRequested === false) {
      session.requestReferenceSpace("viewer").then(function (referenceSpace) {
        session
          .requestHitTestSource({ space: referenceSpace })
          .then(function (source) {
            hitTestSource = source;
          });
      });

      session.addEventListener("end", function () {
        hitTestSourceRequested = false;
        hitTestSource = null;
      });

      hitTestSourceRequested = true;
    }

    if (hitTestSource) {
      const hitTestResults = frame.getHitTestResults(hitTestSource);
      if (hitTestResults.length) {
        const hit = hitTestResults[0];

        reticle.visible = true;
        reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
      } else {
        reticle.visible = false;
      }
    }
  }
}
