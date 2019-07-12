// The first emoji should stay on screen for less time so the user has a better chance of seeing it.
// Set the interval after a shorter initial delay.
// Convenience wrapper around interval + timeout
class DelayInterval {
  _intervalMS: number
  _delayMS: number

  _intervalID?: NodeJS.Timer
  _delayID?: NodeJS.Timer

  constructor(intervalMS: number, delayMS: number) {
    this._intervalMS = intervalMS
    this._delayMS = delayMS
  }
  start(fcn: () => void) {
    if (this.running()) {
      return
    }
    this._delayID = setTimeout(() => {
      fcn()
      this._intervalID = setInterval(fcn, this._intervalMS)
    }, this._delayMS)
  }
  stop() {
    this._delayID && clearTimeout(this._delayID)
    this._delayID = undefined
    this._intervalID && clearInterval(this._intervalID)
    this._intervalID = undefined
  }
  running() {
    return !!(this._delayID || this._intervalID)
  }
}

export default DelayInterval
