import * as React from 'react'
import {AppState, type AppStateStatus} from 'react-native'

type Sample = {
  actualDuration: number
  baseDuration: number
  commitTime: number
  id: string
  phase: string
  startTime: number
}

type ComponentStats = {
  avgMs: number
  maxMs: number
  mountCount: number
  totalMs: number
  updateCount: number
}

type ProfilerResult = {
  components: {[id: string]: ComponentStats}
  totalDurationMs: number
  totalRenders: number
}

const samples: Array<Sample> = []

let listenerAdded = false

function addAppStateListener() {
  if (listenerAdded) return
  listenerAdded = true
  AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'background') {
      flushProfiler()
    }
  })
}

function aggregate(): ProfilerResult {
  const components: {[id: string]: ComponentStats} = {}
  let totalRenders = 0
  let totalDurationMs = 0

  for (const s of samples) {
    let stats = components[s.id]
    if (!stats) {
      stats = {avgMs: 0, maxMs: 0, mountCount: 0, totalMs: 0, updateCount: 0}
      components[s.id] = stats
    }
    if (s.phase === 'mount') {
      stats.mountCount++
    } else {
      stats.updateCount++
    }
    stats.totalMs += s.actualDuration
    stats.maxMs = Math.max(stats.maxMs, s.actualDuration)
    totalRenders++
    totalDurationMs += s.actualDuration
  }

  for (const stats of Object.values(components)) {
    const count = stats.mountCount + stats.updateCount
    stats.avgMs = count > 0 ? Math.round((stats.totalMs / count) * 100) / 100 : 0
    stats.totalMs = Math.round(stats.totalMs * 100) / 100
    stats.maxMs = Math.round(stats.maxMs * 100) / 100
  }

  return {
    components,
    totalDurationMs: Math.round(totalDurationMs * 100) / 100,
    totalRenders,
  }
}

function flushProfiler() {
  if (samples.length === 0) return
  const result = aggregate()
  console.log('PERF_REACT_PROFILER:' + JSON.stringify(result))
}

export function resetProfiler() {
  samples.length = 0
}

const onRender = (
  id: string,
  phase: string,
  actualDuration: number,
  baseDuration: number,
  startTime: number,
  commitTime: number
) => {
  samples.push({actualDuration, baseDuration, commitTime, id, phase, startTime})
}

export const PerfProfiler = (props: {children: React.ReactNode; id: string}): React.ReactElement | null => {
  if (!__DEV__) return props.children as React.ReactElement

  addAppStateListener()
  return (
    <React.Profiler id={props.id} onRender={onRender}>
      {props.children}
    </React.Profiler>
  )
}
