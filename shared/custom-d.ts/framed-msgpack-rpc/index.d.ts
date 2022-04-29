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
    set_opt: (k: string, v: any) => void
  }

  export const dispatch: {
    COMPRESSION_TYPE_NONE: number
    COMPRESSION_TYPE_GZIP: number
  }

  export namespace transport {
    class RobustTransport {
      constructor(options: Object)
      invoke(
        i: {
          program: string
          ctype: number
          method: string
          args: [Object]
          notify: boolean
        },
        cb: (err: any, data: any) => void
      ): void
      packetize_data(d: any): void
      needsConnect: boolean
      connect(b: (err?: any) => void): void
      _connect_critical_section(cb: any): void
      _raw_write(msg: string, encoding: 'binary'): void
      _dispatch(a: any): void
    }
  }

  export namespace client {
    class Client {
      constructor(transport: transport.RobustTransport)
      transport: transport.RobustTransport
    }
  }
}
