/* @flow */

/**
 * Server abstraction for incoming RPC's
 *
 * The service will make call to us, and we'll want to be able to handle them.
 * Here is the general dance:
 *
 * +---------------------------------------------+
 * | Key:                                        |
 * |  <- : incoming rpc                          |
 * |    ->: reply to incoming rpc (note indent)  |
 * +---------------------------------------------+
 *
 *
 * <- Some `start` message telling us to start a session
 *    -> reply with the our session id for the session
 * ...
 * <-     various messages going back in forth (i.e. updates on tracking status)
 *    ->  reply back
 * ...
 *
 * <- Some `end` message telling us the service is done with this session
 *    -> reply to acknowledge
 *
 *
 * ## The Server Abstraction
 * This class provides an abstraction to the rpc messaging system above.
 *
 *
 * You specify what the start and end message is.
 * You specify a function that returns a map of functions (aka endpoints) to be called during the session
 *
 * 1. The server will create the session when it gets the `start` message, and call your endpointMapFn function
 * with the params it got from the service from the `start` message
 *
 * 2. It will map incoming calls during the session to functions defined in the endpointMapFn
 *
 * 3. When it receives the `end` message it will clean up the session call map.
 *
 */

import type {CallMap} from './call-map-middleware'

type Engine = any

export default class Server {
  startMethodName: string;
  engine: Engine;
  endpointsFn: (params: any, end: () => void) => CallMap;

  constructor (engine: Engine, startMethodName: string, endMethodName: string, endpointMapFn: (params: any) => CallMap) {
    this.engine = engine
    this.startMethodName = startMethodName

    this.endpointsFn = (params, end) => {
      const endpoints = endpointMapFn(params)

      // End the server when endMethodName is called
      if (endMethodName) {
        const originalEndMethod = endpoints[endMethodName]
        endpoints[endMethodName] = (params, response) => {
          end()
          // If there was something that is assigned to this endpoint we'll call it
          if (originalEndMethod) {
            return originalEndMethod(params, response)
          }
        }
      }

      return endpoints
    }
  }

  listen () {
    this.engine.listenServerInit(this.startMethodName, (param, cbs) => this.init(param, cbs))
  }

  init (params: any, {start, end}: {start: (endpoints: CallMap) => void, end: () => void}) {
    start(this.endpointsFn(params, end))
  }
}

export function createServer (engine: Engine, startMethodName: string, endMethodName: string, endpointMapFn: (params: any) => CallMap): void {
  const s = new Server(engine, startMethodName, endMethodName, endpointMapFn)
  s.listen()
}
