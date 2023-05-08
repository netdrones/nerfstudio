import * as React from 'react';
import * as THREE from 'three';
import {
  Collapse,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
} from '@mui/material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import SceneNode from '../../../SceneNode';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls';

function isMouseInScene(evt: MouseEvent, canvas: HTMLCanvasElement): boolean {
  return (
    evt.clientX >= canvas.offsetLeft &&
    evt.clientX <= canvas.offsetLeft + canvas.clientWidth &&
    evt.clientY >= canvas.offsetTop &&
    evt.clientY <= canvas.offsetTop + canvas.height
  );
}

const USER_SCENE_NAME = 'User Scene';

interface InspectorProps {
  sceneTree: SceneNode;
}

export default function Inspector(props: InspectorProps) {
  const sceneTree = props.sceneTree;
  const renderer: THREE.WebGLRenderer = (sceneTree.metadata as any).renderer;
  const canvas = renderer.domElement;

  const raycaster = new THREE.Raycaster();

  const [open, setOpen] = React.useState(1);
  const [object, setObject] = React.useState<THREE.Object3D | null>();

  const [posVec, setPositionVec] = React.useState<THREE.Vector3>();
  const [rotVec, setRotationVec] = React.useState<THREE.Vector3>();
  const [scaleVec, setScaleVec] = React.useState<THREE.Vector3>();

  const mainCamera: THREE.PerspectiveCamera = sceneTree.find_object_no_create([
    'Cameras',
    'Main Camera',
  ]);

  const transformControls: TransformControls = sceneTree.find_object_no_create([
    'Transform Controls',
  ]);

  const updateProps = (object: THREE.Object3D) => {
    setPositionVec(object.position);
    setRotationVec(
      new THREE.Vector3(
        (object.rotation.x * 180) / Math.PI,
        (object.rotation.y * 180) / Math.PI,
        (object.rotation.z * 180) / Math.PI,
      ),
    );
    setScaleVec(object.scale);
  };

  transformControls.addEventListener('change', (evt) => {
    updateProps(evt.target.object);
  });

  const selectObject = (object: THREE.Object3D | null) => {
    if (object === null) {
      transformControls.detach();
      setObject(null);
    } else if (!!object) {
      transformControls.attach(object);
      setObject(object);
      updateProps(object);
    }
  };

  const onChangeValue = React.useCallback(
    (evt: React.ChangeEvent<HTMLInputElement>) => {
      if (!object) return;

      const value = parseFloat(evt.target.value);
      const position = object.position;
      const rotation = object.rotation;
      const scale = object.scale;
      switch (evt.target.id) {
        case 'pos-x':
          position.x = value;
          break;
        case 'pos-y':
          position.y = value;
          break;
        case 'pos-z':
          position.z = value;
          break;
        case 'rot-x':
          rotation.x = (value * Math.PI) / 180;
          break;
        case 'rot-y':
          rotation.y = (value * Math.PI) / 180;
          break;
        case 'rot-z':
          rotation.z = (value * Math.PI) / 180;
          break;
        case 'scale-x':
          scale.x = value;
          break;
        case 'scale-y':
          scale.y = value;
          break;
        case 'scale-z':
          scale.z = value;
          break;
      }
      object.position.set(position.x, position.y, position.z);
      object.rotation.set(rotation.x, rotation.y, rotation.z);
      object.scale.set(scale.x, scale.y, scale.z);
      updateProps(object);
    },
    [object],
  );

  const toggleOpen = React.useCallback(
    (idx: number) => {
      setOpen(open ^ (1 << idx));
    },
    [open],
  );

  const onMouseDown = React.useCallback(
    (evt: MouseEvent) => {
      const canvas: HTMLCanvasElement = (sceneTree.metadata as any).renderer
        .domElement;
      const pointerVec = new THREE.Vector2();
      pointerVec.x = (evt.clientX / canvas.offsetWidth) * 2 - 1;
      pointerVec.y = (-evt.clientY / canvas.offsetHeight) * 2 + 1;

      raycaster.setFromCamera(pointerVec, mainCamera);
      const scene = sceneTree.find_no_create([USER_SCENE_NAME]).object;
      const intersects = raycaster.intersectObjects(scene.children, true);
      if (intersects.length > 0) {
        const intersect = intersects[0];
        selectObject(intersect.object);
      } else {
        selectObject(null);
      }
    },
    [sceneTree, mainCamera],
  );

  React.useEffect(() => {
    canvas.addEventListener('mousedown', onMouseDown, false);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
    };
  }, []);

  return (
    <>
      <Divider />
      <ListItem dense>
        <ListItemButton onClick={() => toggleOpen(0)} sx={{ padding: 0 }}>
          <ListItemIcon sx={{ color: 'white' }}>
            {(open & 1) > 0 ? <ExpandMore /> : <ExpandLess />}
          </ListItemIcon>
          <ListItemText
            primary="Transform"
            primaryTypographyProps={{ fontWeight: '600' }}
          />
        </ListItemButton>
      </ListItem>
      <Divider />
      <Collapse in={(open & 1) > 0} timeout="auto">
        <List>
          <ListItem>
            <ListItemText
              secondary="Position"
              secondaryTypographyProps={{ color: 'white' }}
            />
            <Stack direction="row" spacing={1}>
              <TextField
                id="pos-x"
                label="x"
                value={posVec?.x || '0'}
                size="small"
                type="number"
                sx={{ width: '90px' }}
                onChange={onChangeValue}
              />
              <TextField
                id="pos-y"
                label="y"
                value={posVec?.y || '0'}
                size="small"
                type="number"
                margin="dense"
                sx={{ width: '90px' }}
                onChange={onChangeValue}
              />
              <TextField
                id="pos-z"
                label="z"
                value={posVec?.z || '0'}
                size="small"
                type="number"
                margin="dense"
                sx={{ width: '90px' }}
                onChange={onChangeValue}
              />
            </Stack>
          </ListItem>
          <ListItem>
            <ListItemText
              secondary="Rotation"
              secondaryTypographyProps={{ color: 'white' }}
            />
            <Stack direction="row" spacing={1}>
              <TextField
                id="rot-x"
                label="x"
                value={rotVec?.x || '0'}
                size="small"
                type="number"
                sx={{ width: '90px' }}
                onChange={onChangeValue}
              />
              <TextField
                id="rot-y"
                label="y"
                value={rotVec?.y || '0'}
                size="small"
                type="number"
                sx={{ width: '90px' }}
                onChange={onChangeValue}
              />
              <TextField
                id="rot-z"
                label="z"
                value={rotVec?.z || '0'}
                size="small"
                type="number"
                sx={{ width: '90px' }}
                onChange={onChangeValue}
              />
            </Stack>
          </ListItem>
          <ListItem>
            <ListItemText
              secondary="Scale"
              secondaryTypographyProps={{ color: 'white' }}
            />
            <Stack direction="row" spacing={1}>
              <TextField
                id="scale-x"
                label="x"
                value={scaleVec?.x || '0'}
                size="small"
                type="number"
                sx={{ width: '90px' }}
                onChange={onChangeValue}
              />
              <TextField
                id="scale-y"
                label="y"
                value={scaleVec?.y || '0'}
                size="small"
                type="number"
                sx={{ width: '90px' }}
                onChange={onChangeValue}
              />
              <TextField
                id="scale-z"
                label="z"
                value={scaleVec?.z || '0'}
                size="small"
                type="number"
                sx={{ width: '90px' }}
                onChange={onChangeValue}
              />
            </Stack>
          </ListItem>
        </List>
      </Collapse>
    </>
  );
}
