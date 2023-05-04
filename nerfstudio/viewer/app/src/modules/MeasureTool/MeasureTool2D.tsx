import * as React from 'react';
import * as THREE from 'three';
import SceneNode from '../../SceneNode';
import { useDispatch, useSelector } from 'react-redux';
import {
  ViserWebSocketContext,
  sendWebsocketMessage,
} from '../WebSocket/ViserWebSocket';
import { PointerEvent } from 'react';
import CameraControls from 'camera-controls';

interface MeasureTool2DProps {
  sceneTree: SceneNode;
}

const _MEAS_MARKER_RADIUS = 4;
const _MEAS_LINE_WIDTH = 4;

export default function MeasureTool2D(props: MeasureTool2DProps) {
  const sceneTree = props.sceneTree;
  const renderer = (sceneTree.metadata as any).renderer as THREE.WebGLRenderer;
  const viser_websocket = React.useContext(ViserWebSocketContext);
  const camera_controls = sceneTree.metadata.camera_controls as CameraControls;
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const dispatch = useDispatch();

  const [referencePoints, setReferencePoints] = React.useState<THREE.Vector2[]>(
    [],
  );
  const [isMeasuring, setMeasuring] = React.useState(false);

  const measEnabled = useSelector((state: any) => state.measState.enabled);
  const fontSize = useSelector((state: any) => state.measState.fontSize);
  const color = useSelector((state: any) => state.measState.color);
  const doClear = useSelector((state: any) => state.measState.clear);

  const drawMeasures = React.useCallback(
    (points: THREE.Vector2[]) => {
      const canvas = canvasRef.current!!;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        points.forEach((point, idx) => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, _MEAS_MARKER_RADIUS, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.closePath();

          ctx.beginPath();
          ctx.font = `${fontSize} sans-serif`;
          ctx.fillStyle = color;
          ctx.fillText(
            `(${point.x.toFixed(0)}, ${point.y.toFixed(0)})`,
            point.x - 35,
            point.y - 10,
          );
          ctx.closePath();

          if (idx % 2 == 0 && idx < points.length - 1) {
            const nextPoint = points[idx + 1];
            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([5, 15]);
            ctx.moveTo(point.x, point.y);
            ctx.lineTo(nextPoint.x, nextPoint.y);
            ctx.lineWidth = _MEAS_LINE_WIDTH;
            ctx.strokeStyle = color;
            ctx.stroke();
            ctx.restore();

            const d = point.distanceTo(nextPoint);
            const centerX = (point.x + nextPoint.x) / 2;
            const centerY = (point.y + nextPoint.y) / 2;
            const angle = Math.atan2(
              nextPoint.y - point.y,
              nextPoint.x - point.x,
            );
            ctx.save();
            ctx.font = `${fontSize} sans-serif`;
            ctx.fillStyle = color;
            ctx.translate(centerX, centerY);
            ctx.rotate(angle);
            ctx.fillText(`${d.toFixed(0)}`, 0, 0);
            ctx.restore();
          }
        });
      }
    },
    [canvasRef, fontSize, color],
  );

  const handlePointerDown = React.useCallback(
    (evt: PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current!!;
      const canvasPos = canvas.getBoundingClientRect();
      const x = evt.clientX - canvasPos.left;
      const y = evt.clientY - canvasPos.top;

      // sendWebsocketMessage(viser_websocket, {
      //   type: 'MeasurementStart',
      //   x,
      //   y,
      // });

      if (isMeasuring) {
        setMeasuring(false);
      } else {
        referencePoints.push(new THREE.Vector2(x, y));
        setReferencePoints(referencePoints);
        drawMeasures(referencePoints);

        setMeasuring(true);
      }
    },
    [canvasRef, color, isMeasuring, referencePoints],
  );

  const handlePointerMove = React.useCallback(
    (evt: PointerEvent<HTMLCanvasElement>) => {
      if (isMeasuring) {
        const canvas = canvasRef.current!!;
        const canvasPos = canvas.getBoundingClientRect();
        const x = evt.clientX - canvasPos.left;
        const y = evt.clientY - canvasPos.top;

        const point = new THREE.Vector2(x, y);
        if (referencePoints.length % 2 == 0) {
          referencePoints[referencePoints.length - 1] = point;
        } else {
          referencePoints.push(point);
        }
        drawMeasures(referencePoints);
        setReferencePoints(referencePoints);
      }
    },
    [canvasRef, isMeasuring, referencePoints],
  );

  React.useEffect(() => {
    if (measEnabled) {
      camera_controls.enabled = false;
      drawMeasures(referencePoints);
    } else {
      camera_controls.enabled = true;
    }
  }, [measEnabled, camera_controls, referencePoints]);

  React.useEffect(() => {
    if (doClear) {
      const canvas = canvasRef.current!!;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        setReferencePoints([]);

        dispatch({
          type: 'write',
          path: 'measState/clear',
          data: false,
        });
      }
    }
  }, [doClear, canvasRef]);

  return (
    <>
      {(measEnabled || isMeasuring) && (
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 9999,
            background: 'transparent',
            cursor: 'crosshair',
          }}
          width={renderer.domElement.offsetWidth}
          height={renderer.domElement.offsetHeight}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
        />
      )}
    </>
  );
}
