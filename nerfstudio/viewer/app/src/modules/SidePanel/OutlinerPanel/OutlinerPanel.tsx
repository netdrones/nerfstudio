import * as React from 'react';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader';
import {
  Button,
  FormControl,
  Tabs,
  Tab,
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Collapse,
  Divider,
  Tooltip,
} from '@mui/material';
import LevaTheme from '../../../themes/leva_theme.json';
import {
  ExpandLess,
  ExpandMore,
  FolderRounded,
  Visibility,
  VisibilityOff,
  AddRounded,
} from '@mui/icons-material';
import SceneNode from '../../../SceneNode';
import Inspector from './Inspector';

interface TabPanelProps {
  children: React.ReactNode;
  index: number;
  value: number;
}

interface MenuItemProps {
  name: String;
  sceneTree: SceneNode;
  sceneNode: SceneNode;
  level: number;
  groupVisible: boolean;
  time: number;
}

const USER_SECENE_NAME = 'User Scene';

function MenuItems(props: MenuItemProps) {
  const name = props.name;
  const level = props.level;
  const sceneTree = props.sceneTree;
  const sceneNode = props.sceneNode;

  const [open, setOpen] = React.useState(true);
  const [visible, setVisible] = React.useState(true);

  if (!sceneTree) {
    return null;
  }

  const terminal = Object.keys(sceneTree.children).includes('<object>');

  const numChildren = Object.keys(sceneNode.children).length;
  if (numChildren === 0) {
    return null;
  }

  const toggleOpen = React.useCallback(
    (evt: React.MouseEvent) => {
      evt.preventDefault();
      evt.stopPropagation();

      setOpen(!open);
    },
    [open],
  );

  const toggleVisible = React.useCallback(
    (evt: React.MouseEvent) => {
      evt.stopPropagation();

      setVisible(!visible);
    },
    [visible, sceneNode],
  );

  return (
    <>
      <ListItemButton
        onClick={terminal ? undefined : toggleOpen}
        dense
        sx={
          terminal
            ? {
                pl: 2 + level * 2,
                color: visible
                  ? LevaTheme.colors.accent2
                  : LevaTheme.colors.disabled,
              }
            : {
                pl: 2 + level * 2,
                bgcolor: open
                  ? LevaTheme.colors.elevation3
                  : LevaTheme.colors.elevation1,
                color: visible
                  ? LevaTheme.colors.accent2
                  : LevaTheme.colors.disabled,
              }
        }
      >
        <ListItemIcon
          sx={{
            color: visible ? 'white' : LevaTheme.colors.disabled,
          }}
        >
          <FolderRounded />
        </ListItemIcon>
        <ListItemText
          primary={name}
          sx={{
            color: visible ? 'white' : LevaTheme.colors.disabled,
          }}
        />
        <IconButton aria-label="visibility" onClick={toggleVisible}>
          {visible ? <Visibility /> : <VisibilityOff />}
        </IconButton>
        {terminal
          ? null
          : (() => {
              if (open) {
                return <ExpandLess />;
              }
              return <ExpandMore />;
            })()}
      </ListItemButton>
      {terminal ? null : (
        <Collapse in={open} timeout="auto">
          <List>
            {Object.keys(sceneNode.children)
              .filter(
                (key) =>
                  key === USER_SECENE_NAME ||
                  sceneNode.object.name === USER_SECENE_NAME,
              )
              .map((key) => (
                <MenuItems
                  name={key}
                  key={key}
                  sceneTree={sceneTree}
                  sceneNode={sceneNode.children[key]}
                  time={props.time}
                  level={props.level + 1}
                  groupVisible={visible}
                />
              ))}
          </List>
        </Collapse>
      )}
    </>
  );
}

interface SceneNavigatorProps {
  sceneTree: SceneNode;
}

