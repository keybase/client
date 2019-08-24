const timeToConsiderActiveForAwhile = 300000
const timeToConsiderInactive = 60000

type NotifyActiveFunction = (isActive: boolean) => void
// 5 minutes after being active, consider us inactive after
// an additional minute of no input
// for the purpose of marking chat messages read
class InputMonitor {
  active = true
  notifyActive: NotifyActiveFunction
  activeTimeoutID?: number
  inactiveTimeoutID?: number

  constructor(notifyActive: NotifyActiveFunction) {
    this.notifyActive = notifyActive
    // go into listening mode again
    window.addEventListener('focus', this.goListening)
    window.addEventListener('blur', this.goInactive)
    this.goListening()
  }

  _clearTimers = () => {
    this.activeTimeoutID && window.clearTimeout(this.activeTimeoutID)
    this.activeTimeoutID = undefined

    this.inactiveTimeoutID && window.clearTimeout(this.inactiveTimeoutID)
    this.inactiveTimeoutID = undefined
  }

  resetInactiveTimer = () => {
    console.log('InputMonitor received input! Going back active')
    this.goActive()
  }

  goInactive = () => {
    console.log('InputMonitor going inactive due to 1 minute of no input')
    this._clearTimers()
    if (this.active) {
      this.active = false
      this.notifyActive(false)
    }
  }

  goListening = () => {
    console.log('InputMonitor adding input listeners after 5 active minutes')
    this._clearTimers()

    window.addEventListener('mousemove', this.resetInactiveTimer, true)
    window.addEventListener('keypress', this.resetInactiveTimer, true)

    // wait 1 minute before calling goInactive
    this.inactiveTimeoutID = window.setTimeout(this.goInactive, timeToConsiderInactive)
  }

  goActive = () => {
    this._clearTimers()
    window.removeEventListener('mousemove', this.resetInactiveTimer, true)
    window.removeEventListener('keypress', this.resetInactiveTimer, true)
    if (!this.active) {
      console.log('InputMonitor going active')
      this.active = true
      this.notifyActive(true)
    }
    // wait 5 minutes before adding listeners
    this._clearTimers()
    this.activeTimeoutID = window.setTimeout(this.goListening, timeToConsiderActiveForAwhile)
  }
}

export default InputMonitor
