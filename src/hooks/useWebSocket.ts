import { useCallback, useEffect, useRef, useState } from 'react';
import { WebSocketEventPayload } from '../types/index.ts';

const RECONNECT_DELAY = 3000;

type WebSocketMessage =
  | {
      type: 'SUBSCRIBE_TENANT';
      tenantId: string;
    }
  | {
      type: 'SUBSCRIBE_EXECUTION';
      tenantId?: string;
      executionId: string;
    };

export function useWebSocket(
  tenantId?: string,
  executionId?: string,
) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] =
    useState<WebSocketEventPayload | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isMountedRef = useRef(true);
  const reconnectAttemptRef = useRef(0);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current !== null) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    const ws = wsRef.current;

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.warn('Failed to send WebSocket message:', error);
      return false;
    }
  }, []);

  const subscribe = useCallback(
    (ws: WebSocket) => {
      if (tenantId) {
        ws.send(
          JSON.stringify({
            type: 'SUBSCRIBE_TENANT',
            tenantId,
          }),
        );
      }

      if (executionId) {
        ws.send(
          JSON.stringify({
            type: 'SUBSCRIBE_EXECUTION',
            tenantId,
            executionId,
          }),
        );
      }
    },
    [tenantId, executionId],
  );

  const connect = useCallback(() => {
    if (!isMountedRef.current) {
      return;
    }

    const existingSocket = wsRef.current;

    if (
      existingSocket &&
      (existingSocket.readyState === WebSocket.OPEN ||
        existingSocket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    clearReconnectTimeout();

    try {
      const protocol =
        window.location.protocol === 'https:' ? 'wss:' : 'ws:';

      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);

      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current || wsRef.current !== ws) {
          ws.close();
          return;
        }

        reconnectAttemptRef.current = 0;
        setIsConnected(true);

        try {
          subscribe(ws);
        } catch (error) {
          console.warn('Failed to subscribe to WebSocket channels:', error);
        }
      };

      ws.onmessage = (event: MessageEvent) => {
        if (!isMountedRef.current || wsRef.current !== ws) {
          return;
        }

        try {
          const parsed: WebSocketEventPayload = JSON.parse(event.data);
          setLastEvent(parsed);
        } catch {
          // Ignore non-JSON WebSocket messages such as server greetings.
        }
      };

      ws.onerror = (error) => {
        if (!isMountedRef.current || wsRef.current !== ws) {
          return;
        }

        console.warn('WebSocket error:', error);
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }

        if (!isMountedRef.current) {
          return;
        }

        setIsConnected(false);

        reconnectAttemptRef.current += 1;

        clearReconnectTimeout();

        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connect();
        }, RECONNECT_DELAY);
      };
    } catch (error) {
      console.warn('Failed to establish WebSocket:', error);

      if (!isMountedRef.current) {
        return;
      }

      setIsConnected(false);

      clearReconnectTimeout();

      reconnectAttemptRef.current += 1;

      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;
        connect();
      }, RECONNECT_DELAY);
    }
  }, [clearReconnectTimeout, subscribe]);

  useEffect(() => {
    isMountedRef.current = true;

    connect();

    return () => {
      isMountedRef.current = false;

      clearReconnectTimeout();

      const ws = wsRef.current;
      wsRef.current = null;

      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;

        if (
          ws.readyState === WebSocket.OPEN ||
          ws.readyState === WebSocket.CONNECTING
        ) {
          ws.close();
        }
      }

      setIsConnected(false);
    };
  }, [connect, clearReconnectTimeout]);

  const subscribeExecution = useCallback(
    (execId: string) => {
      if (!execId.trim()) {
        return false;
      }

      return sendMessage({
        type: 'SUBSCRIBE_EXECUTION',
        tenantId,
        executionId: execId,
      });
    },
    [sendMessage, tenantId],
  );

  return {
    isConnected,
    lastEvent,
    subscribeExecution,
  };
}