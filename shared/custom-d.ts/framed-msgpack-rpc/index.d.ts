declare module 'framed-msgpack-rpc' {
  export const errors: {
    UNKNOWN_METHOD: number
    EOF: number
    msg: {[key: number]: string}
  }

  export const pack: {
    set_opt(k: string, v: any): void
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
    }
  }

  export namespace client {
    class Client {
      constructor(transport: transport.RobustTransport)
      transport: transport.RobustTransport
    }
  }
}
