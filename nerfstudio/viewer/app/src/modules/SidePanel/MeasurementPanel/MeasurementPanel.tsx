import * as React from 'react';

import { LevaPanel, LevaStoreProvider, useCreateStore } from 'leva';
import LevaTheme from '../../../themes/leva_theme.json';
import SceneNode from '../../../SceneNode';
import MeasurementPropPanel from './MeasurementPropPanel';
import { Button } from '@mui/material';
import { useDispatch } from 'react-redux';

const MEASUREMENT_NAME = 'Measurement';

interface MeasurementPanelProps {
  sceneTree: SceneNode;
}

export default function MeasurementPanel(props: MeasurementPanelProps) {
  const sceneTree = props.sceneTree;
  const measPropStore = useCreateStore();
  const dispatch = useDispatch();

  const handleClear = React.useCallback(() => {
    // sceneTree.delete([MEASUREMENT_NAME]);

    // // HACK: Make sure CSS2DObject to be removed from DOM tree
    // for (let elm of document.querySelectorAll('.MeasurementLabel')) {
    //   elm.parentNode.removeChild(elm);
    // }
    dispatch({
      type: 'write',
      path: 'measState/clear',
      data: true,
    });
  }, [sceneTree]);

  return (
    <div className="MeasPanel">
      <div className="MeasPanel-label">
        Press Shift key and click points to start measurement.
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
        <Button sx={{}} variant="outlined" size="medium" onClick={handleClear}>
          Clear
        </Button>
      </div>
    </div>
  );
}
