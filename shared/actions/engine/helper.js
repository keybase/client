// @flow
// Handles sending requests to the daemon
import * as Creators from './creators'
import {mapValues} from 'lodash'
import {RPCTimeoutError} from '../../util/errors'
import engine, {EngineChannel} from '../../engine'

import * as Saga from '../../util/saga'
import {channel, buffers, delay} from 'redux-saga'
import {call, put, cancelled, fork, join, take, cancel} from 'redux-saga/effects'

import * as SagaTypes from '../../constants/types/saga'
import * as FluxTypes from '../../constants/types/flux'

// If a sub saga returns bail early, then the rpc will bail early
const BailEarly = {type: '@@engineRPCCall:bailEarly'}
const BailedEarly = {type: '@@engineRPCCall:bailedEarly', payload: undefined}

const rpcResult = (args: any) => ({type: '@@engineRPCCall:respondResult', payload: args})
const rpcError = (args: any) => ({type: '@@engineRPCCall:respondError', payload: args})
const rpcCancel = (args: any) => ({type: '@@engineRPCCall:respondCancel', payload: args})

const _subSagaFinished = (args: any) => ({type: '@@engineRPCCall:subSagaFinished', payload: args})

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
  return function*(...args: any) {
    yield put(Creators.waitingForRpc(rpcNameKey, false))
    yield call(saga, ...args)
    yield put(Creators.waitingForRpc(rpcNameKey, true))
  }
}

// This decorator deals with responding to the rpc
function _handleRPCDecorator(rpcNameKey, saga) {
  return function*({params, response}) {
    const returnVal = yield call(saga, params)
    const payload = (returnVal || {}).payload
    if (_isResult(returnVal)) {
      yield call([response, response.result], payload)
    } else if (_isCancel(returnVal)) {
      const engineInst = yield call(engine)
      yield call([engineInst, engineInst.cancelRPC], response, payload)
    } else if (_isError(returnVal)) {
      yield call([response, response.error], payload)
    } else {
      throw new Error(`SubSaga for ${rpcNameKey} did not return a response to the rpc!`)
    }
  }
}

// This decorator to put the result on a channel
function _putReturnOnChan(chan, saga) {
  return function*(...args: any) {
    const returnVal = yield call(saga, ...args)
    yield put(chan, _subSagaFinished(returnVal))
  }
}

function passthroughResponseSaga() {
  return rpcResult()
}

class EngineRpcCall {
  _subSagas: SagaTypes.SagaMap
  _chanConfig: SagaTypes.ChannelConfig<*>
  _rpc: Function
  _rpcNameKey: string // Used for the waiting state and error messages.
  _request: any

  _subSagaChannel: SagaTypes.Channel<*>
  _engineChannel: EngineChannel
  _cleanedUp: boolean

  constructor(sagaMap: SagaTypes.SagaMap, rpc: any, rpcNameKey: string, request: any) {
    this._chanConfig = Saga.singleFixedChannelConfig(Object.keys(sagaMap))
    this._rpcNameKey = rpcNameKey
    this._rpc = rpc
    this._cleanedUp = false
    this._request = request
    this._subSagaChannel = channel(buffers.expanding(10))
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
      yield cancel(...subSagaTasks)
      this._engineChannel.close()
      this._subSagaChannel.close()
      yield put(Creators.waitingForRpc(this._rpcNameKey, false))
    } else {
      console.error('Already cleaned up')
    }
  }

  *run(timeout: ?number): Generator<any, RpcRunResult, any> {
    this._engineChannel = yield call(this._rpc, [...Object.keys(this._subSagas), 'finished'], this._request)

    const subSagaTasks: Array<any> = []
    while (true) {
      try {
        // Race against a subSaga task returning by taking on
        // We want to cancel that task if another message comes in
        // We also want to check to see if the last task tells us to bail early
        const incoming = yield call([this._engineChannel, this._engineChannel.race], {
          // If we have a task currently running, we don't want to race with the timeout
          timeout: subSagaTasks.filter(t => t.isRunning()).length ? undefined : timeout,
          racers: {subSagaFinished: take(this._subSagaChannel)},
        })

        if (incoming.timeout) {
          yield call([this, this._cleanup], subSagaTasks)
          throw new RPCTimeoutError(this._rpcNameKey, timeout)
        }

        if (incoming.finished) {
          // Wait for all the subSagas to finish
          yield join(...subSagaTasks)
          yield call([this, this._cleanup], subSagaTasks)
          const {error, params} = incoming.finished
          return finished({error, params})
        }

        const raceWinner = Object.keys(incoming)[0]
        const result = incoming[raceWinner]

        if (raceWinner === 'subSagaFinished') {
          const result = incoming.subSagaFinished.payload
          if (_isCancel(result) || _isError(result)) {
            yield call([this, this._cleanup], subSagaTasks)
            return BailedEarly
          } else {
            // Put a delay(0) so a task that is just about finished will correctly return false for .isRunning()
            yield delay(0)
            continue
          }
        }

        if (!raceWinner) {
          throw new Error('Undefined race winner', raceWinner)
        }

        // Should be impossible
        if (!this._subSagas[raceWinner]) {
          throw new Error('No subSaga to handle the raceWinner', raceWinner)
        }

        // We could have multiple things told to us!
        const subSagaTask = yield fork(this._subSagas[raceWinner], result)
        subSagaTasks.push(subSagaTask)
      } finally {
        if (yield cancelled()) {
          yield call([this, this._cleanup], subSagaTasks)
        }
      }
    }

    // This is here to make flow happy
    // But it makes eslint sad, so let's tell disable eslint
    // eslint-disable-next-line
    return BailedEarly
  }
}

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
