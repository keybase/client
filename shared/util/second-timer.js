// @flow

export opaque type TickerID: number = number

// Global ID for refs
let id: TickerID = 0

type Ref = {
  id: TickerID,
  fn: () => void,
}

class Ticker {
  refs: Array<Ref> = []
  intervalID: IntervalID

  addObserver = (fn: () => void): TickerID => {
    if (this.refs.length === 0) {
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
      if (this.refs.length === 0) {
        clearInterval(this.intervalID)
      }
      return true
    }
    return false
  }

  loop = () => {
    this.refs.forEach(r => setImmediate(r.fn))
  }
}

const ticker = new Ticker()

export function addTicker(fn: () => void) {
  return ticker.addObserver(fn)
}

export function removeTicker(id: TickerID) {
  return ticker.removeObserver(id)
}
