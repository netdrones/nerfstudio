import * as React from 'react';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import {
  Button,
  FormControl,
  List,
  ListItemText,
  ListItemButton,
  ListItemIcon,
} from '@mui/material';
import SceneNode from '../../../SceneNode';

interface OutlinerProps {
  sceneTree: SceneNode;
}

function Outliner(props: OutlinerProps) {
  const scene = props.sceneTree.object;
  const children = scene.children;

  return (
    <div className="Outliner">
      <List>
        {scene.children
          .filter((obj) => obj.name.indexOf('[USER]') > -1)
          .map((child, index) => (
            <ListItemButton key={index}>
              <ListItemIcon>
                <FolderRoundedIcon />
              </ListItemIcon>
              <ListItemText primary={child.name.replace('[USER]', '')} />
            </ListItemButton>
          ))}
      </List>
    </div>
  );
}

const IMPORTED_OBJECT_NAME = 'Import';

export default function ImportPanel(props) {
  const sceneTree = props.sceneTree;
  const [reload, setReload] = React.useState(0);

  const handleFileImport = React.useCallback(
    (event) => {
      event.stopPropagation();
      event.preventDefault();

      for (let file of event.target.files) {
        const reader = new FileReader();
        reader.addEventListener('loadend', (evt) => {
          const blob = reader.result;
          if (file.name.match(/.*\.fbx$/gi)) {
            const loader = new FBXLoader();
            const geom = loader.parse(blob);
            const mat = new THREE.MeshPhongMaterial({ color: '#407796' });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.name = file.name;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            sceneTree.set_object_from_path(
              [IMPORTED_OBJECT_NAME, mesh.name],
              mesh,
            );
          } else if (file.name.match(/.*\.obj$/gi)) {
            const loader = new OBJLoader();
            const geom = loader.parse(blob);
            const mat = new THREE.MeshPhongMaterial({ color: '#407796' });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.name = file.name;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            sceneTree.set_object_from_path(
              [IMPORTED_OBJECT_NAME, mesh.name],
              mesh,
            );
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
            sceneTree.set_object_from_path([IMPORTED_OBJECT_NAME, name], mesh);
            setReload((p) => p + 1);
          }
        });
        reader.readAsBinaryString(file);
      }
    },
    [sceneTree],
  );

  const importFileRef = React.createRef();
  const onClickImportFile = React.useCallback(() => {
    importFileRef.current.click();
  });

  return (
    <div className="ImportPanel">
      <div className="ImportPanel-props">
        <FormControl>
          <Button
            sx={{}}
            variant="outlined"
            size="medium"
            onClick={onClickImportFile}
          >
            Import 3D Model
          </Button>
          <input
            ref={importFileRef}
            type="file"
            name="3D Model File"
            accept=".obj, .stl, .fbx"
            onChange={handleFileImport}
            hidden
          />
        </FormControl>
        {Boolean(reload) && <Outliner sceneTree={sceneTree} />}
      </div>
    </div>
  );
}
