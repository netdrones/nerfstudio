import * as React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer';
import { Line2 } from 'three/examples/jsm/lines/Line2';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial';

const MEASUREMENT_NAME = 'Measurement';
const IMPORTED_OBJECT_NAME = 'Import';

// https://sbcode.net/threejs/measurements/
export default function MeasureTool(props) {
  const sceneTree = props.sceneTree;
  const renderer = sceneTree.metadata.renderer;
  const camera_controls = sceneTree.metadata.camera_controls;
  const raycaster = React.useMemo(() => new THREE.Raycaster());
  const intersects = React.useMemo(() => []);

  const [isMeasuring, setMeasuring] = React.useState(false);
  const [referencePoint, setReferencePoint] = React.useState(null);
  const [pickableObjects, setPickableObjects] = React.useState(null);

  const fontSize = useSelector((state) => state.measState.fontSize);
  const color = useSelector((state) => state.measState.color);
  const markerRadius = useSelector((state) => state.measState.markerRadius);
  const lineWidth = useSelector((state) => state.measState.lineWidth);
  const measUnit = useSelector((state) => state.measState.unit);

  React.useEffect(() => {
    // Creaet a root group that maintains measurement objects
    const measGroup = sceneTree.find_no_create([MEASUREMENT_NAME]);
    if (!measGroup) {
      sceneTree.set_object_from_path([MEASUREMENT_NAME], new THREE.Group());
    }

    camera_controls.enabled = false;

    // FIXME: Add NeRF objects that Raycaster detects
    const node = sceneTree.find_no_create([IMPORTED_OBJECT_NAME]);
    if (node) {
      setPickableObjects([node.object]);
    }

    return () => {
      camera_controls.enabled = true;
    };
  }, []);

  const createMarker = React.useCallback(
    (point) => {
      const geom = new THREE.SphereGeometry(markerRadius);
      const mat = new THREE.MeshLambertMaterial({ color });
      const marker = new THREE.Mesh(geom, mat);
      marker.name = `Marker-${new Date().getTime()}`;
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
      pointer.x = ((evt.clientX - canvasPos.left) / canvas.offsetWidth) * 2 - 1;
      pointer.y =
        -((evt.clientY - canvasPos.top) / canvas.offsetHeight) * 2 + 1;

      intersects.length = 0;
      raycaster.setFromCamera(pointer, sceneTree.metadata.camera);
      raycaster.intersectObjects(pickableObjects, true, intersects);
      if (intersects.length > 0) {
        const measGroup = sceneTree.find_object_no_create([MEASUREMENT_NAME]);
        const point = intersects[0].point;
        const marker = createMarker(point);
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
          line.name = 'Measurement-Line';
          line.scale.set(1, 1, 1);
          measGroup.add(line);

          // Create a measurement label
          const measLabelDiv = document.createElement('div');
          measLabelDiv.innerText = '0.0m';
          measLabelDiv.className = 'MeasurementLabel';
          measLabelDiv.style.fontSize = fontSize;
          measLabelDiv.style.fontFamily = 'monospace';
          measLabelDiv.style.color = color;

          const measLabel = new CSS2DObject(measLabelDiv);
          measLabel.position.copy(point);
          measLabel.name = 'Measurement-Label';
          measGroup.add(measLabel);

          setMeasuring(true);
        } else {
          const labelId = new Date().getTime().toString();
          const line = measGroup.getObjectByName('Measurement-Line');
          line.name = `Measurement-Line-${labelId}`;

          const measLabel = measGroup.getObjectByName('Measurement-Label');
          measLabel.name = `Measurement-Label-${labelId}`;

          setMeasuring(false);
        }
      }
    },
    [
      sceneTree,
      raycaster,
      color,
      fontSize,
      isMeasuring,
      pickableObjects,
      intersects,
    ],
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
        intersects.length = 0;
        raycaster.setFromCamera(pointer, sceneTree.metadata.camera);
        raycaster.intersectObjects(pickableObjects, true, intersects);
        if (intersects.length > 0) {
          const point = intersects[0].point;
          let marker = measGroup.getObjectByName('Measurement-Marker');
          if (!marker) {
            marker = createMarker(point);
            marker.name = 'Measurement-Marker';
            measGroup.add(marker);
          }
          marker.position.copy(point);

          const line = measGroup.getObjectByName('Measurement-Line');
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

          const measLabel = measGroup.getObjectByName('Measurement-Label');
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
      intersects,
      referencePoint,
      measUnit,
    ],
  );

  return (
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
  );
}
