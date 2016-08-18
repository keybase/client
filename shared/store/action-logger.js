// @flow

import {Iterable} from 'immutable'
import deep from 'deep-diff'
import {logStatFrequency, actionStatFrequency, forwardLogs, allowSkipLogging} from '../local-debug'
import {startTiming, endTiming, printTimingStats, shouldRunStats} from '../util/stats'

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

export const actionLogger = (store: any) => (next: any) => (action: any) => {
  const shouldRunActionStats = shouldRunStats(actionStatFrequency)
  if (true || action.skipLogging && allowSkipLogging) {
    startTiming(shouldRunActionStats, actionStatSink)
    const result = next(action)
    endTiming(shouldRunActionStats, actionStatSink)
    printTimingStats(shouldRunActionStats, actionStatSink, true, 3)
    return result
  }

  console.groupCollapsed && console.groupCollapsed(`Dispatching action: ${action.type}`)

  console.log(`Dispatching action: ${action.type}: `, forwardLogs ? JSON.stringify(action) : action)

  const shouldRunLogStats = shouldRunStats(logStatFrequency)

  const oldState = store.getState()

  startTiming(shouldRunActionStats, actionStatSink)
  const result = next(action)
  endTiming(shouldRunActionStats, actionStatSink)

  const newState = store.getState()

  startTiming(shouldRunLogStats, loggingStatSink)
  const diff = deep.diff(objToJS(oldState), objToJS(newState))
  console.log('Diff:', forwardLogs ? JSON.stringify(diff) : diff)
  endTiming(shouldRunLogStats, loggingStatSink)

  console.groupEnd && console.groupEnd()

  // Make sure to print these after the groupEnd
  printTimingStats(shouldRunLogStats, loggingStatSink, true, 3)
  printTimingStats(shouldRunActionStats, actionStatSink, true, 3)
  return result
}
