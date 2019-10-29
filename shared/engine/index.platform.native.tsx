import {NativeModules, NativeEventEmitter} from 'react-native'
import logger from '../logger'
import {TransportShared, sharedCreateClient, rpcLog} from './transport-shared'
import {toByteArray, fromByteArray} from 'base64-js'
// @ts-ignore
import {encode} from '@msgpack/msgpack'
import toBuffer from 'typedarray-to-buffer'
import {printRPCBytes} from '../local-debug'
import {measureStart, measureStop} from '../util/user-timings'
import {SendArg, incomingRPCCallbackType, connectDisconnectCB} from './index.platform'

const nativeBridge: NativeEventEmitter & {
  runWithData: (arg0: string) => void
  eventName: string
  metaEventName: string
  metaEventEngineReset: string
  start: () => void
  reset: () => void
} = NativeModules.KeybaseEngine
// @ts-ignore
const RNEmitter = new NativeEventEmitter(nativeBridge)

class NativeTransport extends TransportShared {
  constructor(incomingRPCCallback, connectCallback, disconnectCallback) {
    super({}, connectCallback, disconnectCallback, incomingRPCCallback)

    // We're connected locally so we never get disconnected
    this.needsConnect = false
  }

  // We're always connected, so call the callback
  connect(cb: (err?: any) => void) {
    cb()
  }
  is_connected() {
    return true
  } // eslint-disable-line camelcase

  // Override and disable some built in stuff in TransportShared
  reset() {}
  close() {}
  get_generation() {
    return 1
  } // eslint-disable-line camelcase

  // A custom send override to write b64 to the react native bridge
  send(msg: SendArg) {
    const packed = encode(msg)
    const len = encode(packed.length)
    // We have to write b64 encoded data over the RN bridge

    const buf = new Uint8Array(len.length + packed.length)
    buf.set(len, 0)
    buf.set(packed, len.length)
    const b64 = fromByteArray(buf)
    if (printRPCBytes) {
      logger.debug('[RPC] Writing', b64.length, 'chars:', b64)
    }
    // Pass data over to the native side to be handled
    nativeBridge.runWithData(b64)
    return true
  }
}

function createClient(
  incomingRPCCallback: incomingRPCCallbackType,
  connectCallback: connectDisconnectCB,
  disconnectCallback: connectDisconnectCB
) {
  const client = sharedCreateClient(
    new NativeTransport(incomingRPCCallback, connectCallback, disconnectCallback)
  )

  nativeBridge.start()

  let packetizeCount = 0
  // This is how the RN side writes back to us
  RNEmitter.addListener(nativeBridge.eventName, (payload: string) => {
    if (printRPCBytes) {
      logger.debug('[RPC] Read', payload.length, 'chars:', payload)
    }

    const buffer = toBuffer(toByteArray(payload))
    const measureName = `packetize${packetizeCount++}:${buffer.length}`
    measureStart(measureName)
    const ret = client.transport.packetize_data(buffer)
    measureStop(measureName)
    return ret
  })

  RNEmitter.addListener(nativeBridge.metaEventName, (payload: string) => {
    switch (payload) {
      case nativeBridge.metaEventEngineReset:
        connectCallback()
    }
  })

  return client
}

function resetClient() {
  // Tell the RN bridge to reset itself
  nativeBridge.reset()
}

export {resetClient, createClient, rpcLog}
