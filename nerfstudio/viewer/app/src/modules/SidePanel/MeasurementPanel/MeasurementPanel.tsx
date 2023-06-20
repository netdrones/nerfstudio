import * as THREE from 'three';
import * as React from 'react';

import { LevaPanel, LevaStoreProvider, useCreateStore } from 'leva';
import { Button } from '@mui/material';
import { useDispatch } from 'react-redux';

import LevaTheme from '../../../themes/leva_theme.json';
import SceneNode from '../../../SceneNode';
import MeasurementPropPanel from './MeasurementPropPanel';

interface MeasurementPanelProps {
  sceneTree: SceneNode;
}

const MEASUREMENT_NAME = 'Measurement';

export default function MeasurementPanel(props: MeasurementPanelProps) {
  const sceneTree = props.sceneTree;
  const measPropStore = useCreateStore();
  const dispatch = useDispatch();

  function createChildFromData(childData) {
    const { type, position, rotation, scale } = childData;
    let child;

    switch (type) {
      case 'Mesh':
	child = new THREE.Mesh();
	break;
      case 'Line':
	child = new THREE.Line();
	break;
      case 'Sprite':
	child = new THREE.Sprite();
	break;
      // Add cases for other child types as needed
      default:
	throw new Error(`Unsupported child type: ${type}`);
    }

    child.position.fromArray(position);
    child.rotation.fromArray(rotation);
    child.scale.fromArray(scale);

    // Set any other necessary properties of the child object

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

	const group = new THREE.Group();

	data.children.forEach(childData => {
	  // const child = createChildFromData(childData);
	  // group.add(child);
	});

	// onLoad(group);
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
