/*
 * This file injects performance marks using the performance api (see the chrome timeline view). It:
 * --- We don't do this anymore -- 1. Monkeypatches redux connect to time mapStateToProps, mapDispatchToProps, mergeProps helpers
 * 2. Exports a saga monitor to time effect durations
 * 3. Exports a redux combine reducers alternative which times each sub reducer
 * 4. Exports a generic measuring function (measureStart, measureStop) to help add your own for debugging sessions
 */
import {userTimings} from '../local-debug'

const perf = typeof performance !== 'undefined' && performance // eslint-disable-line
const mark = perf && perf.mark && perf.mark.bind(perf)
const measure = perf && perf.measure && perf.measure.bind(perf)
const clearMarks = perf && perf.clearMarks && perf.clearMarks.bind(perf)
const clearMeasures = perf && perf.clearMeasures && perf.clearMeasures.bind(perf)
const allowTiming = __DEV__ && userTimings && mark && measure
const markPrefix = '\uD83D\uDD11' // key unicode. inlining this actually screws up prettier so i had to escape it

const noop = () => {}

const measureStart = allowTiming
  ? (name: string) => {
      mark && mark(name)
    }
  : noop

const measureStop = allowTiming
  ? (name: string) => {
      const measureName = `${markPrefix} ${name}`
      try {
        // measure can throw if you mention something it hasn't seen
        measure && measure(measureName, name)
      } catch (_) {}
      clearMarks && clearMarks(name)
      clearMeasures && clearMeasures(measureName)
    }
  : noop

// const timingWrap = (name, call) => {
// return (...args) => {
// measureStart(name)
// const ret = call(...args)
// measureStop(name)
// return ret
// }
// }

// TODO maybe bring this back after webpack 4. Haven't really used this too much
const _infect = /* allowTiming
  ? () => {
      console.log(
        '\n\n\n-=============================== Running user timings!!! ===============================-'
      )
      const redux = require('react-redux')
      const _connect = redux.connect
      let connectCount = 1
      const wrappedConnect = (mapStateToProps, mapDispatchToProps, mergeProps, options) => {
        const ident = String(connectCount)
        connectCount++
        return _connect(
          mapStateToProps ? timingWrap(`redux:state:${ident}`, mapStateToProps) : null,
          mapDispatchToProps ? timingWrap(`redux:disp:${ident}`, mapDispatchToProps) : null,
          mergeProps ? timingWrap(`redux:merge:${ident}`, mergeProps) : null,
          options
        )
      }
      redux.connect = wrappedConnect
    }
  : */ noop

const _endSaga = effectId => {
  const markName = `${markPrefix} saga:${effectId}`
  const name = `${markPrefix} saga:${_effectIdToLabel[effectId]}`
  try {
    measure && measure(name, markName)
  } catch (_) {}
  clearMarks && clearMarks(markName)
  clearMeasures && clearMeasures(name)
}

const _getLabel = obj => {
  let label
  try {
    // Try and extract a useful name from saga events
    if (!obj.effect) {
      label = obj.effectId
    } else if (obj.effect.saga) {
      label = obj.effect && obj.effect.saga && obj.effect.saga.name
    } else if (Array.isArray(obj.effect)) {
      label = obj.effect.map(effect => _getLabel({effect})).join(':')
    } else if (obj.effect.ALL) {
      label = `all:${obj.effect.ALL.map(effect => _getLabel({effect})).join(':')}`
    } else if (obj.effect.FORK) {
      label = `fork:${obj.effect.FORK.fn && obj.effect.FORK.fn.name}`
    } else if (obj.effect.CALL) {
      const contextName =
        (obj.effect.CALL.context &&
          obj.effect.CALL.context.constructor &&
          obj.effect.CALL.context.constructor.name) ||
        ''
      const fnName = (obj.effect.CALL.fn && obj.effect.CALL.fn.name) || ''
      label = `call:${contextName}:${fnName}`
    } else if (obj.effect.SELECT) {
      label = obj.effect.SELECT.selector.name || `select:${obj.effectId}`
    } else if (obj.effect.RACE) {
      label = `race:${Object.keys(obj.effect.RACE).join(':')}`
    } else if (obj.effect.JOIN) {
      label = `join:${obj.effect.JOIN.name}`
    } else if (obj.effect.TAKE) {
      label =
        (obj.effect.TAKE.pattern && `take:${obj.effect.TAKE.pattern}`) ||
        (obj.effect.TAKE.channel &&
          obj.effect.TAKE.channel.userTimingName &&
          `take:${obj.effect.TAKE.channel.userTimingName}`)
    } else if (obj.effect.CANCELLED) {
      label = `cancelled:${obj.effectId}`
    } else if (obj.effect.CANCEL) {
      label = `cancel:${obj.effect.CANCEL.name}`
    } else if (obj.effect.ACTION_CHANNEL) {
      label = `actionchannel:${obj.effect.ACTION_CHANNEL.pattern}`
    } else if (obj.effect instanceof Promise) {
      label = `promise:${obj.effectId}`
    } else if (obj.effect.PUT) {
      label =
        (obj.effect.PUT.action && obj.effect.PUT.action.type) ||
        (obj.effect.PUT.action && obj.effect.PUT.action.name) ||
        (typeof obj.effect.PUT.action === 'function' && `put:${obj.effectId}`)
    }
  } catch (err) {}
  return label || obj.effectId
}

const _effectIdToLabel = {}

const sagaTimer = allowTiming
  ? {
      actionDispatched: () => {},
      effectCancelled: _endSaga,
      effectRejected: _endSaga,
      effectResolved: _endSaga,
      effectTriggered: desc => {
        _effectIdToLabel[desc.effectId] = _getLabel(desc)
        if (desc.effect && desc.effect.TAKE) {
          return
        }
        mark && mark(`${markPrefix} saga${desc.effectId}`)
      },
    }
  : null

const reducerTimer = allowTiming
  ? finalReducers => {
      const finalReducerKeys = Object.keys(finalReducers)
      return function combination(state = {}, action) {
        let hasChanged = false
        const nextState = {}
        for (let i = 0; i < finalReducerKeys.length; i++) {
          const key = finalReducerKeys[i]
          const reducer = finalReducers[key]
          const previousStateForKey = state[key]
          const name = `reducer:${key}`
          measureStart(name)
          const nextStateForKey = reducer(previousStateForKey, action)
          measureStop(name)
          nextState[key] = nextStateForKey
          hasChanged = hasChanged || nextStateForKey !== previousStateForKey
        }
        return hasChanged ? nextState : state
      }
    }
  : null

// auto monkey patch
_infect()

export {sagaTimer, reducerTimer, measureStart, measureStop, allowTiming}
