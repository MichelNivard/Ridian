import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

export class RLanguageServer {
  private process: ChildProcessWithoutNullStreams | null = null;
  private rExecutablePath: string;
  private buffer: Buffer = Buffer.alloc(0);
  private requestId = 1;
  private responseHandlers: Map<number, (response: any) => void> = new Map();
  private nextMessageLength: number | null = null;

  constructor(rExecutablePath: string) {
    this.rExecutablePath = rExecutablePath;
  }

  start() {
    if (this.process) {
      this.stop();
    }

    this.process = spawn(this.rExecutablePath, ['--slave', '-e', 'languageserver::run()'], {
      stdio: 'pipe',
    });
    this.buffer = Buffer.alloc(0);
    this.nextMessageLength = null;

    this.process.stdout.on('data', (data: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, data]);
      this.parseMessages();
    });

    this.process.stderr.on('data', (data: Buffer) => {
      const message = data.toString('utf8').trim();
      if (message.length > 0) {
        console.error('R language server stderr:', message);
      }
    });

    this.process.on('error', (error) => {
      console.error('Failed to start R language server:', error);
    });

    this.process.on('exit', () => {
      this.process = null;
      this.buffer = Buffer.alloc(0);
      this.nextMessageLength = null;
      this.responseHandlers.clear();
    });

    this.initialize();
  }

  stop() {
    if (!this.process) {
      return;
    }

    this.process.removeAllListeners();
    this.process.stdout.removeAllListeners();
    this.process.stderr.removeAllListeners();
    this.process.kill();
    this.process = null;
    this.buffer = Buffer.alloc(0);
    this.nextMessageLength = null;
    this.responseHandlers.clear();
  }

  sendRequest(method: string, params: any, handler?: (response: any) => void) {
    if (!this.process) {
      return;
    }

    const currentRequestId = this.requestId++;
    const request = {
      jsonrpc: '2.0',
      id: currentRequestId,
      method,
      params,
    };

    if (handler) {
      this.responseHandlers.set(currentRequestId, handler);
    }

    this.writeMessage(request);
  }

  sendNotification(method: string, params: any) {
    if (!this.process) {
      return;
    }

    this.writeMessage({
      jsonrpc: '2.0',
      method,
      params,
    });
  }

  public sendSignatureHelpRequest(
    uri: string,
    position: { line: number; character: number },
    handler: (response: any) => void
  ) {
    this.sendRequest(
      'textDocument/signatureHelp',
      {
        textDocument: { uri },
        position,
      },
      handler
    );
  }

  private initialize() {
    this.sendRequest(
      'initialize',
      {
        processId: process.pid,
        rootUri: null,
        capabilities: {},
      },
      () => {
        this.sendNotification('initialized', {});
      }
    );
  }

  private writeMessage(payload: Record<string, unknown>) {
    if (!this.process) {
      return;
    }

    const body = Buffer.from(JSON.stringify(payload), 'utf8');
    const header = Buffer.from(`Content-Length: ${body.byteLength}\r\n\r\n`, 'ascii');
    this.process.stdin.write(Buffer.concat([header, body]));
  }

  private parseMessages() {
    while (true) {
      if (this.nextMessageLength === null) {
        const headerEndIndex = this.buffer.indexOf('\r\n\r\n');
        if (headerEndIndex === -1) {
          return;
        }

        const header = this.buffer.subarray(0, headerEndIndex).toString('ascii');
        this.buffer = this.buffer.subarray(headerEndIndex + 4);
        this.nextMessageLength = this.parseContentLength(header);

        if (this.nextMessageLength === null) {
          this.buffer = Buffer.alloc(0);
          return;
        }
      }

      if (this.buffer.length < this.nextMessageLength) {
        return;
      }

      const messageBuffer = this.buffer.subarray(0, this.nextMessageLength);
      this.buffer = this.buffer.subarray(this.nextMessageLength);
      this.nextMessageLength = null;
      this.handleMessage(messageBuffer.toString('utf8'));
    }
  }

  private parseContentLength(header: string): number | null {
    for (const line of header.split('\r\n')) {
      const separatorIndex = line.indexOf(':');
      if (separatorIndex === -1) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim().toLowerCase();
      const value = line.slice(separatorIndex + 1).trim();
      if (key === 'content-length') {
        const parsedValue = Number.parseInt(value, 10);
        return Number.isFinite(parsedValue) ? parsedValue : null;
      }
    }

    console.error('R language server message missing Content-Length header:', header);
    return null;
  }

  private handleMessage(message: string) {
    try {
      const jsonResponse = JSON.parse(message);

      if (jsonResponse.id !== undefined) {
        const handler = this.responseHandlers.get(jsonResponse.id);
        if (handler) {
          handler(jsonResponse);
          this.responseHandlers.delete(jsonResponse.id);
        }
      }
    } catch (error) {
      console.error('Failed to parse language server response:', error, 'Message:', message);
    }
  }
}
