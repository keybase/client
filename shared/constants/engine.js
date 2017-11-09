// @flow
// Handles sending requests to the daemon
import * as EngineGen from '../actions/engine-gen'
import * as FluxTypes from './types/flux'
import * as I from 'immutable'
import * as Saga from '../util/saga'
import * as SagaTypes from './types/saga'
import * as Types from '../engine/types'
import {getEngine, EngineChannel} from '../engine'
import mapValues from 'lodash/mapValues'
import {RPCTimeoutError} from '../util/errors'

// If a sub saga returns bail early, then the rpc will bail early
const BailEarly = {type: '@@engineRPCCall:bailEarly'}
const BailedEarly = {type: '@@engineRPCCall:bailedEarly', payload: undefined}

const rpcResult = <T>(payload: T): {type: '@@engineRPCCall:respondResult', payload: T} => ({
  type: '@@engineRPCCall:respondResult',
  payload,
})
const rpcError = <T>(payload: T): {type: '@@engineRPCCall:respondError', payload: T} => ({
  type: '@@engineRPCCall:respondError',
  payload,
})
const rpcCancel = <T>(payload: T): {type: '@@engineRPCCall:respondCancel', payload: T} => ({
  type: '@@engineRPCCall:respondCancel',
  payload,
})

const _subSagaFinished = payload => ({type: '@@engineRPCCall:subSagaFinished', payload})

const _isResult = ({type} = {}) => type === '@@engineRPCCall:respondResult'
const _isError = ({type} = {}) => type === '@@engineRPCCall:respondError'
const _isCancel = ({type} = {}) => type === '@@engineRPCCall:respondCancel'

type Finished = FluxTypes.NoErrorTypedAction<
  '@@engineRPCCall:finished',
  {
    error: ?any,
    params: ?any,
  }
>

const finished = ({error, params}) => ({type: '@@engineRPCCall:finished', payload: {error, params}})
const isFinished = (a: any) => a.type === '@@engineRPCCall:finished'

type RpcRunResult = Finished | FluxTypes.NoErrorTypedAction<'@@engineRPCCall:bailedEarly', void>

function _sagaWaitingDecorator(rpcNameKey, saga) {
  return function* _sagaWaitingDecoratorHelper(...args: any) {
    yield Saga.put(EngineGen.createWaitingForRpc({name: rpcNameKey, waiting: false}))
    // $FlowIssue has no way to type this
    yield Saga.call(saga, ...args)
    yield Saga.put(EngineGen.createWaitingForRpc({name: rpcNameKey, waiting: true}))
  }
}

// This decorator deals with responding to the rpc
function _handleRPCDecorator(rpcNameKey, saga) {
  return function* _handleRPCDecoratorHelper({params, response}) {
    const returnVal = yield Saga.call(saga, params)
    const payload = (returnVal || {}).payload
    if (_isResult(returnVal)) {
      yield Saga.call([response, response.result], payload)
    } else if (_isCancel(returnVal)) {
      const engineInst = yield Saga.call(getEngine)
      yield Saga.call([engineInst, engineInst.cancelRPC], response, payload)
    } else if (_isError(returnVal)) {
      yield Saga.call([response, response.error], payload)
    } else {
      throw new Error(`SubSaga for ${rpcNameKey} did not return a response to the rpc!`)
    }
  }
}

// This decorator to put the result on a channel
function _putReturnOnChan(chan, saga) {
  return function* _putReturnOnChanHelper(...args: any) {
    // $FlowIssue has no way to type this
    const returnVal = yield Saga.call(saga, ...args)
    yield Saga.put(chan, _subSagaFinished(returnVal))
  }
}

function passthroughResponseSaga() {
  return rpcResult()
}

type P = {|sessionID: number, existingDevices?: ?Array<string>, errorMessage: string|}
type R = Generator<
  any,

    | {type: '@@engineRPCCall:respondResult', payload: string}
    | {type: '@@engineRPCCall:respondError', payload: Types.RPCErrorHandler}
    | null,
  any
>
type TEMP = {
  'keybase.1.provisionUi.PromptNewDeviceName': (params: P) => R,
  'finished'?: void,
}

class EngineRpcCall {
  _subSagas: SagaTypes.SagaMap
  _chanConfig: SagaTypes.ChannelConfig<*>
  _makeRequest: (configKeys: Array<string>) => EngineChannel
  _rpcNameKey: string // Used for the waiting state and error messages.

  _subSagaChannel: SagaTypes.Channel<*>
  _engineChannel: EngineChannel
  _cleanedUp: boolean

