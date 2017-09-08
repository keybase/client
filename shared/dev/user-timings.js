// @flow
import {reduxTimings} from '../local-debug'

const perf = typeof performance !== 'undefined' && performance // eslint-disable-line
const mark = perf && perf.mark.bind(perf)
const measure = perf && perf.measure.bind(perf)

const allowTiming = __DEV__ && reduxTimings && mark && measure

const timingWrap = (prefix, call) => {
  return (...args) => {
    mark(prefix + 'Start')
    const ret = call(...args)
    mark(prefix + 'End')
    measure(prefix + 'Dur', prefix + 'Start', prefix + 'End')
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
          mapStateToProps ? timingWrap(`🔑 state${ident}:`, mapStateToProps) : null,
          mapDispatchToProps ? timingWrap(`🔑 disp${ident}:`, mapDispatchToProps) : null,
          mergeProps ? timingWrap(`🔑 merge${ident}:`, mergeProps) : null,
          options
        )
      }
      redux.connect = wrappedConnect
    }
  : () => {}
const endSaga = effectId => {
  mark(`🔑 sagaEnd${effectId}`)
  measure(`🔑 saga:${effectIdToLabel[effectId]}`, `🔑 sagaStart${effectId}`, `🔑 sagaEnd${effectId}`)
}
const getLabel = obj => {
  let label
  try {
    if (obj.effect.saga) {
      label = obj.effect && obj.effect.saga && obj.effect.saga.name
    } else if (Array.isArray(obj.effect)) {
      label = obj.effect.map(effect => getLabel({effect})).join(':')
    } else if (obj.effect.FORK) {
      label = obj.effect.FORK.fn && obj.effect.FORK.fn.name
    } else if (obj.effect.CALL) {
      label = obj.effect.CALL.fn && obj.effect.CALL.fn.name
    } else if (obj.effect.SELECT) {
      label = obj.effect.SELECT.selector.name
    } else if (obj.effect.TAKE) {
      label = obj.effect.TAKE.pattern
    } else if (obj.effect.CANCEL) {
      label = obj.effect.CANCEL.name
    } else if (obj.effect.PUT) {
      label = obj.effect.PUT.action && obj.effect.PUT.action.payload && obj.effect.PUT.action.payload.type
    }
  } catch (err) {}
  return label || obj.effectId
}
const effectIdToLabel = {}
const sagaTimer = allowTiming
  ? {
      effectTriggered: desc => {
        effectIdToLabel[desc.effectId] = getLabel(desc)
        mark(`🔑 sagaStart${desc.effectId}`)
      },
      effectResolved: endSaga,
      effectRejected: endSaga,
      effectCancelled: endSaga,
      actionDispatched: () => {},
    }
  : null
infect()
export {sagaTimer}
