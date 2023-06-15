import { useControls, useStoreContext } from 'leva';
import { useDispatch, useSelector } from 'react-redux';

export default function MeasurementPropPanel(props) {
  const store = useStoreContext();
  const dispatch = useDispatch();

  const measType = useSelector((state: any) => state.measState.type);
  const fontSizeValue = useSelector((state: any) => state.measState.fontSize);
  const colorValue = useSelector((state: any) => state.measState.color);
  const markerRadiusValue = useSelector(
    (state: any) => state.measState.markerRadius,
  );
  const lineWidthValue = useSelector((state: any) => state.measState.lineWidth);
  const scaleFactorValue = useSelector((state: any) => state.measState.scaleFactor);
  const unitValue = useSelector((state: any) => state.measState.unit);

  const setType = (value) => {
    dispatch({
      type: 'write',
      path: 'measState/type',
      data: value,
    });
  };
  const setFontSize = (value) => {
    dispatch({
      type: 'write',
      path: 'measState/fontSize',
      data: value,
    });
  };

  const setColor = (value) => {
    dispatch({
      type: 'write',
      path: 'measState/color',
      data: value,
    });
  };

  const setMarkerRadius = (value) => {
    dispatch({
      type: 'write',
      path: 'measState/markerRadius',
      data: value,
    });
  };

  const setLineWidth = (value) => {
    dispatch({
      type: 'write',
      path: 'measState/lineWidth',
      data: value,
    });
  };

 const setScaleFactor = (value) => {
    dispatch({
      type: 'write',
      path: 'measState/scaleFactor',
      data: value,
    });
  };

  const setUnit = (value) => {
    dispatch({
      type: 'write',
      path: 'measState/unit',
      data: value,
    });
  };

  const [, setControls] = useControls(
    () => ({
      type: {
        label: 'Dimension',
        value: measType,
        options: {
          '2D': '2d',
          '3D': '3d',
        },
        onChange: (v) => {
          setType(v);
        },
      },
      fontSize: {
        label: 'Font Size',
        value: fontSizeValue,
        onChange: (v) => {
          setFontSize(v);
        },
      },
      color: {
        label: 'Color',
        value: colorValue,
        onChange: (v) => {
          setColor(v);
        },
      },
      markerRadius: {
        label: 'Marker Radius',
        value: markerRadiusValue,
        onChange: (v) => {
          setMarkerRadius(v);
        },
      },
      lineWidth: {
        label: 'Line Width',
        value: lineWidthValue,
        onChange: (v) => {
          setLineWidth(v);
        },
      },
      scale: {
	label: 'Scale Factor',
	value: scaleFactorValue,
	onChange: (v) => {
	  setScaleFactor(v);
	},
      },
      unit: {
        label: 'Unit',
        value: unitValue,
        options: {
          Metric: 'metric',
          Imerial: 'imperial',
        },
        onChange: (v) => {
          setUnit(v);
        },
      },
    }),
    { store },
  );

  setControls({ fontSize: fontSizeValue });
  setControls({ color: colorValue });
  setControls({ markerRadius: markerRadiusValue });
  setControls({ lineWidth: lineWidthValue });
  setControls({ unit: unitValue });

  return null;
}
