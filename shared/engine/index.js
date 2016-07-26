// Handles sending requests to native mobile (then go) and back

import engine from './index.native'
import Transport from './transport'
import rpc from 'framed-msgpack-rpc'
import {printRPC, printOutstandingRPCs} from '../local-debug'
import setupLocalLogs from '../util/local-log'
import {Buffer} from 'buffer'
import NativeEventEmitter from '../common-adapters/native-event-emitter'
import {log} from '../native/log/logui'
import {constants} from '../constants/types/keybase-v1'

const {client: {Client: RpcClient}} = rpc

const NO_ENGINE = process.env.KEYBASE_NO_ENGINE
if (NO_ENGINE) {
  console.log('Engine disabled!')
}

class Engine {
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

    this.program = 'keybase.1'

    if (!NO_ENGINE) {
      this.rpcClient = new RpcClient(
        new Transport(
          payload => {
            if (__DEV__ && process.env.KEYBASE_RPC_DELAY_RESULT) {
              setTimeout(() => this._rpcIncoming(payload), process.env.KEYBASE_RPC_DELAY_RESULT)
            } else {
              this._rpcIncoming(payload)
            }
          },
          this._rpcWrite,
          () => this._onConnect()
        ),
        this.program
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

  listenOnConnect (key, f) {
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
    this.subscription = NativeEventEmitter.addListener(
      engine.eventName,
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
  listenGeneralIncomingRpc (params) {
    Object.keys(params).forEach(method => {
      this.generalListeners[method] = params[method]
    })
  }

  removeGeneralIncomingRpc (method) {
    this.listenGeneralIncomingRpc({[method]: () => {}})
  }

  listenServerInit (method, listener) {
    this.serverListeners[method] = listener
  }

  _serverInitIncomingRPC (method, param, response) {
    const sid = this.getSessionID()
    const cbs = {
      start: callMap => {
        this.sessionIDToIncomingCall[sid] = {incomingCallMap: callMap, waitingHandler: null}
        response.result(sid)
      },
      end: () => {
        delete this.sessionIDToIncomingCall[sid]
      },
    }
    this.serverListeners[method](param, cbs, sid)
  }

  _rpcWrite (data) {
    engine.runWithData(data)
  }

  _wrapResponseOnceOnly (method, param, response, waitingHandler) {
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
      result: (...args) => {
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
      error: (...args) => {
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

    if (__DEV__ && process.env.KEYBASE_RPC_DELAY) {
      const result = wrappedResponse.result
      const error = wrappedResponse.error
      wrappedResponse.result = (...args) => {
        console.log('RPC Delayed')
        setTimeout(() => { result(...args) }, process.env.KEYBASE_RPC_DELAY)
      }
      wrappedResponse.error = (...args) => {
        console.log('RPC Delayed')
        setTimeout(() => { error(...args) }, process.env.KEYBASE_RPC_DELAY)
      }
    }

    // Incoming calls have no sessionID so let's ignore
    if (sessionID) {
      this.sessionIDToResponse[sessionID] = wrappedResponse

      if (printOutstandingRPCs) {
        this.responseMeta[sessionID] = {method, param}
      }
    }

    if (seqid) {
      this.seqIDToWrappedResponse[seqid] = wrappedResponse
    }

    return wrappedResponse
  }

  _generalIncomingRpc (method, param, response) {
    const listener = this.generalListeners[method]

    if (!listener) {
      return
    }

    // make wrapper so we only call this once
    const wrappedResponse = this._wrapResponseOnceOnly(method, param, response)
    listener(param, wrappedResponse)
  }

  _hasNoHandler (method, callMap, generalIncomingRpcMap) {
    if (!callMap) {
      return generalIncomingRpcMap[method] == null
    }

    return callMap[method] == null
  }

  _rpcIncoming (payload) {
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

    const {incomingCallMap, waitingHandler} = this.sessionIDToIncomingCall[sessionID] || {}
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
    } else if (method === 'keybase.1.logUi.log' && this._hasNoHandler(method, callMap || {}, this._generalIncomingRpc)) {
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

  // Make an RPC and call callbacks in the incomingCallMap
  // (name of call, {arguments object}, {methodName: function(params, response)}, function(err, data), function(waiting, method, sessionID)
  // Use rpc() instead
  rpcUnchecked (method, param, incomingCallMap, callback, waitingHandler) {
    if (NO_ENGINE) {
      return
    }

    if (!param) {
      param = {}
    }

    // allow overwriting of sessionID with param.sessionID
    const sessionID = param.sessionID = param.sessionID || this.getSessionID()
    this.sessionIDToIncomingCall[sessionID] = {incomingCallMap, waitingHandler}
    this.sessionIDToResponse[sessionID] = null

    const invokeCallback = (err, data) => {
      if (waitingHandler) {
        waitingHandler(false, method, sessionID)
      }

      if (printRPC) {
        this.logLocal('RPC ◀', method, param, err, err && err.raw, JSON.stringify(data))
      }
      // deregister incomingCallbacks
      delete this.sessionIDToIncomingCall[sessionID]
      delete this.sessionIDToResponse[sessionID]
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

      if (__DEV__ && process.env.KEYBASE_RPC_DELAY_RESULT) {
        this.rpcClient.invoke(method, [param], (err, data) => {
          setTimeout(() => invokeCallback(err, data), process.env.KEYBASE_RPC_DELAY_RESULT)
        })
      } else {
        this.rpcClient.invoke(method, [param], invokeCallback)
      }
    }

    if (__DEV__ && process.env.KEYBASE_RPC_DELAY) {
      if (printRPC) {
        this.logLocal('RPC [DELAYED] ▶', method, param)
      }
      setTimeout(invoke, process.env.KEYBASE_RPC_DELAY)
    } else {
      invoke()
    }

    return sessionID
  }

  rpc (params) {
    const {method, param, incomingCallMap, callback, waitingHandler} = params
    return this.rpcUnchecked(method, param, incomingCallMap, callback, waitingHandler)
  }

  cancelRPC (response, error) {
    if (response) {
      if (response.error) {
        response.error(error || cancelError)
      }
    } else {
      this.logLocal('Invalid response sent to cancelRPC')
    }
  }

  reset () {
    engine.reset()
  }
}

const cancelError = {
  code: constants.StatusCode.scgeneric,
  desc: 'Canceling RPC',
}

export function isRPCCancelError (err) {
  return err && err.code === cancelError.code && err.message === cancelError.message
}

export default new Engine()
