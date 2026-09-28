// Delayed scrolling a thread list owns. Every timer and every async loop a list starts runs through
// one of these, so stopping it, or the list unmounting or being hidden, leaves nothing to fire later.
import * as React from 'react'

export type Scheduled = {
  cancel: () => void
  pending: () => boolean
}

// A stop drops a sleeping job: its sleep never resolves, or resolves false when the stop lands between
// the sleep's timer and the job resuming.
export type Sleep = (ms: number) => Promise<boolean>

export type Schedule = {
  after: (delay: number, fn: () => void) => Scheduled
  // Runs an async job whose sleeps belong to this schedule. The job returns when a sleep resolves false.
  start: (job: (sleep: Sleep) => Promise<void>) => void
  stop: () => void
}

export const makeSchedule = (): Schedule => {
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let epoch = 0
  const after = (delay: number, fn: () => void): Scheduled => {
    const id = setTimeout(() => {
      timers.delete(id)
      fn()
    }, delay)
    timers.add(id)
    return {
      cancel: () => {
        clearTimeout(id)
        timers.delete(id)
      },
      pending: () => timers.has(id),
    }
  }
  const start = (job: (sleep: Sleep) => Promise<void>) => {
    const startedIn = epoch
    const sleep: Sleep = async ms => {
      await new Promise<void>(resolve => after(ms, resolve))
      return epoch === startedIn
    }
    void job(sleep)
  }
  const stop = () => {
    epoch++
    timers.forEach(clearTimeout)
    timers.clear()
  }
  return {after, start, stop}
}

// Stopped whenever the list's effects unmount: it unmounting, or being hidden under Activity.
export const useSchedule = () => {
  const [schedule] = React.useState(makeSchedule)
  React.useEffect(() => schedule.stop, [schedule])
  return schedule
}
