// @flow
// Handles sending requests to native mobile (then go) and back
import NativeEventEmitter from '../common-adapters/native-event-emitter'
import Transport from './transport'
import nativeEngine from './index.native'
import rpc from 'framed-msgpack-rpc'
import setupLocalLogs from '../util/local-log'
import {Buffer} from 'buffer'
import {constants} from '../constants/types/keybase-v1'
import {log} from '../native/log/logui'
import {printRPC, printOutstandingRPCs} from '../local-debug'
import type {incomingCallMapType} from '../constants/types/flow-types'

const {client: {Client: RpcClient}} = rpc
const KEYBASE_RPC_DELAY_RESULT: number = process.env.KEYBASE_RPC_DELAY_RESULT ? parseInt(process.env.KEYBASE_RPC_DELAY_RESULT) : 0
const KEYBASE_RPC_DELAY: number = process.env.KEYBASE_RPC_DELAY ? parseInt(process.env.KEYBASE_RPC_DELAY) : 0

const NO_ENGINE = process.env.KEYBASE_NO_ENGINE
if (NO_ENGINE) {
  console.log('Engine disabled!')
}

type SessionID = number;
type SessionIDKey = string; // used in our maps, really converted to a string key
type MethodKey = string;
type WaitingHandlerType = (waiting: boolean, method: string, sessionID: SessionID) => void

class Engine {
  logLocal: (msgs: any) => void;
  responseMeta: {[key: SessionIDKey]: {
    method: string,
    param: ?Object,
  }};
  sessionIDToResponse: {[key: SessionIDKey]: ?Object};
  rpcClient: Object;
  sessionID: number;
  sessionIDToIncomingCall: {[key: SessionIDKey]: {
    incomingCallMap: incomingCallMapType,
    waitingHandler: ?WaitingHandlerType,
  }}
  generalListeners: {[key: MethodKey]: (param: ?Object, response: ?Object) => void};
  serverListeners: {[key: MethodKey]: (param: ?Object, cbs: Object, sessionID: SessionID) => void};
  onConnectFns: {[key: string]: () => void};
  _failOnError: boolean;
  inListenerCallback: boolean;

  constructor () {
    const {logLocal} = setupLocalLogs()
    this.logLocal = logLocal

    // Keep some meta data from session ID to response meta
    // To help debug outstanding requests
    this.responseMeta = {}

    if (printOutstandingRPCs) {
      setInterval(() => {
        const keys = Object.keys(this.sessionIDToResponse).filter(k => this.sessionIDToResponse[k])
        if (keys.length) {
          keys.forEach(k => {
            const {method, param} = this.responseMeta[k]
            logLocal('Outstanding RPC sessionIDs: %s.\nMethod: %s with param: %O', k, method, param)
          })
        }
      }, 10 * 1000)
    }

    if (!NO_ENGINE) {
      this.rpcClient = new RpcClient(
        // $FlowIssue
        new Transport(
          payload => {
            if (__DEV__ && KEYBASE_RPC_DELAY_RESULT) {
              setTimeout(() => this._rpcIncoming(payload), KEYBASE_RPC_DELAY_RESULT)
            } else {
              this._rpcIncoming(payload)
            }
          },
          this._rpcWrite,
          () => this._onConnect()
        ),
        'keybase.1',
      )

      if (this.rpcClient.transport.needsConnect) {
        this.rpcClient.transport.connect(err => {
          if (err != null) {
            console.log('Error in connecting to transport rpc:', err)
          }
        })
      }

      this._setupListener()
    }

    this.sessionID = 123

    // to find callMap for rpc callbacks, including waitingHandler
    this.sessionIDToIncomingCall = {}

    // any non-responded to response objects
    this.sessionIDToResponse = {}

    // seqid to wrapped response so we can handle cancelations
    this.seqIDToWrappedResponse = {}

    // A call map for general listeners
    // These are commands that the service can call at any point in time
    this.generalListeners = {}

    this.serverListeners = {}

    // A list of functions to call when we connect
    this.onConnectFns = {}

    // Throw an error and fail?
    this._failOnError = false
  }

  _onConnect () {
    this.inListenerCallback = true
    Object.keys(this.onConnectFns).forEach(k => this.onConnectFns[k]())
    this.inListenerCallback = false
  }

  listenOnConnect (key: string, f: () => void) {
    if (NO_ENGINE) {
      return
    }

    if (!f) {
      throw new Error('Null callback sent to listenOnConnect')
    }

    if (this.inListenerCallback) {
      throw new Error('Ran a listenOnConnect within another listenOnConnect')
    }

    // The transport is already connected, so let's call this function right away
    if (!this.rpcClient.transport.needsConnect) {
      f()
    }

    // Regardless if we were connected or not, we'll add this to the callback fns
    // that should be called when we connect.
    this.onConnectFns[key] = f
  }

