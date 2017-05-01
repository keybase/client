'use strict' // eslint-disable-line

function rpcChannelMap (methodName, name, callbackType, innerParamType, responseType) {
  return `\nexport function ${name}RpcChannelMap (configKeys: Array<string>, request: $Exact<${['requestCommon', callbackType, innerParamType].filter(t => t).join(' & ')}>): EngineChannel {
  return engine()._channelMapRpcHelper(configKeys, ${methodName}, request)
}`
}

function rpcPromiseGen (methodName, name, callbackType, innerParamType, responseType) {
  return `\nexport function ${name}RpcPromise (request: $Exact<${['requestCommon', callbackType, innerParamType].filter(t => t).join(' & ')}>): Promise<${responseType !== 'null' ? `${name}Result` : 'void'}> {
  return new Promise((resolve, reject) => engineRpcOutgoing(${methodName}, request, (error, result) => error ? reject(error) : resolve(result)))
}`
}

module.exports = {
  rpcPromiseGen,
  rpcChannelMap,
}
