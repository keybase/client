// @noflow
// TODO Deprecated. Instead use engine/saga helper
// Handles sending requests to the daemon
import logger from '../logger'
import * as Saga from '../util/saga'
import {mapValues, forEach} from 'lodash-es'
import {getEngine} from '../engine/require'

export type Buffer<T> = {
  isEmpty: () => boolean,
  put: (msg: T) => void,
  take: () => T,
}

export type Channel<T> = {
  take: (cb: (msg: T) => void) => void,
  put: (msg: T) => void,
  close: () => void,
}

export type ChannelConfig<T> = {
  [key: string]: () => Buffer<T>,
}

export type ChannelMap<T> = {
  [key: string]: Channel<T>,
}

export type SagaMap = {
  // $FlowIssue with returning Generators from functions
  [key: string]: Generator<*, *, *>,
}

export class EngineChannel {
  _map: ChannelMap<any>
  _sessionID: SessionID
  _configKeys: Array<string>

  constructor(map: ChannelMap<any>, sessionID: SessionID, configKeys: Array<string>) {
    this._map = map
    this._sessionID = sessionID
    this._configKeys = configKeys
  }

  getMap(): ChannelMap<any> {
    return this._map
  }

  close() {
    closeChannelMap(this._map)
    getEngine().cancelSession(this._sessionID)
  }

  *take(key: string): Generator<any, any, any> {
    return yield takeFromChannelMap(this._map, key)
  }

  *race(options: ?{timeout?: number, racers?: Object}): Generator<any, any, any> {
    const timeout = options && options.timeout
    const otherRacers = (options && options.racers) || {}
    const initMap = {
      ...(timeout
        ? {
            timeout: Saga.call(Saga.delay, timeout),
          }
        : {}),
      ...otherRacers,
    }

    const raceMap = this._configKeys.reduce((map, key) => {
      map[key] = takeFromChannelMap(this._map, key)
      return map
    }, initMap)

    const result = yield Saga.race(raceMap)

    if (result.timeout) {
      this.close()
    }

    return result
  }
}

type RpcRunResult = any

// If a sub saga returns bail early, then the rpc will bail early
const BailedEarly = {payload: undefined, type: '@@engineRPCCall:bailedEarly'}

const rpcResult = (args: any) => ({payload: args, type: '@@engineRPCCall:respondResult'})
const rpcError = (args: any) => ({payload: args, type: '@@engineRPCCall:respondError'})
const rpcCancel = (args: any) => ({payload: args, type: '@@engineRPCCall:respondCancel'})

const _subSagaFinished = (args: any) => ({payload: args, type: '@@engineRPCCall:subSagaFinished'})

const _isResult = ({type} = {}) => type === '@@engineRPCCall:respondResult'
const _isError = ({type} = {}) => type === '@@engineRPCCall:respondError'
const _isCancel = ({type} = {}) => type === '@@engineRPCCall:respondCancel'

const finished = ({error, params}) => ({payload: {error, params}, type: '@@engineRPCCall:finished'})
const isFinished = (a: any) => a.type === '@@engineRPCCall:finished'

function _sagaWaitingDecorator(rpcNameKey, saga, waitingAction) {
  return function* _sagaWaitingDecoratorHelper(...args: any) {
    if (waitingAction) {
      yield Saga.put(waitingAction(false))
    }
    // $FlowIssue has no way to type this
    yield Saga.call(saga, ...args)
    if (waitingAction) {
      yield Saga.put(waitingAction(true))
    }
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
    const returnVal = yield Saga.call(saga, ...args)
    yield Saga.put(chan, _subSagaFinished(returnVal))
  }
}

function passthroughResponseSaga() {
  return rpcResult()
}

class EngineRpcCall {
  _subSagas: SagaMap
  _chanConfig: ChannelConfig<any>
  _rpc: Function
  _rpcNameKey: string // Used for the waiting state and error messages.
  _request: any

  _subSagaChannel: Saga.Channel
  _engineChannel: EngineChannel
  _cleanedUp: boolean
  _finishedErrorShouldCancel: boolean
  _waitingActionCreator: ?(waiting: boolean) => any

