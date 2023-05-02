import { useControls, useStoreContext } from 'leva';
import { useDispatch, useSelector } from 'react-redux';

export default function MeasurementPropPanel(props) {
  const store = useStoreContext();
  const dispatch = useDispatch();

  // const scaleFactorValue = useSelector((state) => state.measState.scaleFactor);
  const fontSizeValue = useSelector((state) => state.measState.fontSize);
  const colorValue = useSelector((state) => state.measState.color);
  const markerRadiusValue = useSelector(
    (state) => state.measState.markerRadius,
  );
  const lineWidthValue = useSelector((state) => state.measState.lineWidth);
  const unitValue = useSelector((state) => state.measState.unit);

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

  const setUnit = (value) => {
    dispatch({
      type: 'write',
      path: 'measState/unit',
      data: value,
    });
  };

  const [, setControls] = useControls(
    () => ({
      // scaleFactor: {
      //   label: 'Scale',
      //   value: scaleFactorValue,
      //   onChange: (v) => {
      //     setScaleFactor(v);
      //   },
      // },

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

  // setControls({ scaleFactor: scaleFactorValue });
  setControls({ fontSize: fontSizeValue });
  setControls({ color: colorValue });
  setControls({ markerRadius: markerRadiusValue });
  setControls({ lineWidth: lineWidthValue });
  setControls({ unit: unitValue });

  return null;
}
