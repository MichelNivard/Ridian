// src/RLanguageServer.ts

import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as readline from 'readline';

export class RLanguageServer {
  private process: ChildProcessWithoutNullStreams | null = null;
  private onCompletion: (items: any[]) => void;
  private onHover: (contents: string) => void;
  private rExecutablePath: string;
  private _buffer: string = '';
  private _requestId = 1;
  private _responseHandlers: Map<number, (response: any) => void> = new Map();

  constructor(
    rExecutablePath: string,
    onCompletion: (items: any[]) => void,
    onHover: (contents: string) => void
  ) {
    this.rExecutablePath = rExecutablePath;
    this.onCompletion = onCompletion;
    this.onHover = onHover;
  }

  start() {
    this.process = spawn(this.rExecutablePath, ['--slave', '-e', 'languageserver::run()']);

    this._buffer = '';

    this.process.stdout.on('data', (data) => {
      this._buffer += data.toString();
      this.parseMessages();
    });
    
    // Send initialize request
    this.initialize();
  }

  stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  private initialize() {
    const params = {
      processId: process.pid,
      rootUri: null,
      capabilities: {},
    };

    // Send the 'initialize' request and handle the response via sendRequest
    this.sendRequest('initialize', params, (response) => {
        this.sendNotification('initialized', {});
      });
  }


 public sendRequest(
    method: string,
    params: any,
    handler?: (response: any) => void
  ) {
    if (this.process) {
      const requestId = this.nextRequestId();
      const request = {
        jsonrpc: '2.0',
        id: requestId,
        method: method,
        params: params,
      };
  
      if (handler) {
        this._responseHandlers.set(requestId, handler);
      }
  
      const jsonRequest = JSON.stringify(request);
      const contentLength = Buffer.byteLength(jsonRequest, 'utf8');
      const message = `Content-Length: ${contentLength}\r\n\r\n${jsonRequest}`;
  
      this.process.stdin.write(message);
    }
  }

public sendNotification(method: string, params: any) {
  if (this.process) {
    const notification = {
      jsonrpc: '2.0',
      method: method,
      params: params,
    };

    const jsonNotification = JSON.stringify(notification);
    const contentLength = Buffer.byteLength(jsonNotification, 'utf8');
    const message = `Content-Length: ${contentLength}\r\n\r\n${jsonNotification}`;

    this.process.stdin.write(message);
  }
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

  private parseMessages() {
    while (true) {
      let headerEndIndex = this._buffer.indexOf('\r\n\r\n');
      if (headerEndIndex === -1) {
        // We don't have a complete header yet
        return;
      }

      const header = this._buffer.slice(0, headerEndIndex);
      const rest = this._buffer.slice(headerEndIndex + 4);

      const headers = header.split('\r\n');
      let contentLength = 0;

      for (const line of headers) {
        const [key, value] = line.split(': ');
        if (key.toLowerCase() === 'content-length') {
          contentLength = parseInt(value, 10);
        }
      }

      if (rest.length < contentLength) {
        // Not enough data yet
        return;
      }

      const message = rest.slice(0, contentLength);
      this._buffer = rest.slice(contentLength);

      this.handleMessage(message);

      // Continue to parse any additional messages
    }
  }

  private handleMessage(message: string) {
    try {
  
      const jsonResponse = JSON.parse(message);
  
      if (jsonResponse.id !== undefined) {
        const handler = this._responseHandlers.get(jsonResponse.id);
        if (handler) {
          handler(jsonResponse);
          this._responseHandlers.delete(jsonResponse.id);
        } else {
        }
      } else if (jsonResponse.method) {
        // Handle server-initiated messages if needed
      }
    } catch (error) {
      console.error('Failed to parse language server response:', error, 'Message:', message);
    }
  }
  

  private nextRequestId(): number {
    return this._requestId++;
  }
}


