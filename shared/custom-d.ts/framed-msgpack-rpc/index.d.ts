declare module "framed-msgpack-rpc" {
    export const errors: {
      UNKNOWN_METHOD: number
      EOF: number
      msg: {[key: number]: string}
    }

    export namespace transport {
      class RobustTransport {
        constructor(options: Object)
        invoke(
          i: {
            program: string
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
