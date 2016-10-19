'use strict' // eslint-disable-line

const channelMapPrelude = `function _channelMapRpcHelper(channelConfig: ChannelConfig<*>, partialRpcCall: (incomingCallMap: any, callback: Function) => void): ChannelMap<*> {
  const channelMap = createChannelMap(channelConfig)
  const incomingCallMap = Object.keys(channelMap).reduce((acc, k) => {
    acc[k] = (params, response) => {
      putOnChannelMap(channelMap, k, {params, response})
    }
    return acc
  }, {})
  const callback = (error, params) => {
    channelMap['finished'] && putOnChannelMap(channelMap, 'finished', {error, params})
    closeChannelMap(channelMap)
  }
  partialRpcCall(incomingCallMap, callback)
  return channelMap
}
`

function rpcChannelMap (name, callbackType, innerParamType, responseType) {
  return `export function ${name}RpcChannelMap (channelConfig: ChannelConfig<*>, request: $Exact<${['requestCommon', callbackType, innerParamType].filter(t => t).join(' & ')}>): ChannelMap<*> {
  return _channelMapRpcHelper(channelConfig, (incomingCallMap, callback) => ${name}Rpc({...request, incomingCallMap, callback}))
}`
}

function rpcPromiseGen (name, callbackType, innerParamType, responseType) {
  return `export function ${name}RpcPromise (request: $Exact<${['requestCommon', callbackType, innerParamType].filter(t => t).join(' & ')}>): Promise<${responseType !== 'null' ? `${name}Result` : 'any'}> {
  return new Promise((resolve, reject) => { ${name}Rpc({...request, callback: (error, result) => { if (error) { reject(error) } else { resolve(result) } }}) })
}`
}

module.exports = {
  channelMapPrelude,
  rpcPromiseGen,
  rpcChannelMap,
}
