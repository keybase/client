import {printOutstandingTimerListeners} from '../local-debug'
import {localLog} from './forward-logs'
import logger from '../logger'

/**
 * Shared timers for when disparate components need to
 * be kept in sync. Timers are given a key that can be
 * subscribed to. When all observers of a timer are
 * removed the timeout is cancelled and the key deleted
 */

export type SharedTimerID = number

// Global ID for refs to timers
let id: SharedTimerID = 0

type Ref = {
  fn: () => void
  id: SharedTimerID
}

type RefMap = {[K in string]: Array<Ref>}

type Timer = {
  key: string
  timeoutID: NodeJS.Timeout
}

class Timers {
  _refs: RefMap = {}
  _timers: Array<Timer> = []

  constructor(debug: boolean) {
    if (debug) {
      setInterval(() => {
        if (Object.keys(this._refs).length) {
          localLog('Outstanding shared timer listener debugger:', this._refs)
        }
      }, 10000)
    }
  }

  addObserver = (
    fn: () => void,
    {
      key,
      ms,
    }: {
      key: string
      ms?: number
    }
  ): SharedTimerID => {
    id++
    const ref = {fn, id}
    if (this._refs[key]) {
      this._refs[key].push(ref)
      return id
    } else if (!ms) {
      const msg = `SharedTimers: Tried to add timer observer with key '${key}' but no timer exists`
      logger.error(msg)
      throw new Error(`SharedTimers: Tried to add timer observer with key '${key}' but no timer exists`)
    }
    this._refs[key] = [ref]
    const timeoutID = setTimeout(() => this._handleTrigger(key), ms)
    this._timers.push({key, timeoutID})
    return id
  }

  removeObserver = (key: string, id: SharedTimerID) => {
    if (this._refs[key]) {
      const i = this._refs[key].findIndex(r => r.id === id)
      if (i >= 0) {
        this._refs[key].splice(i, 1)
        if (!this._refs[key].length) {
          delete this._refs[key]
          this._removeTimer(key)
        }
      }
    }
  }

  _removeTimer = (key: string) => {
    const i = this._timers.findIndex(t => t.key === key)
    if (i > 0) {
      clearTimeout(this._timers[i].timeoutID)
      this._timers.splice(i, 1)
    }
  }

  _handleTrigger = (key: string) => {
    if (!this._refs[key]) {
      // nobody's listening
      return
    }
    const refs = this._refs[key]
    refs.forEach(r => r.fn())
    delete this._refs[key]
    this._removeTimer(key)
  }
}

const sharedTimer = new Timers(printOutstandingTimerListeners)

export default sharedTimer
