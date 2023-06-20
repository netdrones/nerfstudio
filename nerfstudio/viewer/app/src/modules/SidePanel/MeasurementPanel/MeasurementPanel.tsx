import * as THREE from 'three';
import * as React from 'react';

import { LevaPanel, LevaStoreProvider, useCreateStore } from 'leva';
import { Button } from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';

import { Line2 } from 'three/examples/jsm/lines/Line2';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial';

import LevaTheme from '../../../themes/leva_theme.json';
import SceneNode from '../../../SceneNode';
import MeasurementPropPanel from './MeasurementPropPanel';

interface MeasurementPanelProps {
  sceneTree: SceneNode;
}

const MEASUREMENT_NAME = 'Measurement';
const PLANE_WIDTH = 0.5;
const PLANE_HEIGHT = 0.5;

export default function MeasurementPanel(props: MeasurementPanelProps) {
  const sceneTree = props.sceneTree;
  const measPropStore = useCreateStore();
  const color = useSelector((state) => state.measState.color);
  const markerRadius = useSelector((state) => state.measState.markerRadius);
  const lineWidth = useSelector((state) => state.measState.lineWidth);

  function createChildFromData(childData) {
    console.log(childData);
    const { type, position, rotation, scale } = childData;
    let child;

    switch (type) {
      case 'Mesh':
	const childName = childData.name;

        // Marker
        if (childName.includes('Origin') || childName.includes('End')) {
	  const geom = new THREE.SphereGeometry(markerRadius);
	  const mat = new THREE.MeshLambertMaterial({ color });
	  const marker = new THREE.Mesh(geom, mat);

	  const childPos = childData.position;
	  const position = new THREE.Vector3(childPos[0], childPos[1], childPos[2]);
	  marker.position.copy(position);
	  marker.name = childName;
	  child = marker;
	}

	// Plane
	else if (childName.includes('Plane')) {
	  const planeGeometry = new THREE.PlaneGeometry(PLANE_WIDTH, PLANE_HEIGHT);
	  const planeMaterial = new THREE.MeshBasicMaterial({
	    color: color,
	    side: THREE.DoubleSide
	  });

	  const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);

	  const childPos = childData.position;
	  const childRot = childData.rotation;
	  planeMesh.position.set(childPos[0], childPos[1], childPos[2]);
	  planeMesh.rotation.set(childRot[0], childRot[1], childRot[2]);
	  planeMesh.name = childName;
	  child = planeMesh;
	}

	break;

      case 'Line2':
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

	const geomLine = new LineGeometry();
	geomLine.setColors([rgbColor.r, rgbColor.g, rgbColor.b]);

	const measLine = new Line2(geomLine, matLine);
	measLine.name = childData.name;
	measLine.scale.set(1,1,1);

	measLine.geometry.setPositions([
	  childData.userData.originX,
	  childData.userData.originY,
	  childData.userData.originZ,
	  childData.userData.endX,
	  childData.userData.endY,
	  childData.userData.endZ,
	]);

	child = measLine;
	break;
      case 'Sprite':
	const canvas = document.createElement('canvas');
        canvas.width = 1024;
	canvas.height = 512;

	const context = canvas.getContext('2d');
	context.font = '18px Arial';
        const text = childData.userData.dist;
	const textMetrics = context.measureText(text);

	const x = (canvas.width - textMetrics.width) / 2;
	const y = (canvas.height + parseInt(context.font)) / 2;

	context.fillText(text, x, y);

	const tex = new THREE.Texture(canvas);
	tex.needsUpdate = true;

	const childPos = childData.position;
	const position = new THREE.Vector3(childPos[0], childPos[1], childPos[2]);

	const spriteMat = new THREE.SpriteMaterial({ map: tex });
	child = new THREE.Sprite(spriteMat);
	child.position.copy(position);
	child.name = childData.name;
	child.dist = childData.userData.dist;

	break;
    }

    return child;
  }

  const handleClear = React.useCallback(() => {
    const group = sceneTree.find_object_no_create([MEASUREMENT_NAME]);

    // Handle transform controls
    const transform_controls = sceneTree.metadata.transform_controls;
    transform_controls.detach();

    // Dispose of child elements
    group.traverse(function (child) {
      if (child instanceof THREE.Mesh) {
	child.geometry.dispose();
	if (Array.isArray(child.material)) {
	  child.material.forEach(function (material) {
	    material.dispose();
	  });
	} else {
	  child.material.dispose();
	}
      }
    });

    // Clear out the group
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

  }, [sceneTree]);

  const handleSave = React.useCallback(() => {
    const groupId = new Date().getTime().toString();
    const filename = `${MEASUREMENT_NAME}-${groupId}`;
    const group = sceneTree.find_object_no_create([MEASUREMENT_NAME]);

    const data = {
      type: 'Group',
      children: []
    };

    // Extract necessary data from each child in the group
    group.children.forEach(child => {
      const childData = {
	type: child.type,
	position: child.position.toArray(),
	rotation: child.rotation.toArray(),
	scale: child.scale.toArray(),
	name: child.name,
	userData: child.userData,
      };
      data.children.push(childData);
    });

    const jsonString = JSON.stringify(data);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const anchorElement = document.createElement('a');
    anchorElement.href = URL.createObjectURL(blob);
    anchorElement.download = filename;
    anchorElement.click();

  }, [sceneTree]);

  const handleLoad = React.useCallback(() => {
    const inputElement = document.createElement('input');
    inputElement.type = 'file';

    inputElement.addEventListener('change', (event) => {
      const file = event.target.files[0];
      const reader = new FileReader();

      reader.addEventListener('load', () => {
	const jsonString = reader.result;
	const data = JSON.parse(jsonString);

	const group = sceneTree.find_object_no_create([MEASUREMENT_NAME]);

	data.children.forEach(childData => {
	  const child = createChildFromData(childData);
	  if (child) { group.add(child); }
	});
      });

      reader.readAsText(file);
    });

    inputElement.click();
  });

  return (
    <div className="MeasPanel">
      <div className="MeasPanel-label">
      </div>
      <LevaPanel
        store={measPropStore}
        className="Leva-panel"
        theme={LevaTheme}
        titleBar={false}
        fill
        flat
      />
      <div className="MeasPanel-props">
        <LevaStoreProvider store={measPropStore}>
          <MeasurementPropPanel />
        </LevaStoreProvider>
      </div>
      <div className="MeasPanel-controls">
        <Button sx={{}} variant="outlined" size="medium" onClick={handleLoad}>
          Load
        </Button>
      </div>
      <div className="MeasPanel-controls">
        <Button sx={{}} variant="outlined" size="medium" onClick={handleSave}>
          Save
        </Button>
      </div>
      <div className="MeasPanel-controls">
        <Button sx={{}} variant="outlined" size="medium" onClick={handleClear}>
          Clear
        </Button>
      </div>
    </div>
  );
}