  getSessionID () {
    this.sessionID++
    return this.sessionID
  }

  _setupListener () {
    NativeEventEmitter.addListener(
      nativeEngine.eventName,
      payload => {
        if (!payload) {
          return
        }

        if (this.rpcClient.transport.needsBase64) {
          this.rpcClient.transport.packetize_data(new Buffer(payload, 'base64'))
        }
      }
    )
  }

  // Bind a single callback to a method.
  // Newer calls to this will overwrite older listeners, and older listeners will not get called.
  listenGeneralIncomingRpc (params: {[key: MethodKey]: () => void}) {
    Object.keys(params).forEach(method => {
      this.generalListeners[method] = params[method]
    })
  }

  removeGeneralIncomingRpc (method: MethodKey) {
    this.listenGeneralIncomingRpc({[method]: () => {}})
  }

  listenServerInit (method: MethodKey, listener: (param: ?Object, cbs: Object, sessionID: SessionID) => void) {
    this.serverListeners[method] = listener
  }

  _serverInitIncomingRPC (method: MethodKey, param: ?Object, response: Object) {
    const sid = this.getSessionID()
    const cbs = {
      start: callMap => {
        this.sessionIDToIncomingCall[String(sid)] = {incomingCallMap: callMap, waitingHandler: null}
        response.result(sid)
      },
      end: () => {
        delete this.sessionIDToIncomingCall[String(sid)]
      },
    }
    this.serverListeners[method](param, cbs, sid)
  }

  _rpcWrite (data: any) {
    nativeEngine.runWithData(data)
  }

  _wrapResponseOnceOnly (method: MethodKey, param: Object, response: ?Object, waitingHandler: ?WaitingHandlerType) {
    const {sessionID} = param
    const {seqid} = response || {seqid: 0}

    let once = false

    const cleanup = () => {
      delete this.sessionIDToResponse[sessionID]
      delete this.seqIDToWrappedResponse[seqid]
      if (waitingHandler) {
        waitingHandler(true, method, sessionID)
      }
    }
    const wrappedResponse = {
      cancel: () => {
        this.logLocal('Cancelling response', method, seqid, param)
        cleanup()
        once = true
      },
      result: (...args: Array<any>) => {
        if (once) {
          if (printRPC) {
            this.logLocal('RPC ▼ result bailing on additional calls: ', method, seqid, param, ...args)
          }
          return
        }
        once = true

        if (printRPC) {
          this.logLocal('RPC ▼ result: ', method, param, ...args)
        }
        if (response) {
          cleanup()
          response.result(...args)
        } else if (__DEV__) {
          console.warn('Calling response.result on non-response object: ', method)
        }
      },
      error: (...args: Array<any>) => {
        if (once) {
          if (printRPC) {
            this.logLocal('RPC ▼ error bailing on additional calls: ', method, seqid, param, ...args)
          }
          return
        }
        once = true

        if (printRPC) {
          this.logLocal('RPC ▼ error: ', method, param, ...args)
        }

        if (response) {
          cleanup()
          response.error(...args)
        } else if (__DEV__) {
          console.warn('Calling response.error on non-response object: ', method)
        }
      },
    }

    if (__DEV__ && KEYBASE_RPC_DELAY) {
      const result = wrappedResponse.result
      const error = wrappedResponse.error
      wrappedResponse.result = (...args) => {
        console.log('RPC Delayed')
        setTimeout(() => { result(...args) }, KEYBASE_RPC_DELAY)
      }
      wrappedResponse.error = (...args) => {
        console.log('RPC Delayed')
        setTimeout(() => { error(...args) }, KEYBASE_RPC_DELAY)
      }
    }

    // Incoming calls have no sessionID so let's ignore
    if (sessionID) {
      this.sessionIDToResponse[String(sessionID)] = wrappedResponse

      if (printOutstandingRPCs) {
        this.responseMeta[sessionID] = {method, param}
      }
    }

    if (seqid) {
      this.seqIDToWrappedResponse[seqid] = wrappedResponse
    }

    return wrappedResponse
  }

  _generalIncomingRpc (method: MethodKey, param: Object, response: any) {
    const listener = this.generalListeners[method]

    if (!listener) {
      return
    }

    // make wrapper so we only call this once
    const wrappedResponse = this._wrapResponseOnceOnly(method, param, response, null)
    listener(param, wrappedResponse)
  }

  _hasNoHandler (method: MethodKey, callMap: incomingCallMapType) {
    if (!callMap) {
      return this._generalIncomingRpc[method] == null
    }

    return callMap[method] == null
  }

