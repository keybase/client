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
  private _linkUp = false
  // The relay connection the last link-up named. Every send carries it, so the relay can drop a
  // send made on a connection that has since gone.
  private _epoch = 0

  constructor(
    incomingRPCCallback: IncomingRPCCallbackType,
    connectCallback?: ConnectDisconnectCB,
    disconnectCallback?: ConnectDisconnectCB
  ) {
    super(connectCallback, disconnectCallback, incomingRPCCallback)
  }

  protected override isConnected() {
    return this._linkUp
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
    } else if (this._linkUp) {
      this.packetizeData(data as Uint8Array)
    }
  }

  // The relay replays its state to a renderer that may have missed it, so a link-up for the
  // connection already up is a repeat, and a link-down for a connection that is not up is stale.
  private onLinkFrame({up, epoch}: EngineLinkFrame) {
    const endsCurrentLink = up ? epoch !== this._epoch : epoch === this._epoch
    if (this._linkUp && endsCurrentLink) {
      this._linkUp = false
      this.onLinkDown()
    }
    if (up && !this._linkUp) {
      this._epoch = epoch
      this._linkUp = true
      this.onConnected()
    }
  }

  // Engine.reset (the Windows pipe-owner check failing): nothing in flight will be answered
  override reset() {
    this.failAllOutstanding()
  }
}

// Mobile transport — only instantiated when isMobile. The link is up from the start; Go dropping
// the loopback connection takes it down and back up in one step (the 'kb-engine-reset' meta event).
class NativeTransportMobile extends TransportShared {
  private _linkUp = true

  constructor(
    incomingRPCCallback: IncomingRPCCallbackType,
    connectCallback?: ConnectDisconnectCB,
    disconnectCallback?: ConnectDisconnectCB
  ) {
    super(connectCallback, disconnectCallback, incomingRPCCallback)
  }

  protected override isConnected() {
    return this._linkUp
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
    this._linkUp = false
    this.onLinkDown()
  }

  linkUp() {
    this._linkUp = true
    this.onConnected()
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

  const {ipcRendererOn} = KB2.functions
  const transport = new ProxyNativeTransport(incomingRPCCallback, connectCallback, disconnectCallback)
  const client = sharedCreateClient(transport)

  // plumb back data and link changes from the node relay
  ipcRendererOn?.('engineIncoming', (_e: unknown, data: unknown) => {
    try {
      transport.fromRelay(data)
    } catch (e) {
      logger.error('>>>> engineIncoming IPC JS thrown!', e)
    }
  })

  return client
}

export {createClient, rpcLog}
