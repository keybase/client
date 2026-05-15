import type {
  ConnectDisconnectCB,
  IncomingRPCCallbackType,
  InvokeType,
  PayloadType,
  RPCMessage,
  RPCTransport,
} from './rpc-transport'

export type {ConnectDisconnectCB, IncomingRPCCallbackType, InvokeType, PayloadType, RPCMessage}

export type CreateClientType = {
  transport: RPCTransport & {
    needsConnect: boolean
    reset: () => void
    close?: () => void
    send: (message: unknown) => boolean
    packetizeData: (data: Uint8Array) => void
    dispatchDecodedMessage: (message: unknown) => void
  }
  invoke: InvokeType
}

declare function createClient(
  incomingRPCCallback: IncomingRPCCallbackType,
  connectCallback: ConnectDisconnectCB,
  disconnectCallback: ConnectDisconnectCB
): CreateClientType

declare function resetClient(
  client: CreateClientType,
  incomingRPCCallback: IncomingRPCCallbackType,
  connectCallback: ConnectDisconnectCB,
  disconnectCallback: ConnectDisconnectCB
): CreateClientType

declare function rpcLog(arg0: {method: string; reason?: string; extra?: object; type: string}): void

export {createClient, resetClient, rpcLog}