function SceneNavigator(props: SceneNavigatorProps) {
  const sceneTree = props.sceneTree;

  const [time, refresh] = React.useState(0);
  const [open, setOpen] = React.useState(true);

  const toggleOpen = React.useCallback(() => {
    setOpen(!open);
  }, [open]);

  const handleFileImport = React.useCallback(
    (event) => {
      event.stopPropagation();
      event.preventDefault();

      for (let file of event.target.files) {
        const reader = new FileReader();
        reader.addEventListener('loadend', (evt) => {
          const blob = reader.result;
          if (!blob) return;

          if (file.name.match(/.*\.fbx$/gi)) {
            const loader = new FBXLoader();
            const geom = loader.parse(blob);
            const mat = new THREE.MeshPhongMaterial({ color: '#407796' });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.name = file.name;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            sceneTree.set_object_from_path([USER_SECENE_NAME, mesh.name], mesh);
          } else if (file.name.match(/.*\.ply$/gi)) {
            const plyLoader = new PLYLoader();
            const geom = plyLoader.parse(blob);
            console.log(geom);
            const mat = new THREE.MeshPhongMaterial({ color: '#407796' });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.name = file.name;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            sceneTree.set_object_from_path([USER_SECENE_NAME, mesh.name], mesh);
          } else if (file.name.match(/.*\.obj$/gi)) {
            const texLoader = new THREE.TextureLoader();
            const texture = texLoader.load('/mesh/material_0.png');
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.magFilter = THREE.NearestFilter;
            texture.needsUpdate = true;

            const mtlLoader = new MTLLoader();
            mtlLoader.setResourcePath('/mesh');
            mtlLoader.load(
              'material_0.mtl',
              (mtl) => {
                mtl.preload();
                mtl.loadTexture('/mesh/material_0.png');
                for (const material of Object.values(mtl.materials)) {
                  material.side = THREE.DoubleSide;
                }

                const objLoader = new OBJLoader();
                objLoader.setMaterials(mtl);
                objLoader.load('mesh/mesh.obj', (model) => {
                  model.name = 'NeRF';
                  model.updateMatrixWorld();
                  // model.position.set(0, 0, 2.5);
                  // model.scale.set(6, 6, 6);

                  model.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                      child.material.map = texture;
                    }
                  });

                  sceneTree.set_object_from_path(
                    [USER_SECENE_NAME, model.name],
                    model,
                  );
                });
              },
              (err) => {
                console.error('material loader failed', err);
              },
            );

            // const geom = loader.parse(blob);
            // const mat = new THREE.MeshPhongMaterial({ color: '#407796' });
            // const mesh = new THREE.Mesh(geom, mat);
            // mesh.name = file.name;
            // mesh.castShadow = true;
            // mesh.receiveShadow = true;
            // sceneTree.set_object_from_path(
            //   [IMPORTED_OBJECT_NAME, mesh.name],
            //   mesh,
            // );
          } else if (file.name.match(/.*\.stl/gi)) {
            const loader = new STLLoader();
            const geom = loader.parse(blob);
            const mat = new THREE.MeshPhongMaterial({
              color: '#407796',
            });
            const mesh = new THREE.Mesh(geom, mat);
            const name = file.name.replace(/.stl/i, '');
            mesh.name = name;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            sceneTree.set_object_from_path([USER_SECENE_NAME, name], mesh);
          }
        });
        reader.readAsBinaryString(file);
      }
    },
    [sceneTree],
  );

  const importFileRef = React.createRef<HTMLInputElement>();
  const onClickImportFile = React.useCallback(() => {
    importFileRef.current?.click();
  }, [importFileRef]);

  React.useEffect(() => {
    const reloadInterval = setInterval(() => {
      refresh(new Date().getTime());
    }, 1000);
    return () => {
      clearInterval(reloadInterval);
    };
  }, []);

  return (
    <>
      <ListItem dense>
        <ListItemButton onClick={toggleOpen} dense sx={{ padding: 0 }}>
          <ListItemIcon sx={{ color: 'white' }}>
            {open ? <ExpandMore /> : <ExpandLess />}
          </ListItemIcon>
          <ListItemText
            primary="Navigator"
            primaryTypographyProps={{ fontWeight: '600' }}
          />
        </ListItemButton>
        <Tooltip title="Import 3D model">
          <ListItemIcon
            sx={{ color: 'white', cursor: 'pointer' }}
            onClick={onClickImportFile}
          >
            <AddRounded />
          </ListItemIcon>
        </Tooltip>
        <input
          ref={importFileRef}
          type="file"
          name="3D Model File"
          accept=".obj, .stl, .fbx, .ply"
          onChange={handleFileImport}
          hidden
        />
      </ListItem>
      <Collapse in={open} timeout="auto">
        <MenuItems
          name="Scene"
          sceneTree={sceneTree}
          sceneNode={sceneTree}
          time={time}
          level={0}
          groupVisible
        />
      </Collapse>
    </>
  );
}

interface OutlinerPanelProps {
  sceneTree: SceneNode;
}

export default function OutlinerPanel(props: OutlinerPanelProps) {
  const sceneTree = props.sceneTree;

  return (
    <div className="OutlinerPanel">
      <List dense sx={{ color: 'white' }}>
        <SceneNavigator sceneTree={sceneTree} />
        <Inspector sceneTree={sceneTree} />
      </List>

      <div className="OutlinerPanel-props"></div>
    </div>
  );
}
