/* @flow */

export type Endpoint = (params: any) => (Promise<any> | any)

export type NestedCallMap = {[key: string]: (NestedCallMap | Endpoint)}
export type CallMap = {[key: string]: Endpoint}

export function flattenCallMap (endpointMap: NestedCallMap): CallMap {
  return flattenNextLevel('', '', endpointMap)
}

function flattenNextLevel (separator: string, key: string, value: any): CallMap {
  if (typeof value === 'object') {
    const submap = value
    return Object.keys(value).reduce(
      (memo, subkey) => Object.assign(memo, flattenNextLevel('.', key + separator + subkey, submap[subkey])),
        {}
    )
  } else {
    return {[key]: value}
  }
}

export function promisifyResponses (endpoints: CallMap): CallMap {
  return Object.keys(endpoints).reduce(
    (memo, k) => {
      memo[k] = (param, response) => {
        const rMaybePromise = endpoints[k](param)

        // Did the endpoint return a promise or not?
        if (!!rMaybePromise && rMaybePromise.constructor === Promise) {
          rMaybePromise.then(v => response.result(v))
        } else {
          response.result(rMaybePromise)
        }
      }
      return memo
    },
    {}
  )
}
