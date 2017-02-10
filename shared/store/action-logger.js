// @flow
import deep from 'deep-diff'
import {Iterable} from 'immutable'
import {logStatFrequency, actionStatFrequency, forwardLogs} from '../local-debug'
import {requestIdleCallback} from '../util/idle-callback'
import {startTiming, endTiming, printTimingStats, shouldRunStats} from '../util/stats'
import {noPayloadTransformer} from '../constants/types/flux'
import {stateLogTransformer} from '../constants/reducer'

import type {StatSink} from '../util/stats'

// Transform objects from Immutable on printing
const objToJS = state => {
  var newState = {}

  Object.keys(state).forEach(i => {
    if (Iterable.isIterable(state[i])) {
      newState[i] = state[i].toJS()
    } else {
      newState[i] = state[i]
    }
  })

  return newState
}

const loggingStatSink: StatSink = {
  label: 'Action Logger',
  totalTime: 0,
  totalActions: 0,
  timings: [], // to calculate variance
  startTime: 0,
}

const actionStatSink: StatSink = {
  label: 'Actions',
  totalTime: 0,
  totalActions: 0,
  timings: [], // to calculate variance
  startTime: 0,
}

function makeActionToLog (action, oldState) {
  if (action.logTransformer) {
    try {
      return action.logTransformer(action, oldState)
    } catch (e) {
      console.warn('Action logger error', e)
    }
  }
  return noPayloadTransformer(action, oldState)
}

export const actionLogger = (store: any) => (next: any) => (action: any) => {
  const shouldRunActionStats = shouldRunStats(actionStatFrequency)
  const shouldRunLogStats = shouldRunStats(logStatFrequency)

  const oldState = store.getState()

  const actionToLog = makeActionToLog(action, oldState)
  const log1 = [`Dispatching action: ${action.type}: `, forwardLogs ? JSON.stringify(actionToLog) : actionToLog]

  startTiming(shouldRunActionStats, actionStatSink)
  const result = next(action)
  endTiming(shouldRunActionStats, actionStatSink)

  const newState = store.getState()

  startTiming(shouldRunLogStats, loggingStatSink)
  const transformer = s => objToJS(stateLogTransformer(s))
  const diff = deep.diff(transformer(oldState), transformer(newState))
  const log2 = diff ? ['Diff: ', forwardLogs ? JSON.stringify(diff) : diff] : null
  endTiming(shouldRunLogStats, loggingStatSink)

  requestIdleCallback(() => {
    console.groupCollapsed && console.groupCollapsed(`Dispatching action: ${action.type}`)
    console.log.apply(console, log1)
    log2 && console.log.apply(console, log2)
    console.groupEnd && console.groupEnd()
  }, {timeout: 5e3})

  // Make sure to print these after the groupEnd
  printTimingStats(shouldRunLogStats, loggingStatSink, true, 3)
  printTimingStats(shouldRunActionStats, actionStatSink, true, 3)

  return result
}
