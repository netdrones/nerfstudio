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

// https://sbcode.net/threejs/measurements/
export default function MeasureTool(props) {
  const sceneTree = props.sceneTree;
  const renderer = sceneTree.metadata.renderer;
  const camera_controls = sceneTree.metadata.camera_controls;
  // const raycaster = new THREE.Raycaster();

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

  const handleMeasStart = React.useCallback(
    (evt) => {
      evt.preventDefault();

      // Initialize crosshair with offset
      const crosshairSize = 0.01;
      const crosshairMat = new THREE.LineBasicMaterial({ color: 0xff0000 });
      const crosshairGeom = new THREE.BufferGeometry();
      const vertices = new Float32Array([
	  0, crosshairSize, 0,
	  0, -crosshairSize, 0,
	  crosshairSize, 0, 0,
	  -crosshairSize, 0, 0
      ]);

      const camera = sceneTree.metadata.camera;
      crosshairGeom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      const crosshair = new THREE.LineSegments(crosshairGeom, crosshairMat);
      camera.add(crosshair);
      crosshair.renderOrder = 1;
      crosshair.position.z = -0.5;

      // Get mouse input
      const pointer = new THREE.Vector3();
      const canvas = sceneTree.metadata.renderer.domElement;
      const canvasPos = canvas.getBoundingClientRect();
      const measGroup = sceneTree.find_object_no_create([MEASUREMENT_NAME]);

      pointer.x = ((evt.clientX - canvasPos.left) / canvas.offsetWidth) * 2 - 1;
      pointer.y =
        -((evt.clientY - canvasPos.top) / canvas.offsetHeight) * 2 + 1;

      camera.aspect = canvas.offsetWidth / canvas.offsetHeight;
      camera.updateProjectionMatrix();

      // const offset = new THREE.Object3D();
      // offset.position.set(0, 0, 0);
      // camera.add(offset);

      // Get camera rotation + translation
      const arr = sceneTree.metadata.camera.matrix.elements;
      const R = new THREE.Matrix3();
      const origins = new THREE.Vector3();
      R.set(
	arr[0], arr[4], arr[8],
	arr[1], arr[5], arr[9],
	arr[2], arr[6], arr[10],
      );
      origins.set(
	arr[12], arr[13], arr[14]
      );

      // Get normal vector to camera plane
      const forward = new THREE.Vector3(0, 0, -1);
      const directions = forward.applyMatrix3(R);

      const cameraCoords = new THREE.Vector3(pointer.x, pointer.y, -1);
      const worldCoords = cameraCoords.unproject(camera);

      const mouse = new THREE.Vector2(pointer.x, pointer.x);
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      /*
      const raycaster = new THREE.Raycaster();
      const center = new THREE.Vector3(0, 0, 0.5);
      center.unproject(camera);
      const rayDirection = new THREE.Vector3();
      rayDirection.subVectors(center, camera.position).normalize();
      raycaster.set(camera.position, rayDirection);
      */

      const rayOrigin = raycaster.ray.origin;
      const rayDirection = raycaster.ray.direction;

      const material = new THREE.LineBasicMaterial({ color: 0x0000ff });
      const geometry = new THREE.BufferGeometry().setFromPoints([worldCoords, rayDirection]);
      const line = new THREE.Line(geometry, material);
      line.name = MEAS_RAY_NAME;
      line.scale.set(1,1,1);
      line.geometry.computeBoundingSphere();
      measGroup.add(line);
      const marker = createMarker(worldCoords);
      marker.name = MEAS_ORIGIN_MARKER_NAME;
      measGroup.add(marker);


      /*
      const cameraPosition = new THREE.Vector3();
      const targetPos = geometry.boundingSphere.center;
      const perpVec = getPerpendicularVector(directions);
      perpVec.normalize();
      cameraPosition.subVectors(targetPos, perpVec);
      */

      // camera_controls.setPosition(cameraPosition.x, cameraPosition.y, cameraPosition.z);
      // sceneTree.metadata.camera.lookAt(targetPos);
      //
      if (isMeasuring) {
	setMeasuring(false);
      } else {
	setMeasuring(true);
      }

      /*
      const rgbColor = new THREE.Color(color);
      const matLine = new LineMaterial({
	color,
	linewidth: lineWidth,
	dashed: true,
	gapSize: 2,
	dashSize: 1,
	dashScale: 50,
	alphaToCoverage: true,
      });
      setReferencePoint(marker.position);

      const geomLine = new LineGeometry();
      geomLine.setColors([rgbColor.r, rgbColor.g, rgbColor.b]);

      const dashed_line = new Line2(geomLine,matLine);
      dashed_line.name = MEAS_LINE_NAME;
      dashed_line.scale.set(1,1,1);
      measGroup.add(dashed_line);

      const measLabelDiv = document.createElement('div');
      measLabelDiv.innerText = '0.0m';
      measLabelDiv.className = 'MeasurementLabel';
      measLabelDiv.style.fontSize = fontSize;
      measLabelDiv.style.fontFamily = 'monospace';
      measLabelDiv.style.fontWeight = 'bold';
      measLabelDiv.style.color = color;

      const measLabel = new CSS2DObject(measLabelDiv);
      measLabel.position.copy(marker.position);
      measLabel.name = 'Measurement-Label';
      measGroup.add(measLabel);
      */
    },
    [sceneTree, color, fontSize, isMeasuring, pickableObjects],
  );

  const handleMeasMove = React.useCallback(
    (evt) => {
      evt.preventDefault();

      const pointer = new THREE.Vector3();
      const canvas = sceneTree.metadata.renderer.domElement;
      const canvasPos = canvas.getBoundingClientRect();
      pointer.x = ((evt.clientX - canvasPos.left) / canvas.offsetWidth) * 2 - 1;
      pointer.y =
        -((evt.clientY - canvasPos.top) / canvas.offsetHeight) * 2 + 1;

      const measGroup = sceneTree.find_object_no_create([MEASUREMENT_NAME]);
      if (isMeasuring) {
	/*
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
      */
      }
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

      /*
      const node = sceneTree.find_no_create([USER_SCENE_NAME]);
      if (node) {
        setPickableObjects([node.object]);
      }
      */
      // setPickableObjects(sceneTree.object.children);

    } else {
      camera_controls.enabled = true;

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
