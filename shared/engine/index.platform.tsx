import logger from '@/logger'
import {TransportShared, sharedCreateClient, rpcLog} from './transport-shared'
import type {RPCMessage} from './rpc-transport'
import type {InvokeType, PayloadType, ConnectDisconnectCB, IncomingRPCCallbackType} from '@/engine/rpc-transport'

export type {PayloadType, ConnectDisconnectCB, IncomingRPCCallbackType, InvokeType}

export type CreateClientType = {
  transport: TransportShared
  invoke: InvokeType
}
import KB2, {type EngineLinkFrame} from '@/util/electron'
import {onMetaEvent, notifyJSReady} from 'react-native-kb'

const isLinkFrame = (data: unknown): data is EngineLinkFrame =>
  typeof data === 'object' && data !== null && (data as {type?: unknown}).type === 'link'

// Desktop renderer transport: talks to the service through the node relay over IPC
class ProxyNativeTransport extends TransportShared {
  // The relay connection the last link-up named. Every send carries it, so the relay can drop a
  // send made on a connection that has since gone.
  private _epoch = 0
  private _stopListening?: () => void

  // Hears the service's bytes and the link frames from the relay
  listenToRelay() {
    this._stopListening = KB2.functions.ipcRendererOn?.('engineIncoming', (_e: unknown, data: unknown) => {
      try {
        this.fromRelay(data)
      } catch (e) {
        logger.error('>>>> engineIncoming IPC JS thrown!', e)
      }
    })
  }

  // A closed transport stops hearing the relay, so an engine that replaced it is the only one that does
  override close() {
    this._stopListening?.()
    this._stopListening = undefined
    super.close()
  }

  protected writeMessage(message: RPCMessage) {
    const {engineSend} = KB2.functions
    if (!engineSend) {
      // Silently no-oping here reports success upstream (send() returns true)
      // while the invocation is never delivered, leaving it outstanding
      // forever. Throwing lets the transport fail it, same as mobile.
      throw new Error('engineSend missing')
    }
    engineSend({epoch: this._epoch, message})
  }

  fromRelay(data: unknown) {
    if (isLinkFrame(data)) {
      this.onLinkFrame(data)
    } else if (this.isLinkUp) {
      this.packetizeData(data as Uint8Array)
    }
  }

  // The relay replays its state to a renderer that may have missed it, so a link-up for the
  // connection already up is a repeat, and a link-down for a connection that is not up is stale.
  private onLinkFrame({up, epoch}: EngineLinkFrame) {
    const endsCurrentLink = up ? epoch !== this._epoch : epoch === this._epoch
    if (this.isLinkUp && endsCurrentLink) {
      this.markLinkDown()
    }
    if (up && !this.isLinkUp) {
      this._epoch = epoch
      this.markLinkUp()
    }
  }

  override restartLink() {
    KB2.functions.engineRestartLink?.()
  }

  // Engine.reset (the Windows pipe-owner check failing): the relay drops its connection and stays
  // off the pipe until the renderer reloads. Its link-down frame takes what was in flight down.
  override reset() {
    const {engineDropLink} = KB2.functions
    if (!engineDropLink) {
      logger.error('Engine reset: engineDropLink missing')
      return
    }
    engineDropLink()
  }
}

// Mobile transport — only instantiated when isMobile. The link is up from the start; Go dropping
// the loopback connection takes it down and back up in one step (the 'kb-engine-reset' meta event).
class NativeTransportMobile extends TransportShared {
  constructor(
    incomingRPCCallback: IncomingRPCCallbackType,
    connectCallback: ConnectDisconnectCB,
    disconnectCallback: ConnectDisconnectCB
  ) {
    super(incomingRPCCallback, connectCallback, disconnectCallback, true)
  }

  protected writeMessage(message: RPCMessage) {
    if (!global.rpcOnGo) {
      throw new Error('rpcOnGo send before rpcOnGo global')
    }
    // Throwing rather than swallowing is load-bearing: the transport catches
    // it and fails that invocation, instead of leaving the caller waiting on
    // a reply that can never arrive. rpcOnGo returns false when the native
    // write to Go failed.
    if (!global.rpcOnGo(message)) {
      throw new Error('native rpc write failed')
    }
  }

