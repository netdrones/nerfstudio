import * as React from 'react';
import * as THREE from 'three';
import SceneNode from '../../SceneNode';
import { useSelector } from 'react-redux';
import {
  ViserWebSocketContext,
  sendWebsocketMessage,
} from '../WebSocket/ViserWebSocket';
import { PointerEvent } from 'react';

interface MeasureTool2DProps {
  sceneTree: SceneNode;
}

export default function MeasureTool2D(props: MeasureTool2DProps) {
  const sceneTree = props.sceneTree;
  const renderer = (sceneTree.metadata as any).renderer as THREE.WebGLRenderer;
  const viser_websocket = React.useContext(ViserWebSocketContext);
  const camera_controls = sceneTree.metadata.camera_controls;
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const [referencePoints, setReferencePoints] = React.useState<number[][]>([]);
  const [isMeasuring, setMeasuring] = React.useState(false);

  const measEnabled = useSelector((state: any) => state.measState.enabled);
  const color = useSelector((state: any) => state.measState.color);

  const handlePointerDown = React.useCallback(
    (evt: PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current!!;
      const canvasPos = canvas.getBoundingClientRect();
      const x = evt.clientX - canvasPos.left;
      const y = evt.clientY - canvasPos.top;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();

        referencePoints.push([x, y]);
        setReferencePoints(referencePoints);

        sendWebsocketMessage(viser_websocket, {
          type: 'MeasurementStart',
          x,
          y,
        });
      }
      if (isMeasuring) {
        setMeasuring(false);
      } else {
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

        const ctx = canvas.getContext('2d');
        if (ctx) {
          const point = referencePoints[referencePoints.length - 1];
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          ctx.beginPath();
          ctx.arc(point[0], point[1], 4, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();

          ctx.beginPath();
          ctx.setLineDash([5, 15]);
          ctx.moveTo(point[0], point[1]);
          ctx.lineTo(x, y);
          ctx.strokeStyle = color;
          ctx.stroke();

          referencePoints.push([point[0], point[1]]);
          setReferencePoints(referencePoints);
        }

        sendWebsocketMessage(viser_websocket, {
          type: 'MeasurementEnd',
          x,
          y,
        });
      }
    },
    [canvasRef, isMeasuring, color, referencePoints],
  );

  React.useEffect(() => {
    if (measEnabled) {
      camera_controls.enabled = false;
    } else {
      camera_controls.enabled = true;
    }
  }, [measEnabled, camera_controls]);

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
          width={renderer.domElement.width}
          height={renderer.domElement.height}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
        />
      )}
    </>
  );
}