  constructor(sagaMap: TEMP, rpcNameKey: string, makeRequest: (configKeys: Array<string>) => EngineChannel) {
    this._chanConfig = Saga.singleFixedChannelConfig(Object.keys(sagaMap))
    this._rpcNameKey = rpcNameKey
    this._makeRequest = makeRequest
    this._cleanedUp = false
    this._subSagaChannel = Saga.channel(Saga.buffers.expanding(10))
    // $FlowIssue with this
    this.run = this.run.bind(this) // In case we mess up and forget to do call([ctx, ctx.run])
    const {finished: finishedSaga, ...subSagas} = sagaMap
    if (finishedSaga) {
      throw new Error(
        'Passed in a finished saga that will never be used. Instead the result of .run() will give you finished'
      )
    }
    const decoratedSubSagas = mapValues(subSagas, saga =>
      _putReturnOnChan(
        this._subSagaChannel,
        _sagaWaitingDecorator(rpcNameKey, _handleRPCDecorator(rpcNameKey, saga))
      )
    )

    this._subSagas = decoratedSubSagas
  }

  *_cleanup(subSagaTasks: Array<any>): Generator<any, any, any> {
    if (!this._cleanedUp) {
      this._cleanedUp = true
      // TODO(mm) should we respond to the pending rpc with error if we hit this?
      // Nojima and Marco think it's okay for now - maybe discuss with core what we should do.
      if (subSagaTasks.length) {
        yield Saga.cancel(...subSagaTasks)
      }
      this._engineChannel.close()
      this._subSagaChannel.close()
      yield Saga.put(EngineGen.createWaitingForRpc({name: this._rpcNameKey, waiting: false}))
    } else {
      console.error('Already cleaned up')
    }
  }

  *run(timeout: ?number): Generator<any, RpcRunResult, any> {
    this._engineChannel = yield Saga.call(this._makeRequest, [...Object.keys(this._subSagas), 'finished'])

    const subSagaTasks: Array<any> = []
    while (true) {
      try {
        // Race against a subSaga task returning by taking on
        // We want to cancel that task if another message comes in
        // We also want to check to see if the last task tells us to bail early
        const incoming = yield Saga.call([this._engineChannel, this._engineChannel.race], {
          // If we have a task currently running, we don't want to race with the timeout
          timeout: subSagaTasks.filter(t => t.isRunning()).length ? undefined : timeout,
          racers: {subSagaFinished: Saga.take(this._subSagaChannel)},
        })

        if (incoming.timeout) {
          yield Saga.call([this, this._cleanup], subSagaTasks)
          throw new RPCTimeoutError(this._rpcNameKey, timeout)
        }

        if (incoming.finished) {
          // Wait for all the subSagas to finish
          if (subSagaTasks.length) {
            yield Saga.join(...subSagaTasks)
          }
          yield Saga.call([this, this._cleanup], subSagaTasks)
          const {error, params} = incoming.finished
          return finished({error, params})
        }

        const raceWinner = Object.keys(incoming)[0]
        const result = incoming[raceWinner]

        if (raceWinner === 'subSagaFinished') {
          const result = incoming.subSagaFinished.payload
          if (_isCancel(result) || _isError(result)) {
            yield Saga.call([this, this._cleanup], subSagaTasks)
            return BailedEarly
          } else {
            // Put a delay(0) so a task that is just about finished will correctly return false for .isRunning()
            yield Saga.delay(0)
            continue
          }
        }

        if (!raceWinner) {
          throw new Error(`Undefined race winner ${raceWinner}`)
        }

        // Should be impossible
        if (!this._subSagas[raceWinner]) {
          throw new Error(`No subSaga to handle the raceWinner ${raceWinner}`)
        }

        // We could have multiple things told to us!
        // $FlowIssue has no way to type this
        const subSagaTask = yield Saga.fork(this._subSagas[raceWinner], result)
        subSagaTasks.push(subSagaTask)
      } finally {
        if (yield Saga.cancelled()) {
          yield Saga.call([this, this._cleanup], subSagaTasks)
        }
      }
    }

    // This is here to make flow happy
    // But it makes eslint sad, so let's tell disable eslint
    // eslint-disable-next-line
    return BailedEarly
  }
}

type _State = {
  rpcWaitingStates: I.Map<string, boolean>,
}
export type State = I.RecordOf<_State>
export const makeState: I.RecordFactory<_State> = I.Record({
  rpcWaitingStates: I.Map(),
})

export {
  EngineRpcCall,
  isFinished,
  BailEarly,
  BailedEarly,
  rpcResult,
  rpcCancel,
  rpcError,
  passthroughResponseSaga,
}
