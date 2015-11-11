'use strict'
/* @flow */

type Endpoint = (params: any) => (Promise<any> | any)

type ServerEndpoints = { [key: string]: (ServerEndpoints | Endpoint) }
type FlatServerEndpoints = { [key: string]: Endpoint }

type Engine = any

export default class Server {
  startMethodName: string;
  engine: Engine;
  endpointsFn: (params: any, end: () => void) => FlatServerEndpoints;

  constructor (engine: Engine, startMethodName: string, endMethodName: string, endpointMapFn: (params: any) => ServerEndpoints) {
    this.engine = engine
    this.startMethodName = startMethodName

    this.endpointsFn = (params, end) => {
      const endpoints = this.parseEndpoint(endpointMapFn(params))

      // End the server when endMethodName is called
      if (endMethodName) {
        const originalEndMethod = endpoints[endMethodName]
        endpoints[endMethodName] = (params) => {
          end()
          // If there was something that is assigned to this endpoint we'll call it
          if (originalEndMethod) {
            return originalEndMethod(params)
          }
        }
      }

      return this.promisifyResponses(endpoints)
    }
  }

  listen () {
    this.engine.listenServerInit(this.startMethodName, (param, cbs) => this.init(param, cbs))
  }

  init (params: any, {start, end}: {start: (endpoints: FlatServerEndpoints) => void, end: () => void}) {
    start(this.endpointsFn(params, end))
  }

  parseEndpoint (endpointMap: ServerEndpoints): FlatServerEndpoints {
    return this.parseNextLevel('', '', endpointMap)
  }

  parseNextLevel (separator: string, key: string, value: any): FlatServerEndpoints {
    if (typeof value === 'object') {
      const submap = value
      return Object.keys(value).reduce(
        (memo, subkey) => Object.assign(memo, this.parseNextLevel('.', key + separator + subkey, submap[subkey])),
        {}
      )
    } else {
      // $FlowIssue Computed property keys not supported
      return {[key]: value}
    }
  }

  promisifyResponses (endpoints: FlatServerEndpoints): FlatServerEndpoints {
    return Object.keys(endpoints).reduce(
      (memo, k) => {
        memo[k] = (param, response) => {
          const rMaybePromise = endpoints[k](param)

          // Did the endpoint return a promise or not?
          if (!!rMaybePromise && rMaybePromise.constructor === Promise) {
            rMaybePromise.then((v) => response.result(v))
          } else {
            response.result(rMaybePromise)
          }
        }
        return memo
      },
      {}
    )
  }
}
