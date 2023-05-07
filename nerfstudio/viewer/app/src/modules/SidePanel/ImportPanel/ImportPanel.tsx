import * as React from 'react';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader';
import { Button, FormControl, Tabs, Tab, Box, Typography } from '@mui/material';
import CategoryIcon from '@mui/icons-material/Category';

const IMPORTED_OBJECT_NAME = 'Import';

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

interface TabPanelProps {
  children: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          <Typography component="div">{children}</Typography>
        </Box>
      )}
    </div>
  );
}

export default function ImportPanel(props) {
  const sceneTree = props.sceneTree;
  const [reload, setReload] = React.useState(0);

  const [subPanelType, setSubPanelType] = React.useState(0);

  const handleTypeChange = (event: React.SyntheticEvent, newValue: number) => {
    setSubPanelType(newValue);
  };

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
            sceneTree.set_object_from_path(
              [IMPORTED_OBJECT_NAME, mesh.name],
              mesh,
            );
          } else if (file.name.match(/.*\.ply$/gi)) {
            const plyLoader = new PLYLoader();
            const geom = plyLoader.parse(blob);
            console.log(geom);
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
                  model.updateMatrixWorld();
                  model.position.set(0, 0, 2.5);
                  model.scale.set(6, 6, 6);

                  model.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                      child.material.map = texture;
                    }
                  });

                  sceneTree.set_object_from_path(
                    [IMPORTED_OBJECT_NAME, model.name],
                    model,
                  );
                });
              },
              (evt) => {
                console.log(
                  `@@ mtl loader progress ${evt.loaded} / ${evt.total}`,
                );
              },
              (err) => {
                console.error('@@ material loader failed', err);
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
            sceneTree.set_object_from_path([IMPORTED_OBJECT_NAME, name], mesh);
            setReload((p) => p + 1);
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

  return (
    <div className="ImportPanel">
      <Tabs
        value={subPanelType}
        onChange={handleTypeChange}
        aria-label="import type"
        variant="fullWidth"
        centered
        sx={{ height: 35, minHeight: 55 }}
      >
        <Tab
          icon={<CategoryIcon />}
          iconPosition="start"
          label="Mesh"
          disableRipple
          {...a11yProps(0)}
        />
        <Tab
          icon={<CategoryIcon />}
          iconPosition="start"
          label="Custom"
          disableRipple
          {...a11yProps(1)}
        />
      </Tabs>
      <TabPanel value={subPanelType} index={0}></TabPanel>
      <TabPanel value={subPanelType} index={1}></TabPanel>

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
            accept=".obj, .stl, .fbx, .ply"
            onChange={handleFileImport}
            hidden
          />
        </FormControl>
      </div>
    </div>
  );
}
