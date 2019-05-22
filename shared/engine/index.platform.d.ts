type payloadType = {
  method: string
  param: Array<Object>
  response: Object | null
}

export type SendArg = [number, number, unknown, unknown]

// Client.invoke in client.iced in framed-msgpack-rpc ostensibly takes
// a list of arguments, but it expects exactly one element with keyed
// arguments.
export type invokeType = (method: string, args: [Object], cb: (err: any, data: any) => void) => void
export type createClientType = {
  transport: {
    needsConnect: boolean
    reset: () => void
  }
  invoke: invokeType
}

export type incomingRPCCallbackType = (payload: payloadType) => void
export type rpcLogType = 'engineToServer' | 'serverToEngine' | 'engineInternal'
export type connectDisconnectCB = () => void

declare function createClient(
  incomingRPCCallback: incomingRPCCallbackType,
  connectCallback: connectDisconnectCB,
  disconnectCallback: connectDisconnectCB
): createClientType

declare function resetClient(client: createClientType): void

declare function rpcLog(arg0: {method: string; reason?: string; extra?: Object; type: string}): void

export {createClient, resetClient, rpcLog}
