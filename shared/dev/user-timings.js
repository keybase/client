// @noflow
import {userTimings} from '../local-debug'

const perf = typeof performance !== 'undefined' && performance // eslint-disable-line
const mark = perf && perf.mark.bind(perf)
const measure = perf && perf.measure.bind(perf)
const clearMarks = perf && perf.clearMarks.bind(perf)
const clearMeasures = perf && perf.clearMeasures.bind(perf)

const allowTiming = __DEV__ && userTimings && mark && measure
const markPrefix = '🔑'
const measureStart = allowTiming
  ? (name: string) => {
      mark(name)
    }
  : () => {}
const measureStop = allowTiming
  ? (name: string) => {
      const measureName = `${markPrefix} ${name}`
      try {
        measure(measureName, name)
      } catch (_) {}
      clearMarks(name)
      clearMeasures(measureName)
    }
  : () => {}
const timingWrap = (name, call) => {
  return (...args) => {
    measureStart(name)
    const ret = call(...args)
    measureStop(name)
    return ret
  }
}
const infect = allowTiming
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
  : () => {}
const endSaga = effectId => {
  const markName = `${markPrefix} saga:${effectId}`
  const name = `${markPrefix} saga:${effectIdToLabel[effectId]}`
  try {
    measure(name, markName)
  } catch (_) {}
  clearMarks(markName)
  clearMeasures(name)
}
const getLabel = obj => {
  let label
  try {
    if (obj.effect.saga) {
      label = obj.effect && obj.effect.saga && obj.effect.saga.name
    } else if (Array.isArray(obj.effect)) {
      label = obj.effect.map(effect => getLabel({effect})).join(':')
    } else if (obj.effect.ALL) {
      label = obj.effect.ALL.map(effect => getLabel({effect})).join(':')
    } else if (obj.effect.FORK) {
      label = obj.effect.FORK.fn && obj.effect.FORK.fn.name
    } else if (obj.effect.CALL) {
      const contextName =
        (obj.effect.CALL.context &&
          obj.effect.CALL.context.constructor &&
          obj.effect.CALL.context.constructor.name) ||
        ''
      const fnName = (obj.effect.CALL.fn && obj.effect.CALL.fn.name) || ''
      label = `${contextName}:${fnName}`
    } else if (obj.effect.SELECT) {
      label = obj.effect.SELECT.selector.name || `select:${obj.effectId}`
    } else if (obj.effect.RACE) {
      label = `race:${Object.keys(obj.effect.RACE).join(':')}`
    } else if (obj.effect.JOIN) {
      label = obj.effect.JOIN.name
    } else if (obj.effect.TAKE) {
      label =
        obj.effect.TAKE.pattern ||
        (obj.effect.TAKE.channel &&
          obj.effect.TAKE.channel.userTimingName &&
          `take:${obj.effect.TAKE.channel.userTimingName}`)
    } else if (obj.effect.CANCELLED) {
      label = `cancelled:${obj.effectId}`
    } else if (obj.effect.CANCEL) {
      label = obj.effect.CANCEL.name
    } else if (obj.effect.ACTION_CHANNEL) {
      label = obj.effect.ACTION_CHANNEL.pattern
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
const effectIdToLabel = {}
const sagaTimer = allowTiming
  ? {
      actionDispatched: () => {},
      effectCancelled: endSaga,
      effectRejected: endSaga,
      effectResolved: endSaga,
      effectTriggered: desc => {
        effectIdToLabel[desc.effectId] = getLabel(desc)
        mark(`${markPrefix} saga:${desc.effectId}`)
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
infect()
export {sagaTimer, reducerTimer, measureStart, measureStop, allowTiming}