  // linkDown and linkUp are only reachable from the 'kb-engine-reset' meta event below: Go dropped
  // the loopback connection (e.g. a stream desync detected natively), so nothing will answer the
  // in-flight RPCs and hanging every caller is the alternative. An account switch must NOT land
  // here: failing outstanding RPCs on a switch fails login.login, proven on device. Keep any new call
  // site inside the meta-event handler, not in code shared with the account-switch path.
  linkDown() {
    this.markLinkDown()
  }

  linkUp() {
    this.markLinkUp()
  }
}

// Expands a native rpcOnJs batch into individual dispatchOne calls. Exported
// so the mobile batch path (otherwise only reachable through the
// isMobile-gated global.rpcOnJs assignment inside createClient) can be
// exercised directly in tests.
export const dispatchRpcBatch = (
  objs: unknown,
  count: number,
  dispatchOne: (obj: unknown) => void,
  logError: (msg: string, e?: unknown) => void
) => {
  // Outer guard: this is called from native, so throwing here would abort the
  // whole batch delivery and unwind into native code.
  try {
    if (count > 1) {
      if (!Array.isArray(objs)) {
        // Native always sends an array when it batches, so this means the
        // two sides disagree -- and count-1 messages would vanish silently.
        logError(`rpcOnJs: count ${count} but payload is not an array`)
        return
      }
      for (const obj of objs) {
        dispatchOne(obj)
      }
    } else {
      dispatchOne(objs)
    }
  } catch (e) {
    logError('rpcOnJs: batch guard threw', e)
  }
}

// Per-message try/catch: one bad message must not drop the rest of the batch
// the native side handed over. Exported (alongside dispatchRpcBatch) so the
// mobile-only wiring inside createClient's isMobile branch can be exercised
// directly in tests without a mobile jest environment.
export const makeDispatchOne = (client: {transport: {dispatchDecodedMessage: (obj: unknown) => void}}) => {
  return (obj: unknown) => {
    try {
      client.transport.dispatchDecodedMessage(obj)
    } catch (e) {
      logger.error('rpcOnJs: dispatch threw', e)
    }
  }
}

function createClient(
  incomingRPCCallback: IncomingRPCCallbackType,
  connectCallback: ConnectDisconnectCB,
  disconnectCallback: ConnectDisconnectCB
) {
  if (isMobile) {
    const transport = new NativeTransportMobile(incomingRPCCallback, connectCallback, disconnectCallback)
    const client = sharedCreateClient(transport)

    const dispatchOne = makeDispatchOne(client)

    global.rpcOnJs = (objs: unknown, count: number) => {
      dispatchRpcBatch(objs, count, dispatchOne, (msg, e) => logger.error(msg, e))
    }

    onMetaEvent((payload: string) => {
      try {
        switch (payload) {
          case 'kb-engine-reset':
            // Go dropped the loopback connection; anything in flight is dead.
            // The link goes down (failing what is in flight, then telling the
            // engine, which cancels its sessions and shows the reconnect
            // state) before it comes back up -- the desktop link frames do the
            // same pair. The two are isolated in their own try/catch: a throw
            // from a session cancel handler on the way down must not strand
            // the UI on the disconnect banner by skipping the link-up (whose
            // connect callback synchronously clears the daemon error via
            // startHandshake(), so nothing here may be moved behind an await).
            try {
              transport.linkDown()
            } catch (e) {
              logger.error('>>>> meta engine event: link down threw', e)
            }
            try {
              transport.linkUp()
            } catch (e) {
              logger.error('>>>> meta engine event: link up threw', e)
            }
        }
      } catch (e) {
        logger.error('>>>> meta engine event JS thrown!', e)
      }
    })

    // Signal that JS is ready to send/receive RPCs
    // This sets up native infrastructure and starts bidirectional communication
    logger.info('JS engine ready, notifying native side')
    notifyJSReady()

    return client
  }

  const transport = new ProxyNativeTransport(incomingRPCCallback, connectCallback, disconnectCallback)
  transport.listenToRelay()
  return sharedCreateClient(transport)
}

export {createClient, rpcLog}