  _rpcIncoming (payload: {method: MethodKey, param: Array<Object>, response: ?Object}) {
    const {
      method,
      param: incomingParam,
      response,
    } = payload

    const param = incomingParam && incomingParam.length ? incomingParam[0] : {}
    const {seqid, cancelled} = response || {seqid: 0, cancelled: false}

    if (cancelled) {
      const toCancel = this.seqIDToWrappedResponse[seqid]
      if (toCancel) {
        delete this.seqIDToWrappedResponse[seqid]
        toCancel.cancel()
      }

      return
    }

    const {sessionID} = param
    const {incomingCallMap, waitingHandler} = this.sessionIDToIncomingCall[String(sessionID)] || {}
    const callMap = incomingCallMap

    if (printRPC) {
      this.logLocal('RPC ◀ incoming: ', payload, seqid)
    }
    // make wrapper so we only call this once
    const wrappedResponse = this._wrapResponseOnceOnly(method, param, response, waitingHandler)

    if (callMap && callMap[method]) {
      if (waitingHandler) {
        waitingHandler(false, method, sessionID)
      }
      callMap[method](param, wrappedResponse)
    } else if (method === 'keybase.1.logUi.log' && this._hasNoHandler(method, callMap || {})) {
      log(param)
      wrappedResponse.result()
    } else if (!sessionID && this.generalListeners[method]) {
      this._generalIncomingRpc(method, param, wrappedResponse)
    } else if (!sessionID && this.serverListeners[method]) {
      this._serverInitIncomingRPC(method, param, wrappedResponse)
    } else {
      if (__DEV__) {
        this.logLocal(`Unknown incoming rpc: ${sessionID} ${method} ${seqid} ${param}${response ? ': Sending back error' : ''}`)
      }
      console.warn(`Unknown incoming rpc: ${sessionID} ${method}`)

      if (this._failOnError && __DEV__) {
        throw new Error(`unhandled incoming rpc: ${sessionID} ${method} ${JSON.stringify(param)}${response ? '. has response' : ''}`)
      }

      if (response && response.error) {
        wrappedResponse.error({
          code: constants.StatusCode.scgeneric,
          desc: `Unhandled incoming RPC ${sessionID} ${method}`,
        })
      }
    }
  }

  setFailOnError () {
    this._failOnError = true
  }

  rpc (params: {method: MethodKey, param: ?Object, incomingCallMap: incomingCallMapType, callback: () => void, waitingHandler: WaitingHandlerType}) {
    let {method, param, incomingCallMap, callback, waitingHandler} = params
    if (NO_ENGINE) {
      return
    }

    if (!param) {
      param = {}
    }

    // allow overwriting of sessionID with param.sessionID
    const sessionID = param.sessionID = param.sessionID || this.getSessionID()
    this.sessionIDToIncomingCall[String(sessionID)] = {incomingCallMap, waitingHandler}
    this.sessionIDToResponse[String(sessionID)] = null

    const invokeCallback = (err, data) => {
      if (waitingHandler) {
        waitingHandler(false, method, sessionID)
      }

      if (printRPC) {
        this.logLocal('RPC ◀', method, param, err, err && err.raw, JSON.stringify(data))
      }
      // deregister incomingCallbacks
      delete this.sessionIDToIncomingCall[String(sessionID)]
      delete this.sessionIDToResponse[String(sessionID)]
      if (callback) {
        callback(err, data)
      }
    }

    const invoke = () => {
      if (printRPC) {
        this.logLocal('RPC ▶', method, param)
      }

      if (waitingHandler) {
        waitingHandler(true, method, sessionID)
      }

      if (__DEV__ && KEYBASE_RPC_DELAY_RESULT) {
        this.rpcClient.invoke(method, [param], (err, data) => {
          setTimeout(() => invokeCallback(err, data), KEYBASE_RPC_DELAY_RESULT)
        })
      } else {
        this.rpcClient.invoke(method, [param], invokeCallback)
      }
    }

    if (__DEV__ && KEYBASE_RPC_DELAY) {
      if (printRPC) {
        this.logLocal('RPC [DELAYED] ▶', method, param)
      }
      setTimeout(invoke, KEYBASE_RPC_DELAY)
    } else {
      invoke()
    }

    return sessionID
  }

  cancelRPC (response: ?{error: () => void}, error: any) {
    if (response) {
      if (response.error) {
        response.error(error || cancelError)
      }
    } else {
      this.logLocal('Invalid response sent to cancelRPC')
    }
  }

  reset () {
    nativeEngine.reset()
  }
}

const cancelError = {
  code: constants.StatusCode.scgeneric,
  desc: 'Canceling RPC',
}

export default new Engine()
