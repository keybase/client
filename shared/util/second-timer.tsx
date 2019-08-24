import {printOutstandingTimerListeners} from '../local-debug'
import {localLog} from './forward-logs'

/**
 * A synchronized clock that ticks once every second
 * Instantiates one global timer and keeps it running as long
 * as there are any listeners. Listening functions will be
 * invoked on every tick.
 */

export type TickerID = number

// Global ID for refs
let id: TickerID = 0

// Counter for printing outstanding timers
let logCounter = 0

type Ref = {
  id: TickerID
  fn: () => void
}

class Ticker {
  refs: Array<Ref> = []
  intervalID: NodeJS.Timeout | undefined

  addObserver = (fn: () => void): TickerID => {
    if (!this.intervalID) {
      this.intervalID = setInterval(this.loop, 1000)
    }
    id++
    this.refs.push({fn, id})
    return id
  }

  removeObserver = (id: TickerID) => {
    const index = this.refs.findIndex(r => r.id === id)
    if (index >= 0) {
      this.refs.splice(index, 1)
      if (this.refs.length === 0 && this.intervalID) {
        clearInterval(this.intervalID)
        this.intervalID = undefined
      }
      return true
    }
    return false
  }

  loop = () => {
    this.refs.forEach(r => r.fn())
    if (printOutstandingTimerListeners) {
      logCounter++
      if (logCounter % 10 === 0 && this.refs.length > 0) {
        // 10 seconds
        localLog('Outstanding second timer listener debugger:', this.refs)
      }
    }
  }
}

const ticker = new Ticker()

export function addTicker(fn: () => void) {
  return ticker.addObserver(fn)
}

export function removeTicker(id: TickerID) {
  return ticker.removeObserver(id)
}
