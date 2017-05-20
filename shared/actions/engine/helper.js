// @flow
// Handles sending requests to the daemon
import * as Creators from './creators'
import {mapValues} from 'lodash'
import {RPCTimeoutError} from '../../util/errors'

import * as Saga from '../../util/saga'
import {channel} from 'redux-saga'
import {call, put, cancelled, fork, join} from 'redux-saga/effects'

import * as SagaTypes from '../../constants/types/saga'

// If a sub saga returns bail early, then the rpc will bail early
const BailEarly = {type: '@@engineRPCCall:bailEarly'}
const BailedEarly = {type: '@@engineRPCCall:bailedEarly'}

const FinishedType = '@@engineRPCCall:finished'
const finished = ({error, params}) => ({type: FinishedType, payload: {error, params}})
const isFinished = a => a.type === FinishedType

class EngineRpcCall {
  _subSagas: SagaTypes.SagaMap<*>
  _chanMap: SagaTypes.ChannelMap<*>
  _chanConfig: SagaTypes.ChannelConfig<*>
  _sessionID: SessionID
  _configKeys: Array<string>
  _rpc: Function
  // TODO can we figure this out?
  _rpcName: string

  _errorChan: Channel<Error>
  _finishedChan: Channel<Error>
  _engineChannel: EngineChannel

  _cleanedUp: boolean

  constructor(sagaMap: SagaTypes.SagaMap, rpc, rpcName) {
    this._chanConfig = Saga.singleFixedChannelConfig(Object.keys(sagaMap))
    this._rpcName = rpcName
    this._rpc = rpc
    this._errorChan = channel()
    this._finishedChan = channel()
    this._cleanedUp = false
    const {finished: finishedSaga, ...subSagas} = sagaMap
    if (finishedSaga) {
      throw new Error(
        'Passed in a finished saga that will never be used. Instead the result of .run() will give you finished'
      )
    }
    const decoratedSubSagas = mapValues(subSagas, saga => this._sagaWaitingDecorator(rpcName, saga))

    this._subSagas = decoratedSubSagas
  }

  *_handleErrorInSaga(error: Error) {
    yield put(this._errorChan, error)
  }

  _sagaWaitingDecorator(rpcName, saga) {
    return function*(...args) {
      yield put(Creators.waitingForRpc(rpcName, false))
      yield call(saga, ...args)
      yield put(Creators.waitingForRpc(rpcName, true))
    }
  }

  _finishedWithRpc({result, params}) {
    // yield put(this._finishedChan, error)
  }

  *_cleanup(lastTask: ?any) {
    if (!this._cleanedUp) {
      this._cleanedUp = true
      lastTask && lastTask.cancel()
      this._engineChannel.close()
      this._errorChan.close()
      this._finishedChan.close()
      yield put(Creators.waitingForRpc(this._rpcName, false))
    } else {
      console.error('Already cleaned up')
    }
  }

  *run(request, options: ?{timeout: number}) {
    this._engineChannel = yield call(this._rpc, [...Object.keys(this._subSagas), 'finished'], request)

    let lastTask: ?any = null
    while (true) {
      try {
        // TODO what happens if lastTask throws an error?

        // If we have a lastTask, let's also race that.
        // We want to cancel that task if another message comes in
        // We also want to check to see if the last task tells us to bail early
        const incoming = yield call([this._engineChannel, this._engineChannel.race], {
          ...options,
          racers: lastTask ? {lastTask: join(lastTask)} : {},
        })

        console.log('DEBUG: incoming is', incoming)

        if (incoming.timeout) {
          yield call([this, this._cleanup], lastTask)
          throw new RPCTimeoutError(
            this._rpcName,
            options && options.timeout ? options.timeout : 'Undefined ttl'
          )
        }

        if (incoming.finished) {
          yield call([this, this._cleanup], lastTask)
          const {error, params} = incoming.finished
          return finished({error, params})
        }

        const raceWinner = Object.keys(incoming)[0]
        const result = incoming[raceWinner]

        if (raceWinner === 'lastTask') {
          if (incoming.lastTask === BailEarly) {
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
          debugger
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
  }
}

export {EngineRpcCall, isFinished, BailEarly, BailedEarly}
