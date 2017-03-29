'use strict' // eslint-disable-line

const channelMapPrelude = `\nfunction _channelMapRpcHelper(channelConfig: ChannelConfig<*>, partialRpcCall: (incomingCallMap: any, callback: Function) => void): ChannelMap<*> {
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

function rpcChannelMap (methodName, name, callbackType, innerParamType, responseType) {
  return `\nexport function ${name}RpcChannelMap (channelConfig: ChannelConfig<*>, request: $Exact<${['requestCommon', callbackType, innerParamType].filter(t => t).join(' & ')}>): ChannelMap<*> {
  return _channelMapRpcHelper(channelConfig, (incomingCallMap, callback) => { engineRpcOutgoing(${methodName}, request, callback, incomingCallMap) })
}`
}

function rpcPromiseGen (methodName, name, callbackType, innerParamType, responseType) {
  return `\nexport function ${name}RpcPromise (request: $Exact<${['requestCommon', callbackType, innerParamType].filter(t => t).join(' & ')}>): Promise<${responseType !== 'null' ? `${name}Result` : 'void'}> {
  return new Promise((resolve, reject) => engineRpcOutgoing(${methodName}, request, (error, result) => error ? reject(error) : resolve(result)))
}`
}

module.exports = {
  channelMapPrelude,
  rpcPromiseGen,
  rpcChannelMap,
}
