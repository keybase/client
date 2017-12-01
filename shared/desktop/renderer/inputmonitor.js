// @flow

type NotifyActiveFunction = (isActive: boolean) => void
// 5 minutes after being active, consider us inactive after
// an additional minute of no input
// for the purpose of marking chat messages read
class InputMonitor {
  active: boolean
  notifyActive: NotifyActiveFunction
  activeTimeoutID: ?number
  inactiveTimeoutID: ?number
  constructor(notifyActiveFunction: NotifyActiveFunction) {
    this.notifyActive = notifyActiveFunction
    this.active = true
  }

  startActiveTimer = () => {
    // wait 5 minutes before adding listeners
    if (this.activeTimeoutID) window.clearTimeout(this.activeTimeoutID)
    this.activeTimeoutID = window.setTimeout(this.goListening, 300000)
  }

  resetInactiveTimer = () => {
    this.goActive()
  }

  goInactive = () => {
    console.log('InputMonitor going inactive due to 1 minute of no input')
    window.clearTimeout(this.inactiveTimeoutID)
    this.inactiveTimeoutID = 0
    if (this.active) {
      this.notifyActive(false)
      this.active = false
    }
  }

  goListening = () => {
    console.log('InputMonitor adding input listeners after 5 active minutes')
    window.clearTimeout(this.activeTimeoutID)

    window.addEventListener('mousemove', this.resetInactiveTimer, true)
    window.addEventListener('keypress', this.resetInactiveTimer, true)

    // wait 1 minute before calling goInactive
    if (this.inactiveTimeoutID) window.clearTimeout(this.inactiveTimeoutID)
    this.inactiveTimeoutID = window.setTimeout(this.goInactive, 60000)
  }

  goActive = () => {
    window.clearTimeout(this.inactiveTimeoutID)
    this.inactiveTimeoutID = 0
    window.removeEventListener('mousemove', this.resetInactiveTimer, true)
    window.removeEventListener('keypress', this.resetInactiveTimer, true)
    if (!this.active) {
      console.log('InputMonitor going active')
      this.notifyActive(true)
      this.active = true
    }
    this.startActiveTimer()
  }
}

export default InputMonitor
