'use strict' // eslint-disable-line

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

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
  const requestType = ['RequestCommon', callbackType, innerParamType].filter(Boolean).join(' & ')
  return `\nexport const ${name}RpcChannelMap = (configKeys: Array<string>, request: ${requestType}): EngineChannel => engine()._channelMapRpcHelper(configKeys, ${methodName}, request)`
}

function rpcPromiseGen(methodName, name, callbackType, innerParamType, responseType) {
  const requestType = ['RequestCommon', callbackType, innerParamType].filter(Boolean).join(' & ')
  const maybeOptional = !innerParamType ? '?' : ''
  return `\nexport const ${name}RpcPromise = (request: ${maybeOptional}(${requestType})): Promise<${responseType !== 'null' ? `${capitalize(name)}Result` : 'void'}> => new Promise((resolve, reject) => engineRpcOutgoing(${methodName}, request, (error, result) => error ? reject(error) : resolve(result)))`
}

module.exports = {
  channelMapPrelude,
  rpcPromiseGen,
  rpcChannelMap,
}
