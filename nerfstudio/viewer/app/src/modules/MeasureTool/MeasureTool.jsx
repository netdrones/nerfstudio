import * as THREE from 'three';

import React, { useContext } from 'react';
import { useSelector } from 'react-redux';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer';
import { Line2 } from 'three/examples/jsm/lines/Line2';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial';
import {
    ViserWebSocketContext,
    sendWebsocketMessage,
} from '../WebSocket/ViserWebSocket';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

const MEASUREMENT_NAME = 'Measurement';
const MEAS_ORIGIN_NAME = 'Measurement-Origin';
const MEAS_END_NAME = 'Measurement-End';
const MEAS_LINE_NAME = 'Measurement-Line';
const MEAS_LABEL_NAME = 'Measurement-Label';
const USER_SCENE_NAME = 'User Scene';

const CROSSHAIR_NAME = 'Crosshair';
const GUIDE_LINE_NAME = 'Guide-Line';
const MEAS_SELECTOR_NAME = 'Selector';
const MEAS_PLANE_NAME = 'Plane';
const MEAS_TRANSFORM_NAME = 'Transform';

const PLANE_1_NAME = 'P1';
const PLANE_2_NAME = 'P2';
const PLANE_3_NAME= 'P3';

export default function MeasureTool(props) {
  const sceneTree = props.sceneTree;
  const renderer = sceneTree.metadata.renderer;
  const camera_controls = sceneTree.metadata.camera_controls;

  const viser_websocket = useContext(ViserWebSocketContext);
  const camera_type = useSelector((state) => state.renderingState.camera_type);

  const render_height = useSelector(
    (state) => state.renderingState.render_height,
  );
  const render_width = useSelector(
    (state) => state.renderingState.render_width,
  );
  const render_aspect = render_width / render_height;

  let measLabel = null;
  const [isAiming, setAiming] = React.useState(true);
  const [referencePoint, setReferencePoint] = React.useState(null);
  const [pickableObjects, setPickableObjects] = React.useState([]);
  const [pointCount, setCount] = React.useState(0);
  const incrementPoints = () => { setCount(pointCount+1); };
  const zeroPoints = () => { setCount(0); };

  const measEnabled = useSelector((state) => state.measState.enabled);
  const fontSize = useSelector((state) => state.measState.fontSize);
  const color = useSelector((state) => state.measState.color);
  const markerRadius = useSelector((state) => state.measState.markerRadius);
  const lineWidth = useSelector((state) => state.measState.lineWidth);
  const measUnit = useSelector((state) => state.measState.unit);
  const scaleFactor = useSelector((state) => state.measState.scaleFactor);
  const measMode = useSelector((state) => state.measState.mode);

  function createMarker(point) {
      const geom = new THREE.SphereGeometry(markerRadius);
      const mat = new THREE.MeshLambertMaterial({ color });
      const marker = new THREE.Mesh(geom, mat);
      marker.position.copy(point);

      return marker;
  }

  function createPlane(point, width, height) {
    const planeGeometry = new THREE.PlaneGeometry(width, height);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff, // white
      side: THREE.DoubleSide
    });

    const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
    planeMesh.name = MEAS_PLANE_NAME;

    planeMesh.position.set(point.x, point.y, point.z);
    planeMesh.lookAt(sceneTree.metadata.camera.position);

    return planeMesh;
  }

  function createPlaneFromPoints(x1, x2, x3) {

    const v1 = new THREE.Vector3(x1.position.x, x1.position.y, x1.position.z);
    const v2 = new THREE.Vector3(x2.position.x, x2.position.y, x2.position.z);
    const v3 = new THREE.Vector3(x3.position.x, x3.position.y, x3.position.z);

    const edge1 = new THREE.Vector3();
    const edge2 = new THREE.Vector3();

    edge1.subVectors(v2, v1);
    edge2.subVectors(v3, v1);

    const normal = new THREE.Vector3();
    normal.crossVectors(edge1, edge2).normalize();

    const area = edge1.cross(edge2).length() / 2;
    const planeSize = Math.sqrt(area);

    const planeGeometry = new THREE.PlaneGeometry(planeSize, planeSize);

    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);

    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00, side: THREE.DoubleSide
    });

    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.position.copy(v1.add(v2).add(v3).divideScalar(3)); // Center the plane on the triangle
    plane.quaternion.copy(quaternion);

    return plane;
  }

  function getCameraRay(camera) {

    const startPoint = new THREE.Vector3();
    const endPoint = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const markerCoord = new THREE.Vector3();

    camera.getWorldPosition(startPoint);
    camera.localToWorld(endPoint.set(0, 0, -9999)).add(startPoint);

    direction.subVectors(endPoint, startPoint);
    direction.normalize();
    direction.multiplyScalar(0.8);

    markerCoord.addVectors(startPoint, direction);

    return [startPoint, endPoint, direction, markerCoord]
  }

  function saveGroup(group, filename) {
    const json = group.toJSON();
    const jsonString = JSON.stringify(json);

    // Create a Blob from the JSON string
    const blob = new Blob([jsonString], { type: 'application/json' });

    // Create a temporary anchor element to trigger the download
    const anchorElement = document.createElement('a');
    anchorElement.href = URL.createObjectURL(blob);
    anchorElement.download = filename;

    // Trigger the download
    anchorElement.click();
  }

  const sendNerfQuery = React.useCallback(
    (pointer) => {
      sendWebsocketMessage(viser_websocket, {
	type: 'GetDepthMessage',
	x_coord: pointer.x,
	y_coord: pointer.y,
	aspect: sceneTree.metadata.camera.aspect,
	render_aspect,
	fov: sceneTree.metadata.camera.fov,
	matrix: sceneTree.metadata.camera.matrix.elements,
	camera_type,
      });
    },
    [sceneTree, render_aspect, camera_type, viser_websocket],
  );

  /**
   * Handles state logic when the mouse is pressed.
   *
   * There's two possible main states:
   *     1. Aiming - we're using the crosshair to create a guide-line for placing the point
   *     2. Positioning - we're positioning the point along the guide-ray
   *
   * When we're in the "Aiming" state, the application behavior is always the same.
   *
   * When we're in the "Positioning" state, we must keep track of a few things:
   *     1. `measState/mode` {point, plane}
   *         In "point" mode, we compute the min. Euclidean distance between point pairs.
   *         In "plane" mode, we select three points in the scene to insert a plane.
   *     2. Number of points
   *         In "point" mode, if one point exists, then a line initializes between the first
   *         and second points which displays the distance between them.
   *         In "plane" mode, every third point placed into the scene triggers adds the plane.
   *
   */
  const handleMeasStart = React.useCallback(
    (evt) => {
      evt.preventDefault();

      const camera = sceneTree.metadata.camera;
      const measGroup = sceneTree.find_object_no_create([MEASUREMENT_NAME]);

      // Aiming mode
      if (isAiming) {
	const [startPoint, endPoint, direction, markerCoord] = getCameraRay(camera);

	// Create guide-ray that corresponds to vector raycast
	const lineGeometry = new THREE.BufferGeometry().setFromPoints([startPoint, endPoint]);
	const lineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
	const lineMesh = new THREE.Line(lineGeometry, lineMaterial);
	const selector = createMarker(markerCoord);

	lineMesh.name = GUIDE_LINE_NAME;
	selector.name = MEAS_SELECTOR_NAME;
	measGroup.add(lineMesh);
	measGroup.add(selector);

	// Turn the camera 90 degrees to select depth
	const cameraOffset = new THREE.Vector3();
	const cameraPosition = new THREE.Vector3();
	const zAxis = new THREE.Vector3(0, 0, 1);
	cameraOffset.crossVectors(direction, zAxis);
	cameraPosition.addVectors(selector.position, cameraOffset.multiplyScalar(1));
	cameraPosition.z += 0.2;
	camera_controls.setPosition(cameraPosition.x, cameraPosition.y, cameraPosition.z);
	sceneTree.metadata.camera.lookAt(selector.position);
	sceneTree.metadata.camera.updateMatrixWorld(true);

	// Start a new group in points mode
	const labelId = new Date().getTime().toString();
	if (pointCount === 2 && measMode === 'points') {

	  const labelId = new Date().getTime().toString();
	  const markerOrigin = measGroup.getObjectByName(MEAS_ORIGIN_NAME);
	  const markerEnd = measGroup.getObjectByName(MEAS_END_NAME);
	  const measLine = measGroup.getObjectByName(MEAS_LINE_NAME);
	  const measLabel = measGroup.getObjectByName(MEAS_LABEL_NAME);

	  if (markerOrigin) { markerOrigin.name = `${MEAS_ORIGIN_NAME}-${labelId}`; }
	  if (markerEnd) { markerEnd.name = `${MEAS_END_NAME}-${labelId}`; }
	  if (measLine) { measLine.name = `${MEAS_LINE_NAME}-${labelId}`; }
	  if (measLabel) { measLabel.name = `${MEAS_LABEL_NAME}-${labelId}`; }

	  zeroPoints();
	}

	// Start a new group in plane mode
	else if (pointCount === 3 && measMode === 'plane') {
	  const p1 = measGroup.getObjectByName(PLANE_1_NAME);
	  const p2 = measGroup.getObjectByName(PLANE_2_NAME);
	  const p3 = measGroup.getObjectByName(PLANE_3_NAME);
	  const measPlane = measGroup.getObjectByName(MEAS_PLANE_NAME);

	  if (p1) { p1.name = `${PLANE_1_NAME}-${labelId}`; }
	  if (p2) { p2.name = `${PLANE_2_NAME}-${labelId}`; }
	  if (p3) { p3.name = `${PLANE_3_NAME}-${labelId}`; }
	  if (measPlane) {
	    measPlane.name = `${MEAS_PLANE_NAME}-${labelId}`;
	  }

	  zeroPoints();
	}

	setAiming(false);

      // Positioning mode
      } else {
	const line = measGroup.getObjectByName(GUIDE_LINE_NAME);
	const selector = measGroup.getObjectByName(MEAS_SELECTOR_NAME);
	const marker = createMarker(selector.position);

	if (pointCount === 0) {

	  if (measMode === 'plane') {
	    marker.name = PLANE_1_NAME;
	    measGroup.add(marker);

	    const transform_controls = sceneTree.metadata.transform_controls;
	    transform_controls.addEventListener('dragging-changed', function (event) {
	      camera_controls.enabled != event.value;
	    });

	    // const plane = createPlane(selector.position, 0.5, 0.5);
	    // plane.name = MEAS_PLANE_NAME;

	    // transform_controls.attach(plane);
	    // transform_controls.setMode('rotate');
	    // sceneTree.object.add(transform_controls);
	    // measGroup.add(plane);
	  }

	  else if (measMode === 'points') {
	    marker.name = MEAS_ORIGIN_NAME;
	    measGroup.add(marker);

	    // Initialize measurement line
	    const rgbColor = new THREE.Color(color);
	    const matLine = new LineMaterial({
	      color,
	      linewidth: lineWidth,
	      dashed: true,
	      gapSize: 0.5,
	      dashSize: 0.4,
	      dashScale: 80,
	      alphaToCoverage: true,
	    });
	    setReferencePoint(marker.position);

	    const geomLine = new LineGeometry();
	    geomLine.setColors([rgbColor.r, rgbColor.g, rgbColor.b]);

	    const measureLine = new Line2(geomLine, matLine);
	    measureLine.name = MEAS_LINE_NAME;
	    measureLine.scale.set(1, 1, 1);
	    measureLine.userData = {
	      originX: marker.position.x,
	      originY: marker.position.y,
	      originZ: marker.position.z,
	      endX: null,
	      endY: null,
	      endZ: null
	    };
	    measGroup.add(measureLine);
	  }
	}

	else if (pointCount === 1) {

	  if (measMode === 'plane') {
	    marker.name = PLANE_2_NAME;
	    measGroup.add(marker);
	  }

	  else if (measMode === 'points') {
	    marker.name = MEAS_END_NAME;
	    measGroup.add(marker);
	  }
	}

	else if (pointCount === 2) {
	  if (measMode === 'plane') {
	    marker.name = PLANE_3_NAME;
	    measGroup.add(marker);

	    const p1 = measGroup.getObjectByName(PLANE_1_NAME);
	    const p2 = measGroup.getObjectByName(PLANE_2_NAME);
	    const p3 = measGroup.getObjectByName(PLANE_3_NAME);

	    const plane = createPlaneFromPoints(p1, p2, p3);
	    plane.name = MEAS_PLANE_NAME;
	    measGroup.add(plane);

            const transform_controls = sceneTree.metadata.transform_controls;
	    transform_controls.addEventListener('dragging-changed', function (event) {
	      camera_controls.enabled != event.value;
	    });

	    transform_controls.attach(plane);
	    transform_controls.setMode('rotate');
	    sceneTree.object.add(transform_controls);
	  }
	}

	// Remove the guide-line and selector
	measGroup.remove(line);
	measGroup.remove(selector);

	incrementPoints();
	setAiming(true);
      }
    },
    [sceneTree, color, fontSize, isAiming, pickableObjects],
  );

  const handleMeasMove = React.useCallback(
    (evt) => {
      evt.preventDefault();
      const camera = sceneTree.metadata.camera;
      const measGroup = sceneTree.find_object_no_create([MEASUREMENT_NAME]);

      // Get mouse coordinates
      const pointer = new THREE.Vector2();
      const raycaster = new THREE.Raycaster();
      const canvas = sceneTree.metadata.renderer.domElement;
      const canvasPos = canvas.getBoundingClientRect();
      pointer.x = ((evt.clientX - canvasPos.left) / canvas.offsetWidth) * 2 - 1;
      pointer.y =
        -((evt.clientY - canvasPos.top) / canvas.offsetHeight) * 2 + 1;

      // Point sliding mode
      if (!isAiming) {

	// Project marker onto guide-line
	const line = measGroup.getObjectByName(GUIDE_LINE_NAME);
	const marker = measGroup.getObjectByName(MEAS_SELECTOR_NAME);
	raycaster.setFromCamera(pointer, camera);
	if (line) {
	  const intersects = raycaster.intersectObject(line);
	  if (intersects.length > 0) {
	    const intersectionPoint = intersects[0].point;
	    marker.position.copy(intersectionPoint);
	  }
	}

	// Move indicator line to marker
	const measLine = measGroup.getObjectByName(MEAS_LINE_NAME);
	if (measLine) {
	  measLine.geometry.setPositions([
	      referencePoint.x,
	      referencePoint.y,
	      referencePoint.z,
	      marker.position.x,
	      marker.position.y,
	      marker.position.z,
	  ]);
	  measLine.geometry.attributes.position.needsUpdate = true;
	  measLine.computeLineDistances();
	  measLine.userData.endX = marker.position.x;
	  measLine.userData.endY = marker.position.y;
	  measLine.userData.endZ = marker.position.z;

	  const v0 = new THREE.Vector3(
	      referencePoint.x,
	      referencePoint.y,
	      referencePoint.z,
	  );
	  const v1 = new THREE.Vector3(marker.position.x, marker.position.y, marker.position.z);

	  const offset = 1;
	  const midpoint = new THREE.Vector3();
	  midpoint.addVectors(v0, v1).multiplyScalar(0.5);

	  let distance;
	  if (measUnit === 'metric') {
	      distance = `${(v0.distanceTo(v1) * scaleFactor).toFixed(3)}m`;
	  } else {
	      distance = `${(v0.distanceTo(v1) * 3.28084).toFixed(3)}ft`;
	  }

	  // Create a new canvas
	  if (!measLabel) {
	    let canvas = document.createElement('canvas');
	    canvas.width = 1024;
	    canvas.height = 512;
	    let context = canvas.getContext('2d');
	    let text = distance;
	    context.font = '18px Arial';
	    let textMetrics = context.measureText(text);

	    let x = (canvas.width - textMetrics.width) / 2;
	    let y = (canvas.height + parseInt(context.font)) / 2;

	    context.fillText(text, x, y);

	    const tex = new THREE.Texture(canvas);
	    tex.needsUpdate = true;

	    const spriteMat = new THREE.SpriteMaterial({ map: tex });
	    measLabel = new THREE.Sprite(spriteMat);
	    measLabel.name = MEAS_LABEL_NAME;
	    measLabel.userData = { dist: text };

	    sceneTree.object.add(measLabel);
	    measGroup.add(measLabel);

	  // Update existing canvas
	  } else {
	    let canvas = measLabel.material.map.image;
	    let context = canvas.getContext('2d');
	    let text = distance;

	    context.font = '18px Arial';
	    context.clearRect(0, 0, canvas.width, canvas.height);

	    let textMetrics = context.measureText(text);
	    let x = (canvas.width - textMetrics.width) / 2;
	    let y = (canvas.height + parseInt(context.font)) / 2;

	    context.fillText(text, x, y);
	    measLabel.material.map.needsUpdate = true;

	    measLabel.userData.dist = text;

	  }
	measLabel.position.copy(midpoint);
	}
      }
    },
    [
      sceneTree,
      isAiming,
      pickableObjects,
      referencePoint,
      measUnit,
      scaleFactor,
    ],
  );

  React.useEffect(() => {
    // Create a root group that maintains measurement objects
    const measGroup = sceneTree.find_no_create([MEASUREMENT_NAME]);
    if (!measGroup) {
      sceneTree.set_object_from_path([MEASUREMENT_NAME], new THREE.Group());
    }
  }, []);

  React.useEffect(() => {
    if (measEnabled) {
      camera_controls.enabled = false;

      if (isAiming) {

	// Create crosshair
	const crosshairSize = 0.15; // Size of the crosshair lines
	const crosshairThickness = 0.01; // Thickness of the crosshair lines
	const crosshairColor = 0xffffff; // Color of the crosshair
	const crosshairGeometry = new THREE.BufferGeometry();

	const vertices = new Float32Array([
	  -crosshairSize, crosshairThickness / 2, 0,
	  crosshairSize, crosshairThickness / 2, 0,
	  -crosshairSize, -crosshairThickness / 2, 0,
	  crosshairSize, -crosshairThickness / 2, 0,
	  -crosshairThickness / 2, crosshairSize, 0,
	  -crosshairThickness / 2, -crosshairSize, 0,
	  crosshairThickness / 2, crosshairSize, 0,
	  crosshairThickness / 2, -crosshairSize, 0
	]);

	crosshairGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

	const crosshairMaterial = new THREE.LineBasicMaterial({ color: crosshairColor });
	const crosshairMesh = new THREE.LineSegments(crosshairGeometry, crosshairMaterial);

	const dotGeometry = new THREE.CircleGeometry(0.06, 32);
	const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
	const dotMesh = new THREE.Mesh(dotGeometry, dotMaterial);
	dotMesh.position.set(0, 0, -10);
	crosshairMesh.position.set(0, 0, -10);
	crosshairMesh.renderOrder = 1;
	dotMesh.renderOrder = 1;
	crosshairMesh.name = CROSSHAIR_NAME;
	crosshairMesh.add(dotMesh);
	sceneTree.metadata.camera.add(crosshairMesh);
      }

    } else {
      camera_controls.enabled = true;

      // Remove crosshair
      if (!isAiming) {
	const crosshairMesh = sceneTree.metadata.camera.getObjectByName(CROSSHAIR_NAME);
	if (crosshairMesh) {
	  crosshairMesh.parent.remove(crosshairMesh);
	}
      }

      // Make sure to cancel incomplete measurement
      const measGroup = sceneTree.find_object_no_create([MEASUREMENT_NAME]);
      const origin = measGroup.getObjectByName(MEAS_ORIGIN_NAME);
      const end = measGroup.getObjectByName(MEAS_END_NAME);
      const line = measGroup.getObjectByName(MEAS_LINE_NAME);
      const label = measGroup.getObjectByName(MEAS_LABEL_NAME);
    }
  }, [measEnabled, sceneTree]);

  return (
    <>
      {!!measEnabled && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: renderer.domElement.offsetWidth + 'px',
            height: renderer.domElement.offsetHeight + 'px',
            zIndex: 9999,
            background: 'transparent',
            cursor: 'crosshair',
          }}
          onPointerDown={handleMeasStart}
          onPointerMove={handleMeasMove}
        ></div>
      )}
    </>
  );
}
