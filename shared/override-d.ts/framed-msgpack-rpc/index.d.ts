declare module 'framed-msgpack-rpc' {
  export const errors: {
    msg: {
      '0': 'Success'
      '100': 'No method available'
      '101': 'EOF from server'
      UNKNOWN_METHOD: 'No method available'
      EOF: 'EOF from server'
      OK: 'Success'
    }
    name: {
      '0': 'OK'
      '100': 'UNKNOWN_METHOD'
      '101': 'EOF'
      UNKNOWN_METHOD: 'UNKNOWN_METHOD'
      EOF: 'EOF'
      OK: 'OK'
    }
    code: {
      UNKNOWN_METHOD: 100
      EOF: 101
      OK: 0
    }
    UNKNOWN_METHOD: 100
    EOF: 101
    OK: 0
  }

  export const pack: {
    set_opt: (k: string, v: unknown) => void
  }

  export const dispatch: {
    COMPRESSION_TYPE_NONE: number
    COMPRESSION_TYPE_GZIP: number
  }

  export type ErrorType = {code: number; desc: string}
  export type PayloadType = {
    method: string
    param: Array<{sessionID?: number}>
    response?: {
      cancelled: boolean
      seqid: number
      error?: (e: ErrorType) => void
      result?: (r?: unknown) => void
    }
  }
  export type incomingRPCCallbackType = (payload: PayloadType) => void
  export type connectDisconnectCB = () => void

  export type InvokeArgs = {
    program: string
    ctype: number
    method: string
    args: [object]
    notify: boolean
  }
  export namespace transport {
    class RobustTransport {
      constructor(
        options: {path?: string},
        incomingRPCCallback?: incomingRPCCallbackType,
        connectCallback?: connectDisconnectCB,
        disconnectCallback?: connectDisconnectCB
      )
      send(u: unknown): boolean
      invoke(i: InvokeArgs, cb: (err: ErrorType, data: {}) => void): void
      packetize_data(d: unknown): void
      needsConnect: boolean
      connect(b: (err?: unknown) => void): void
      _connect_critical_section(cb: unknown): void
      _raw_write(msg: string, encoding: 'binary'): void
      _dispatch(a: unknown): void
      hooks: {
        connected: () => void
        eof: () => void
      }
      set_generic_handler: (f: (payload: PayloadType) => void) => void
    }
  }

  export namespace client {
    class Client {
      constructor(transport: transport.RobustTransport)
      transport: transport.RobustTransport
    }
  }
}
