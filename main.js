import "./style.css";
import * as THREE from "three";
import { ArcballControls } from "three/examples/jsm/controls/ArcballControls";

let container;
let camera, scene, renderer;
let controls, controller;
let box;

let reticle;
let hitTestSource = null;
let hitTestSourceRequested = false;
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
    60,
    window.innerWidth / window.innerHeight,
    0.01,
    10000
  );
  camera.position.set(0, 0, 3);
  //camera.matrixAutoUpdate = false;

  const light = new THREE.AmbientLight(0xffffff, 1);
  //light.position.set(0.5, 1, 0.25);
  scene.add(light);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  controls = new ArcballControls(camera, renderer.domElement, scene);
  container.appendChild(renderer.domElement);

  const geometry = new THREE.BoxBufferGeometry(0.5, 0.5, 0.5);
  const material = new THREE.MeshNormalMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8,
  });
  box = new THREE.Mesh(geometry, material);
  box.name = "box";
  //scene.add(box);
  movables.add(box);

  let axesHelper = new THREE.AxesHelper(3);
  axesHelper.name = "axesHelper";
  //scene.add(axesHelper);
  movables.add(axesHelper);

  controller = renderer.xr.getController(0);
  controller.addEventListener("select", onSelect);
  scene.add(controller);

  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial()
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  window.addEventListener("resize", onWindowResize);

  //debug scale
  /*scale = document.createElement("div");
  scale.style.position = "absolute";
  scale.style.top = "5px";
  scale.style.left = "5px";
  scale.innerHTML = "TEXT";
  document.querySelector("#annotations").appendChild(scale);*/

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

  scene.add(movables);
  console.log(movables);
}

function onSelect() {
  if (reticle.visible) {
    movables.position.setFromMatrixPosition(reticle.matrix);
  }
}

function randomNumber(min, max) {
  return min + Math.random() * (max - min);
}

function createAnnotation(position) {
  // DOM Element to click on
  let DOMannotation = document.createElement("div");
  DOMannotation.classList.add("annotation");
  DOMannotation.style.width = "24px";
  DOMannotation.style.height = "24px";
  DOMannotation.style.borderRadius = "50%";
  DOMannotation.style.border = "2px solid #ddd";
  DOMannotation.style.opacity = 1.0;
  DOMannotation.style.position = "absolute";
  /*DOMannotation.addEventListener("click", () => {
    console.log("onclick")
  });*/
  document.querySelector("#annotations").appendChild(DOMannotation);

  //let annotation3D = new THREE.Object3D();
  let annotation3D = createSphere(position);
  annotation3D.domElement = DOMannotation;

  annotation3D.updatePosition = function () {
    const vector = new THREE.Vector3();
    this.getWorldPosition(vector);

    const canvas = renderer.domElement;

    vector.project(camera);

    vector.x = Math.round(
      (0.5 + vector.x / 2) * (canvas.width / window.devicePixelRatio)
    );

    vector.y = Math.round(
      (0.5 - vector.y / 2) * (canvas.height / window.devicePixelRatio) // the formula Math.min(devicePixelratio, 2) makes problems on mobile devices
    );

    // move the annotation on the screen
    DOMannotation.style.top = `${vector.y - 12}px`;
    DOMannotation.style.left = `${vector.x - 12}px`;
  };

  //scene.add(annotation3D);
  movables.add(annotation3D);
  return annotation3D;
}

function createSphere(position = { x: 0, y: 0, z: 0 }, color = 0xbb0000) {
  let geometry = new THREE.SphereBufferGeometry(0.02, 16, 16);
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
  // can i update the camera matrix world just once here and not every frame?
  //camera.updateMatrixWorld();
  renderer.xr.setReferenceSpaceType("local");
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
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
  controls.update();
  renderer.render(scene, camera);
  for (let annotation of annotations) {
    camera.updateMatrixWorld(); // this is it
    annotation.updatePosition();
  }
  if (frame) {
    movables.visible = false;
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
        movables.visible = true;
        movables.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
        reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
      } else {
        reticle.visible = false;
      }
    }
  }
}
