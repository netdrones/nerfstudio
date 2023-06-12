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

const MEASUREMENT_NAME = 'Measurement';
const MEAS_ORIGIN_NAME = 'Measurement-Origin';
const MEAS_END_NAME = 'Measurement-End';
const MEAS_LINE_NAME = 'Measurement-Line';
const MEAS_LABEL_NAME = 'Measurement-Label';
const USER_SCENE_NAME = 'User Scene';

const CROSSHAIR_NAME = 'Crosshair';
const GUIDE_LINE_NAME = 'Guide-Line';
const MEAS_SELECTOR_NAME = 'Selector';

// https://sbcode.net/threejs/measurements/
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
  const measScale = useSelector((state) => state.measState.scale);

  function createMarker(point) {
      const geom = new THREE.SphereGeometry(markerRadius);
      const mat = new THREE.MeshLambertMaterial({ color });
      const marker = new THREE.Mesh(geom, mat);
      marker.position.copy(point);

      return marker;
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
    [sceneTree, render_aspect],
  );

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

  // Button click
  const handleMeasStart = React.useCallback(
    (evt) => {
      evt.preventDefault();

      const camera = sceneTree.metadata.camera;
      const measGroup = sceneTree.find_object_no_create([MEASUREMENT_NAME]);

      // We're currently aiming using the crosshair
      if (isAiming) {
	const [startPoint, endPoint, direction, markerCoord] = getCameraRay(camera);

	// Create line that corresponds to vector raycast
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
	camera.updateMatrixWorld(true);

	// We're about to start a new measurement pair, so clear everything out
	if (pointCount === 2) {
	  console.log(pointCount);
	  const markerOrigin = measGroup.getObjectByName(MEAS_ORIGIN_NAME);
	  const markerEnd = measGroup.getObjectByName(MEAS_END_NAME);
	  const measLine = measGroup.getObjectByName(MEAS_LINE_NAME);
	  const prevLab = measGroup.getObjectByName(MEAS_LABEL_NAME);

	  if (markerOrigin) { measGroup.remove(markerOrigin); }
	  if (markerEnd) { measGroup.remove(markerEnd); }
	  if (measLine) { measGroup.remove(measLine); }

	  zeroPoints();
	}

	setAiming(false);

      // We're currently sliding our dot along the ray
      } else {
	const line = measGroup.getObjectByName(GUIDE_LINE_NAME);
	const selector = measGroup.getObjectByName(MEAS_SELECTOR_NAME);
	const marker = createMarker(selector.position);

	// First point in the measurement pair
	if (pointCount === 0) {

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
          measGroup.add(measureLine);

	  // Initialize label
	  const labelCanvas = document.createElement('canvas');
	  const context = labelCanvas.getContext('2d');
	  context.font = 'Bold 20px Arial';
	  context.fillStyle = 'rgba(255, 255, 255, 0.8)';
	  context.textAlign = 'center';
	  context.textBaseline = 'middle';
	  context.fillText('', labelCanvas.width / 2, labelCanvas.height / 2);

	  const labelTex = new THREE.Texture(labelCanvas);
	  labelTex.needsUpdate = true;
	  const labelMaterial = new THREE.SpriteMaterial({ map: labelTex });
	  const labelSprite = new THREE.Sprite(labelMaterial);
	  labelSprite.scale.set(100, 50, 1);
	  labelSprite.name = MEAS_LABEL_NAME;
	  measGroup.add(labelSprite);

	// Second point in measurement pair
	} else if (pointCount === 1) {
          marker.name = MEAS_END_NAME;
	  measGroup.add(marker);
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
      const canvas = sceneTree.metadata.renderer.domElement;
      const canvasPos = canvas.getBoundingClientRect();
      pointer.x = ((evt.clientX - canvasPos.left) / canvas.offsetWidth) * 2 - 1;
      pointer.y =
        -((evt.clientY - canvasPos.top) / canvas.offsetHeight) * 2 + 1;

      if (!isAiming) {

	// Project marker onto guide-line
	const line = measGroup.getObjectByName(GUIDE_LINE_NAME);
	const marker = measGroup.getObjectByName(MEAS_SELECTOR_NAME);
	const raycaster = new THREE.Raycaster();
	raycaster.setFromCamera(pointer, camera);
	const intersects = raycaster.intersectObject(line);
	if (intersects.length > 0) {
	  const intersectionPoint = intersects[0].point;
	  marker.position.copy(intersectionPoint);
	}

	// Move indicator line to marker
	const measLine = measGroup.getObjectByName(MEAS_LINE_NAME);
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

        const v0 = new THREE.Vector3(
	    referencePoint.x,
	    referencePoint.y,
	    referencePoint.z,
	);
	const v1 = new THREE.Vector3(marker.position.x, marker.position.y, marker.position.z);
	let d;
	if (measUnit === 'metric') {
	    d = `${v0.distanceTo(v1).toFixed(3) * measScale}m`;
	  } else {
	    d = `${(v0.distanceTo(v1) * 3.28084).toFixed(3)}ft`;
	  }

	console.log(d);
      }
    },
    [
      sceneTree,
      isAiming,
      pickableObjects,
      referencePoint,
      measUnit,
      measScale,
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

      // Create crosshair
      if (isAiming) {
	const camera = sceneTree.metadata.camera;
	const crosshairGeometry = new THREE.CircleGeometry(0.02, 32);
	const crosshairMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
	const crosshairMesh = new THREE.Mesh(crosshairGeometry, crosshairMaterial);
	crosshairMesh.position.set(0, 0, -10);
	crosshairMesh.renderOrder = 1;
	crosshairMesh.name = CROSSHAIR_NAME;
	camera.add(crosshairMesh);
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
      if (origin) {
        // measGroup.remove(origin);
      }
      if (end) {
        // measGroup.remove(end);
      }
      if (line) {
        // measGroup.remove(line);
      }
      if (label) {
        if (label.element && label.element.parentNode) {
          label.element.parentNode.removeChild(label.element);
        }
        measGroup.remove(label);
      }
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
