import type {RPCTransport, InvokeType, PayloadType, ConnectDisconnectCB, IncomingRPCCallbackType} from '@/engine/rpc-transport'

export type {PayloadType, ConnectDisconnectCB, IncomingRPCCallbackType, InvokeType}

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
