import { useEffect, useRef, useState, useCallback } from 'react';
import { WebSocketEventPayload } from '../types/index.ts';

export function useWebSocket(tenantId?: string, executionId?: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WebSocketEventPayload | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  const connect = useCallback(() => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        if (tenantId) {
          ws.send(JSON.stringify({
            type: 'SUBSCRIBE_TENANT',
            tenantId,
          }));
        }
        if (executionId) {
          ws.send(JSON.stringify({
            type: 'SUBSCRIBE_EXECUTION',
            tenantId,
            executionId,
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const parsed: WebSocketEventPayload = JSON.parse(event.data);
          setLastEvent(parsed);
        } catch (err) {
          // ignore non-json greeting
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Attempt reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.warn('WebSocket error:', err);
        ws.close();
      };
    } catch (err) {
      console.warn('Failed to establish WebSocket:', err);
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    }
  }, [tenantId, executionId]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Subscribe to specific execution ID dynamically
  const subscribeExecution = useCallback((execId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'SUBSCRIBE_EXECUTION',
        tenantId,
        executionId: execId,
      }));
    }
  }, [tenantId]);

  return { isConnected, lastEvent, subscribeExecution };
}
