// @flow

// The first emoji should stay on screen for less time so the user has a better chance of seeing it.
// Set the interval after a shorter initial delay.
// Convenience wrapper around interval + timeout
class DelayInterval {
  _intervalMS: number
  _delayMS: number

  _intervalID: IntervalID
  _delayID: TimeoutID

  running: boolean

  constructor(intervalMS: number, delayMS: number) {
    this._intervalMS = intervalMS
    this._delayMS = delayMS
  }
  start(fcn: () => void) {
    if (this.running) {
      return
    }
    this.running = true
    this._delayID = setTimeout(() => {
      fcn()
      this._intervalID = setInterval(fcn, this._intervalMS)
    }, this._delayMS)
  }
  stop() {
    this.running = false
    clearTimeout(this._delayID)
    clearInterval(this._intervalID)
  }
}

export default DelayInterval
