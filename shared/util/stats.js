// @flow
import {requestIdleCallback} from './idle-callback'
// Print stats. Useful for perf analysis

export type StatSink = {
  label: string,
  totalTime: number,
  totalActions: number,
  timings: Array<number>, // to calculate variance
  startTime: number,
}
export function startTiming(shouldRun: boolean, statSink: StatSink) {
  if (shouldRun) {
    statSink.startTime = Date.now()
  }
}

export function endTiming(shouldRun: boolean, statSink: StatSink) {
  if (shouldRun && statSink.startTime) {
    const diffTime = Date.now() - statSink.startTime
    statSink.timings.push(diffTime)
    statSink.totalTime += diffTime
    statSink.totalActions++
  }
}

export function printTimingStats(
  shouldRun: boolean,
  statSink: StatSink,
  warnOnSlowPokes?: boolean,
  stdDevThreshold?: number
) {
  if (statSink.totalTime > 0 && statSink.totalActions > 0 && shouldRun) {
    const mean = statSink.totalTime / statSink.totalActions
    const variance =
      statSink.timings
        .map(t => Math.pow(t - mean, 2))
        .reduce((acc, t) => t + acc, 0) /
      (statSink.totalActions - 1)
    const stdDev = Math.sqrt(variance)
    const lastTiming = statSink.timings[statSink.timings.length - 1]

    requestIdleCallback(() => {
      console.groupCollapsed &&
        console.groupCollapsed(`Stats on ${statSink.label}`)
      console.log('Total Time:', statSink.totalTime)
      console.log('Total Actions:', statSink.totalActions)
      console.log('Average Time/Actions:', mean)
      console.log('Std Dev:', stdDev)
      console.groupEnd && console.groupEnd()

      if (
        warnOnSlowPokes &&
        stdDevThreshold &&
        lastTiming - mean > stdDevThreshold * stdDev
      ) {
        console.log('Last timing was super slow!!')
      }
    })
  }
}

// Decide whether we should run the stats, give a percentage of the form 0.xx range: [0, 1]
export function shouldRunStats(frequency: number): boolean {
  if (__DEV__ && Math.random() < frequency) {
    return true
  }
  return false
}
