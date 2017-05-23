// @flow
// Handles sending requests to the daemon
import * as Creators from './creators'
import {mapValues} from 'lodash'
import {RPCTimeoutError} from '../../util/errors'
import engine, {EngineChannel} from '../../engine'

import * as Saga from '../../util/saga'
import {call, put, cancelled, fork, join} from 'redux-saga/effects'

import * as SagaTypes from '../../constants/types/saga'
import * as FluxTypes from '../../constants/types/flux'

// If a sub saga returns bail early, then the rpc will bail early
const BailEarly = {type: '@@engineRPCCall:bailEarly'}
const BailedEarly = {type: '@@engineRPCCall:bailedEarly', payload: undefined}

const rpcResult = (args: any) => ({type: '@@engineRPCCall:respondResult', payload: args})
const rpcError = (args: any) => ({type: '@@engineRPCCall:respondError', payload: args})
const rpcCancel = (args: any) => ({type: '@@engineRPCCall:respondCancel', payload: args})

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

function passthroughResponseSaga() {
  return rpcResult()
}

class EngineRpcCall {
  _subSagas: SagaTypes.SagaMap
  _chanConfig: SagaTypes.ChannelConfig<*>
  _rpc: Function
  _rpcNameKey: string // Used for the waiting state and error messages.
  _request: any

  _engineChannel: EngineChannel
  _cleanedUp: boolean

  constructor(sagaMap: SagaTypes.SagaMap, rpc: any, rpcNameKey: string, request: any) {
    this._chanConfig = Saga.singleFixedChannelConfig(Object.keys(sagaMap))
    this._rpcNameKey = rpcNameKey
    this._rpc = rpc
    this._cleanedUp = false
    this._request = request
    // $FlowIssue with this
    this.run = this.run.bind(this) // In case we mess up and forget to do call([ctx, ctx.run])
    const {finished: finishedSaga, ...subSagas} = sagaMap
    if (finishedSaga) {
      throw new Error(
        'Passed in a finished saga that will never be used. Instead the result of .run() will give you finished'
      )
    }
    const decoratedSubSagas = mapValues(subSagas, saga =>
      _sagaWaitingDecorator(rpcNameKey, _handleRPCDecorator(rpcNameKey, saga))
    )

    this._subSagas = decoratedSubSagas
  }

  *_cleanup(lastTask: ?any): Generator<any, any, any> {
    if (!this._cleanedUp) {
      this._cleanedUp = true
      // TODO should we respond to the pending rpc with error if we hit this?
      lastTask && lastTask.cancel()
      this._engineChannel.close()
      yield put(Creators.waitingForRpc(this._rpcNameKey, false))
    } else {
      console.error('Already cleaned up')
    }
  }

  *run(timeout: ?number): Generator<any, RpcRunResult, any> {
    this._engineChannel = yield call(this._rpc, [...Object.keys(this._subSagas), 'finished'], this._request)

    let lastTask: ?any = null
    while (true) {
      try {
        // If we have a lastTask, let's also race that.
        // We want to cancel that task if another message comes in
        // We also want to check to see if the last task tells us to bail early
        const incoming = yield call([this._engineChannel, this._engineChannel.race], {
          // If we have a task currently running, we don't want to race with the timeout
          timeout: lastTask ? undefined : timeout,
          racers: lastTask ? {lastTask: join(lastTask)} : {},
        })

        console.log('DEBUG: incoming is', incoming)

        if (incoming.timeout) {
          yield call([this, this._cleanup], lastTask)
          throw new RPCTimeoutError(this._rpcNameKey, timeout)
        }

        if (incoming.finished) {
          yield call([this, this._cleanup], lastTask)
          const {error, params} = incoming.finished
          return finished({error, params})
        }

        const raceWinner = Object.keys(incoming)[0]
        const result = incoming[raceWinner]

        if (raceWinner === 'lastTask') {
          const result = incoming.lastTask
          if (_isCancel(result) || _isError(result)) {
            yield call([this, this._cleanup], lastTask)
            return BailedEarly
          } else {
            lastTask = null
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
        lastTask = yield fork(this._subSagas[raceWinner], result)
      } finally {
        if (yield cancelled()) {
          yield call([this, this._cleanup], lastTask)
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