  constructor(
    sagaMap: SagaMap,
    rpc: any,
    rpcNameKey: string,
    request: any,
    finishedErrorShouldCancel?: ?boolean,
    waitingActionCreator?: (waiting: boolean) => any
  ) {
    this._chanConfig = singleFixedChannelConfig(Object.keys(sagaMap))
    this._rpcNameKey = rpcNameKey
    this._rpc = rpc
    this._cleanedUp = false
    this._request = request
    this._finishedErrorShouldCancel = finishedErrorShouldCancel || false
    this._subSagaChannel = Saga.channel(Saga.buffers.expanding(10))
    this._waitingActionCreator = waitingActionCreator
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
      if (this._waitingActionCreator) {
        const action = this._waitingActionCreator(false)
        if (action) {
          yield Saga.put(action)
        }
      }
    } else {
      logger.error('Already cleaned up')
    }
  }

  *run(timeout: ?number): Generator<any, RpcRunResult, any> {
    this._engineChannel = yield Saga.call(
      this._rpc,
      [...Object.keys(this._subSagas), 'finished'],
      this._request
    )

    if (this._waitingActionCreator) {
      const action = this._waitingActionCreator(true)
      if (action) {
        yield Saga.put(action)
      }
    }

    const subSagaTasks: Array<any> = []
    while (true) {
      try {
        // Race against a subSaga task returning by taking on
        // We want to cancel that task if another message comes in
        // We also want to check to see if the last task tells us to bail early
        const incoming = yield Saga.call([this._engineChannel, this._engineChannel.race], {
          // If we have a task currently running, we don't want to race with the timeout
          racers: {subSagaFinished: Saga.take(this._subSagaChannel)},
          timeout: subSagaTasks.filter(t => t.isRunning()).length ? undefined : timeout,
        })

        if (incoming.timeout) {
          yield Saga.call([this, this._cleanup], subSagaTasks)
          throw new Error(
            `RPC timeout error on ${this._rpcNameKey}. Had a ttl of: ${timeout || 'Undefined timeout'}`
          )
        }

        if (incoming.finished) {
          // Used just by device add for now. This is to fix a bug and I'm not sure this should apply generally
          if (incoming.finished.error && this._finishedErrorShouldCancel) {
            yield Saga.call([this, this._cleanup], subSagaTasks)
            const {error, params} = incoming.finished
            return finished({error, params})
          }
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
        const subSagaTask = yield Saga._fork(this._subSagas[raceWinner], result)
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

export function singleFixedChannelConfig<T>(ks: Array<string>): ChannelConfig<T> {
  return ks.reduce((acc, k) => {
    acc[k] = () => Saga.buffers.expanding(1)
    return acc
  }, {})
}

export function closeChannelMap<T>(channelMap: ChannelMap<T>): void {
  forEach(channelMap, c => c.close())
}

export function putOnChannelMap<T>(channelMap: ChannelMap<T>, k: string, v: T): void {
  const c = channelMap[k]
  if (c) {
    c.put(v)
  } else {
    logger.error('Trying to put, but no registered channel for', k)
  }
}

export function effectOnChannelMap<T>(effectFn: any, channelMap: ChannelMap<T>, k: string): any {
  const c = channelMap[k]
  if (c) {
    return effectFn(c)
  } else {
    logger.error('Trying to do effect, but no registered channel for', k)
  }
}

export function takeFromChannelMap<T>(channelMap: ChannelMap<T>, k: string): any {
  return effectOnChannelMap(Saga.take, channelMap, k)
}

export function createChannelMap<T>(channelConfig: ChannelConfig<T>): ChannelMap<T> {
  return mapValues(channelConfig, (v, k) => {
    const ret = Saga.channel(v())
    // to help debug what's going on in dev/user-timings
    // $ForceType
    ret.userTimingName = k
    return ret
  })
}

export {EngineRpcCall, isFinished, BailedEarly, rpcResult, rpcCancel, rpcError, passthroughResponseSaga}
