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
const MEAS_ORIGIN_MARKER_NAME = 'Measurement-Origin';
const MEAS_END_MARKER_NAME = 'Measurement-End';
const MEAS_LINE_NAME = 'Measurement-Line';
const MEAS_LABEL_NAME = 'Measurement-Label';
const MEAS_RAY_NAME = 'Measurement-Ray';
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

  const [isMeasuring, setMeasuring] = React.useState(false);
  const [referencePoint, setReferencePoint] = React.useState(null);
  const [pickableObjects, setPickableObjects] = React.useState([]);

  const measEnabled = useSelector((state) => state.measState.enabled);
  const fontSize = useSelector((state) => state.measState.fontSize);
  const color = useSelector((state) => state.measState.color);
  const markerRadius = useSelector((state) => state.measState.markerRadius);
  const lineWidth = useSelector((state) => state.measState.lineWidth);
  const measUnit = useSelector((state) => state.measState.unit);
  const o_x = useSelector((state) => state.measState.o_x);
  const o_y = useSelector((state) => state.measState.o_y);
  const o_z = useSelector((state) => state.measState.o_z);
  const d_x = useSelector((state) => state.measState.d_x);
  const d_y = useSelector((state) => state.measState.d_y);
  const d_z = useSelector((state) => state.measState.d_z);

  function getPerpendicularVector(directions) {
      const v = new THREE.Vector3();

      if (directions.x !== 0 || directions.y !== 0) {
	  v.set(-directions.y, directions.x, 0);
      } else {
	  // In case where directions is parallel to the z-axis, choose an arbitrary vector in the xy plane
	  v.set(1, 0, 0);
      }

      return v;
  }

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

  const getNerfPoint = React.useCallback(
    () => {
      const origins = new THREE.Vector3();
      origins.x = o_x;
      origins.y = o_y;
      origins.z = o_z;

      const directions = new THREE.Vector3();
      directions.x = d_x;
      directions.y = d_y;
      directions.z = d_z;

      return [origins, directions];
    },
    [o_x, o_y, o_z, d_x, d_y, d_z],
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

  const handleMeasStart = React.useCallback(
    (evt) => {
      evt.preventDefault();

      const camera = sceneTree.metadata.camera;
      const measGroup = sceneTree.find_object_no_create([MEASUREMENT_NAME]);

      // Place marker in scene along camera far Z-plane
      if (!isMeasuring) {
	const [startPoint, endPoint, direction, markerCoord] = getCameraRay(camera);

	// Create line that corresponds to vector raycast
	const lineGeometry = new THREE.BufferGeometry().setFromPoints([startPoint, endPoint]);
	const lineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
	const lineMesh = new THREE.Line(lineGeometry, lineMaterial);
	const marker = createMarker(markerCoord);

	lineMesh.name = GUIDE_LINE_NAME;
	marker.name = MEAS_SELECTOR_NAME;
	measGroup.add(lineMesh);
	measGroup.add(marker);

	// Turn the camera 90 degrees to select depth
	const cameraOffset = new THREE.Vector3();
	const cameraPosition = new THREE.Vector3();
	const zAxis = new THREE.Vector3(0, 0, 1);
	cameraOffset.crossVectors(direction, zAxis);
	cameraPosition.addVectors(marker.position, cameraOffset.multiplyScalar(1));
	cameraPosition.z += 0.2;
	camera_controls.setPosition(cameraPosition.x, cameraPosition.y, cameraPosition.z);
	sceneTree.metadata.camera.lookAt(marker.position);
	camera.updateMatrixWorld(true);
	setMeasuring(true);
      }

    },
    [sceneTree, color, fontSize, isMeasuring, pickableObjects],
  );

  const handleMeasMove = React.useCallback(
    (evt) => {
      evt.preventDefault();

      // Get mouse coordinates
      const pointer = new THREE.Vector2();
      const camera = sceneTree.metadata.camera;
      const canvas = sceneTree.metadata.renderer.domElement;
      const canvasPos = canvas.getBoundingClientRect();
      pointer.x = ((evt.clientX - canvasPos.left) / canvas.offsetWidth) * 2 - 1;
      pointer.y =
        -((evt.clientY - canvasPos.top) / canvas.offsetHeight) * 2 + 1;

      const measGroup = sceneTree.find_object_no_create([MEASUREMENT_NAME]);
      const line = measGroup.getObjectByName(GUIDE_LINE_NAME);
      const marker = measGroup.getObjectByName(MEAS_SELECTOR_NAME);

      // Project marker onto the line
      if (isMeasuring) {
	const raycaster = new THREE.Raycaster();
	const linePts = line.geometry.attributes.position.array;
	const startPoint = new THREE.Vector3(linePts[0]);
	const endPoint = new THREE.Vector3(linePts[3]);
	raycaster.setFromCamera(pointer, camera);
	const closestPoint = raycaster.ray.closestPointToPoint(startPoint, endPoint);
	marker.position.copy(closestPoint);
      }

      /*
      if (isMeasuring) {
        raycaster.setFromCamera(pointer, sceneTree.metadata.camera);
        const intersects = raycaster.intersectObjects(pickableObjects, true);
        if (intersects.length > 0) {
          const point = intersects[0].point;
          let marker = measGroup.getObjectByName(MEAS_END_MARKER_NAME);
          if (!marker) {
            marker = createMarker(point);
            marker.name = MEAS_END_MARKER_NAME;
            measGroup.add(marker);
          }
          marker.position.copy(point);

          const line = measGroup.getObjectByName(MEAS_LINE_NAME);
          line.geometry.setPositions([
            referencePoint.x,
            referencePoint.y,
            referencePoint.z,
            point.x,
            point.y,
            point.z,
          ]);
          line.geometry.attributes.position.needsUpdate = true;
          line.computeLineDistances();

          const v0 = new THREE.Vector3(
            referencePoint.x,
            referencePoint.y,
            referencePoint.z,
          );
          const v1 = new THREE.Vector3(point.x, point.y, point.z);
          let d;
          if (measUnit === 'metric') {
            d = `${v0.distanceTo(v1).toFixed(3)}m`;
          } else {
            d = `${(v0.distanceTo(v1) * 3.28084).toFixed(3)}ft`;
          }

          const measLabel = measGroup.getObjectByName(MEAS_LABEL_NAME);
          measLabel.element.innerText = d;
          measLabel.position.lerpVectors(v0, v1, 0.5);
        }
      }
      */
    },
    [
      sceneTree,
      // raycaster,
      isMeasuring,
      pickableObjects,
      referencePoint,
      measUnit,
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
      if (!isMeasuring) {
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
      if (!isMeasuring) {
	const crosshairMesh = sceneTree.metadata.camera.getObjectByName(CROSSHAIR_NAME);
	if (crosshairMesh) {
	  crosshairMesh.parent.remove(crosshairMesh);
	}
      }

      // Make sure to cancel incomplete measurement
      const measGroup = sceneTree.find_object_no_create([MEASUREMENT_NAME]);
      const origin = measGroup.getObjectByName(MEAS_ORIGIN_MARKER_NAME);
      const end = measGroup.getObjectByName(MEAS_END_MARKER_NAME);
      const line = measGroup.getObjectByName(MEAS_LINE_NAME);
      const label = measGroup.getObjectByName(MEAS_LABEL_NAME);
      if (origin) {
        measGroup.remove(origin);
      }
      if (end) {
        measGroup.remove(end);
      }
      if (line) {
        measGroup.remove(line);
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
