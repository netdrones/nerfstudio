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

const USER_SCENE_NAME = 'User Scene';

// https://sbcode.net/threejs/measurements/
export default function MeasureTool(props) {
  const sceneTree = props.sceneTree;
  const renderer = sceneTree.metadata.renderer;
  const camera_controls = sceneTree.metadata.camera_controls;
  const raycaster = new THREE.Raycaster();

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

  const createMarker = React.useCallback(
    (point) => {
      const geom = new THREE.SphereGeometry(markerRadius);
      const mat = new THREE.MeshLambertMaterial({ color });
      const marker = new THREE.Mesh(geom, mat);
      marker.position.copy(point);
      return marker;
    },
    [color, markerRadius],
  );

  const handleMeasStart = React.useCallback(
    (evt) => {
      evt.preventDefault();

      const pointer = new THREE.Vector3();
      const canvas = sceneTree.metadata.renderer.domElement;
      const canvasPos = canvas.getBoundingClientRect();

      /*
      const render_height = useSelector(
	(state) => state.renderingState.render_height,
      );
      const render_width = useSelector(
	(state) => state.renderingState.render_width,
      );
      const render_aspect = render_width / render_height;
      */

      pointer.x = ((evt.clientX - canvasPos.left) / canvas.offsetWidth) * 2 - 1;
      pointer.y =
        -((evt.clientY - canvasPos.top) / canvas.offsetHeight) * 2 + 1;

      sendWebsocketMessage(viser_websocket, {
	type: 'GetDepthMessage',
	x_coord: pointer.x,
	y_coord: pointer.y,
	aspect: sceneTree.metadata.camera.aspect,
	render_aspect,
	fov: sceneTree.metadata.camera.fov,
	matrix: sceneTree.metadata.camera.matrix.elements,
	camera_type,
	timestamp: +new Date(),
      });

      // TODO: Replace with network query
      raycaster.setFromCamera(pointer, sceneTree.metadata.camera);
      const intersects = raycaster.intersectObjects(pickableObjects, true);
      if (intersects.length > 0) {
        const measGroup = sceneTree.find_object_no_create([MEASUREMENT_NAME]);
        const point = intersects[0].point;
        const marker = createMarker(point);
        marker.name = MEAS_ORIGIN_MARKER_NAME;
        measGroup.add(marker);

        if (!isMeasuring) {
          // Create a line
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
          setReferencePoint(point);

          const geomLine = new LineGeometry();
          geomLine.setColors([rgbColor.r, rgbColor.g, rgbColor.b]);

          const line = new Line2(geomLine, matLine);
          line.name = MEAS_LINE_NAME;
          line.scale.set(1, 1, 1);
          measGroup.add(line);

          // Create a measurement label
          const measLabelDiv = document.createElement('div');
          measLabelDiv.innerText = '0.0m';
          measLabelDiv.className = 'MeasurementLabel';
          measLabelDiv.style.fontSize = fontSize;
          measLabelDiv.style.fontFamily = 'monospace';
          measLabelDiv.style.fontWeight = 'bold';
          measLabelDiv.style.color = color;

          const measLabel = new CSS2DObject(measLabelDiv);
          measLabel.position.copy(point);
          measLabel.name = 'Measurement-Label';
          measGroup.add(measLabel);

          setMeasuring(true);
        } else {
          const labelId = new Date().getTime().toString();
          const origin = measGroup.getObjectByName(MEAS_ORIGIN_MARKER_NAME);
          origin.name = `${MEAS_ORIGIN_MARKER_NAME}-${labelId}`;

          const end = measGroup.getObjectByName(MEAS_END_MARKER_NAME);
          end.name = `${MEAS_END_MARKER_NAME}-${labelId}`;

          const line = measGroup.getObjectByName(MEAS_LINE_NAME);
          line.name = `${MEAS_LINE_NAME}-${labelId}`;

          const measLabel = measGroup.getObjectByName(MEAS_LABEL_NAME);
          measLabel.name = `${MEAS_LABEL_NAME}-${labelId}`;

          setMeasuring(false);
        }
      }
    },
    [sceneTree, raycaster, color, fontSize, isMeasuring, pickableObjects],
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

      // FIXME: implement depth message
      sendWebsocketMessage(viser_websocket, { type: 'GetDepthMessage' });

      // TODO: replace with network query
      const measGroup = sceneTree.find_object_no_create([MEASUREMENT_NAME]);
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
    },
    [
      sceneTree,
      raycaster,
      isMeasuring,
      pickableObjects,
      referencePoint,
      measUnit,
    ],
  );

  React.useEffect(() => {
    // Creaet a root group that maintains measurement objects
    const measGroup = sceneTree.find_no_create([MEASUREMENT_NAME]);
    if (!measGroup) {
      sceneTree.set_object_from_path([MEASUREMENT_NAME], new THREE.Group());
    }
  }, []);

  React.useEffect(() => {
    if (measEnabled) {
      camera_controls.enabled = false;

      // FIXME: Add NeRF objects that Raycaster detects
      const node = sceneTree.find_no_create([USER_SCENE_NAME]);
      if (node) {
        setPickableObjects([node.object]);
      }
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
