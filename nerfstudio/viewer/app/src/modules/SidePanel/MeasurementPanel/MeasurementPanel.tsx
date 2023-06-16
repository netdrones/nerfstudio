import * as React from 'react';

import { LevaPanel, LevaStoreProvider, useCreateStore } from 'leva';
import LevaTheme from '../../../themes/leva_theme.json';
import SceneNode from '../../../SceneNode';
import MeasurementPropPanel from './MeasurementPropPanel';
import { Button } from '@mui/material';
import { useDispatch } from 'react-redux';

interface MeasurementPanelProps {
  sceneTree: SceneNode;
}

const MEASUREMENT_NAME = 'Measurement';

export default function MeasurementPanel(props: MeasurementPanelProps) {
  const sceneTree = props.sceneTree;
  const measPropStore = useCreateStore();
  const dispatch = useDispatch();

  const handleClear = React.useCallback(() => {
    dispatch({
      type: 'write',
      path: 'measState/clear',
      data: true,
    });
  }, [sceneTree]);

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
        <Button sx={{}} variant="outlined" size="medium" onClick={handleClear}>
          Clear
        </Button>
      </div>
    </div>
  );
}
