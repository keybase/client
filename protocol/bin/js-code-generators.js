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

function rpcChannelMap(methodName, name, callbackType, innerParamType, responseType) {
  const requestType = ['requestCommon', callbackType, innerParamType].filter(Boolean).join(' & ')
  return `\nexport function ${name}RpcChannelMap (configKeys: Array<string>, request: ${requestType}): EngineChannel {
  return engine()._channelMapRpcHelper(configKeys, ${methodName}, request)
}`
}

function rpcPromiseGen(methodName, name, callbackType, innerParamType, responseType) {
  const requestType = ['requestCommon', callbackType, innerParamType].filter(Boolean).join(' & ')
  const maybeOptional = !innerParamType ? '?' : ''
  return `\nexport function ${name}RpcPromise (request: ${maybeOptional}(${requestType})): Promise<${responseType !== 'null' ? `${name}Result` : 'void'}> {
  return new Promise((resolve, reject) => engineRpcOutgoing(${methodName}, request, (error, result) => error ? reject(error) : resolve(result)))
}`
}

module.exports = {
  channelMapPrelude,
  rpcPromiseGen,
  rpcChannelMap,
}
