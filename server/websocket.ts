
import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { WebSocketEventPayload } from '../src/types/index.ts';

interface ClientConnection {
  ws: WebSocket;
  tenantId?: string;
  executionId?: string;
  isAlive: boolean;
}

type ClientMessage =
  | {
      type: 'SUBSCRIBE_TENANT';
      tenantId: string;
    }
  | {
      type: 'SUBSCRIBE_EXECUTION';
      tenantId: string;
      executionId: string;
    }
  | {
      type: 'UNSUBSCRIBE';
    };

const HEARTBEAT_INTERVAL = 30_000;
const SUPER_ADMIN_TENANT = 'SUPER_ADMIN';

class OrchestrationWebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients = new Set<ClientConnection>();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Initialize the WebSocket server.
   * Attaches the WebSocket endpoint to the existing HTTP server.
   */
  public initialize(server: HttpServer): void {
    if (this.wss) {
      console.warn('WebSocket server is already initialized.');
      return;
    }

    const wss = new WebSocketServer({
      server,
      path: '/ws',
    });

    this.wss = wss;

    wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws);
    });

    wss.on('error', (error: Error) => {
      console.error('WebSocket server error:', error);
    });

    wss.on('close', () => {
      this.stopHeartbeat();
      this.clients.clear();
      this.wss = null;
    });

    this.startHeartbeat();

    console.log('⚡ WebSocket server attached to HTTP server at /ws');
  }

  /**
   * Register and manage a new client connection.
   */
  private handleConnection(ws: WebSocket): void {
    const client: ClientConnection = {
      ws,
      isAlive: true,
    };

    this.clients.add(client);

    ws.on('pong', () => {
      client.isAlive = true;
    });

    ws.on('message', (data) => {
      this.handleClientMessage(client, data.toString());
    });

    ws.on('close', () => {
      this.removeClient(client);
    });

    ws.on('error', (error: Error) => {
      console.error('WebSocket client error:', error.message);
      this.removeClient(client);
    });

    this.sendToClient(client, {
      type: 'CONNECTED',
      message: 'Connected to Workflow & Saga Orchestration Engine WebSocket',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Validate and process incoming client subscription messages.
   */
  private handleClientMessage(
    client: ClientConnection,
    rawMessage: string
  ): void {
    let message: ClientMessage;

    try {
      const parsed: unknown = JSON.parse(rawMessage);

      if (!this.isValidClientMessage(parsed)) {
        console.warn('Invalid WebSocket client message received.');
        return;
      }

      message = parsed;
    } catch (error) {
      console.error(
        'Error parsing WebSocket client message:',
        error instanceof Error ? error.message : error
      );
      return;
    }

    switch (message.type) {
      case 'SUBSCRIBE_TENANT':
        client.tenantId = message.tenantId;
        client.executionId = undefined;
        break;

      case 'SUBSCRIBE_EXECUTION':
        client.tenantId = message.tenantId;
        client.executionId = message.executionId;
        break;

      case 'UNSUBSCRIBE':
        client.tenantId = undefined;
        client.executionId = undefined;
        break;
    }
  }

  /**
   * Validate supported client message formats.
   */
  private isValidClientMessage(
    message: unknown
  ): message is ClientMessage {
    if (!message || typeof message !== 'object') {
      return false;
    }

    const data = message as Record<string, unknown>;

    switch (data.type) {
      case 'SUBSCRIBE_TENANT':
        return (
          typeof data.tenantId === 'string' &&
          data.tenantId.trim().length > 0
        );

      case 'SUBSCRIBE_EXECUTION':
        return (
          typeof data.tenantId === 'string' &&
          data.tenantId.trim().length > 0 &&
          typeof data.executionId === 'string' &&
          data.executionId.trim().length > 0
        );

      case 'UNSUBSCRIBE':
        return true;

      default:
        return false;
    }
  }

  /**
   * Start periodic heartbeat checks.
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((client) => {
        if (client.ws.readyState !== WebSocket.OPEN) {
          this.removeClient(client);
          return;
        }

        if (!client.isAlive) {
          client.ws.terminate();
          this.removeClient(client);
          return;
        }

        client.isAlive = false;

        try {
          client.ws.ping();
        } catch (error) {
          console.error('WebSocket heartbeat error:', error);
          client.ws.terminate();
          this.removeClient(client);
        }
      });
    }, HEARTBEAT_INTERVAL);
  }

  /**
   * Stop the heartbeat interval.
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Remove a client and release its connection reference.
   */
  private removeClient(client: ClientConnection): void {
    this.clients.delete(client);
  }

  /**
   * Safely send data to an individual client.
   */
  private sendToClient(
    client: ClientConnection,
    payload: unknown
  ): void {
    if (client.ws.readyState !== WebSocket.OPEN) {
      this.removeClient(client);
      return;
    }

    try {
      client.ws.send(JSON.stringify(payload), (error) => {
        if (error) {
          console.error('WebSocket send error:', error.message);
          this.removeClient(client);
        }
      });
    } catch (error) {
      console.error(
        'WebSocket send failure:',
        error instanceof Error ? error.message : error
      );

      this.removeClient(client);
    }
  }

  /**
   * Broadcast an orchestration event to matching subscribers.
   */
  public broadcast(event: WebSocketEventPayload): void {
    const serialized = JSON.stringify(event);

    this.clients.forEach((client) => {
      if (client.ws.readyState !== WebSocket.OPEN) {
        this.removeClient(client);
        return;
      }

      const matchesTenant =
        !client.tenantId ||
        client.tenantId === event.tenantId ||
        client.tenantId === SUPER_ADMIN_TENANT;

      const matchesExecution =
        !client.executionId ||
        client.executionId === event.executionId;

      if (!matchesTenant || !matchesExecution) {
        return;
      }

      try {
        client.ws.send(serialized, (error) => {
          if (error) {
            console.error('WS broadcast send error:', error.message);
            this.removeClient(client);
          }
        });
      } catch (error) {
        console.error(
          'WS broadcast failure:',
          error instanceof Error ? error.message : error
        );

        this.removeClient(client);
      }
    });
  }

  /**
   * Gracefully shut down the WebSocket server.
   */
  public close(): void {
    this.stopHeartbeat();

    if (!this.wss) {
      return;
    }

    this.clients.forEach((client) => {
      client.ws.close(1001, 'Server shutting down');
    });

    this.wss.close(() => {
      this.clients.clear();
      this.wss = null;
      console.log('WebSocket server closed successfully.');
    });
  }

  /**
   * Return the number of currently tracked connections.
   */
  public getClientCount(): number {
    return this.clients.size;
  }
}

export const wsManager = new OrchestrationWebSocketManager();
