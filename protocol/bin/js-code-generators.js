'use strict' // eslint-disable-line

function rpcChannelMap (name, callbackType, innerParamType, responseType) {
  return `export function ${name}RpcChannelMap (channelConfig: ChannelConfig<*>, request: $Exact<${['requestCommon', callbackType, innerParamType].filter(t => t).join(' & ')}>): ChannelMap<*> {
  const channelMap = createChannelMap(channelConfig)
  const incomingCallMap = Object.keys(channelMap).reduce((acc, k) => {
    acc[k] = (params, response) => {
      putOnChannelMap(channelMap, k, {params, response})
    }
    return acc
  }, {})
  const callback = (error) => {
    channelMap['finished'] && putOnChannelMap(channelMap, 'finished', {error})
    closeChannelMap(channelMap)
  }
  ${name}Rpc({
    ...request,
    incomingCallMap,
    callback,
  })
  return channelMap
}`
}

function rpcPromiseGen (name, callbackType, innerParamType, responseType) {
  return `export function ${name}RpcPromise (request: $Exact<${['requestCommon', callbackType, innerParamType].filter(t => t).join(' & ')}>): Promise<${responseType !== 'null' ? `${name}Result` : 'any'}> {
  return new Promise((resolve, reject) => { ${name}Rpc({...request, callback: (error, result) => { if (error) { reject(error) } else { resolve(result) } }}) })
}`
}

module.exports = {
  rpcPromiseGen,
  rpcChannelMap,
}
