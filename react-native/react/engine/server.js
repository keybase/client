'use strict'
/* @flow */

export default class Server {
  constructor (engine, startMethodName, endMethodName, endpointMapFn) {
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

  init (params, {start, end}) {
    start(this.endpointsFn(params, end))
  }

  parseEndpoint (endpointMap) {
    return this.parseNextLevel('', '', endpointMap)
  }

  parseNextLevel (separator, key, value) {
    if (typeof value === 'object') {
      const submap = value
      return Object.keys(value).reduce(
        (memo, subkey) => Object.assign(memo, this.parseNextLevel('.', key + separator + subkey, submap[subkey])),
        {}
      )
    } else {
      return {[key]: value}
    }
  }

  promisifyResponses (endpoints) {
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
