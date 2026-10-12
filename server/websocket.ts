import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { WebSocketEventPayload } from '../src/types/index.ts';

interface ClientConnection {
  ws: WebSocket;
  tenantId?: string;
  executionId?: string;
  isAlive: boolean;
}

class OrchestrationWebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients = new Set<ClientConnection>();

  public initialize(server: HttpServer) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket) => {
      const client: ClientConnection = {
        ws,
        isAlive: true,
      };
      this.clients.add(client);

      ws.on('pong', () => {
        client.isAlive = true;
      });

      ws.on('message', (message: string) => {
        try {
          const parsed = JSON.parse(message.toString());
          if (parsed.type === 'SUBSCRIBE_TENANT') {
            client.tenantId = parsed.tenantId;
          } else if (parsed.type === 'SUBSCRIBE_EXECUTION') {
            client.executionId = parsed.executionId;
            client.tenantId = parsed.tenantId;
          } else if (parsed.type === 'UNSUBSCRIBE') {
            client.executionId = undefined;
          }
        } catch (err) {
          console.error('Error parsing WS client message:', err);
        }
      });

      ws.on('close', () => {
        this.clients.delete(client);
      });

      ws.on('error', () => {
        this.clients.delete(client);
      });

      // Send initial connect greeting
      ws.send(JSON.stringify({
        type: 'CONNECTED',
        message: 'Connected to Workflow & Saga Orchestration Engine WebSocket',
        timestamp: new Date().toISOString(),
      }));
    });

    // Heartbeat ping interval
    const interval = setInterval(() => {
      this.clients.forEach(client => {
        if (!client.isAlive) {
          client.ws.terminate();
          this.clients.delete(client);
          return;
        }
        client.isAlive = false;
        client.ws.ping();
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(interval);
    });

    console.log('⚡ WebSocket server attached to HTTP server at /ws');
  }

  public broadcast(event: WebSocketEventPayload) {
    const serialized = JSON.stringify(event);

    this.clients.forEach(client => {
      if (client.ws.readyState === WebSocket.OPEN) {
        // Broadcast if matching tenant, or if subscriber is super admin/unfiltered, or if execution matches
        const matchesTenant = !client.tenantId || client.tenantId === event.tenantId || client.tenantId === 'SUPER_ADMIN';
        const matchesExecution = !client.executionId || client.executionId === event.executionId;

        if (matchesTenant && matchesExecution) {
          try {
            client.ws.send(serialized);
          } catch (err) {
            console.error('WS broadcast send error:', err);
          }
        }
      }
    });
  }
}

export const wsManager = new OrchestrationWebSocketManager();
