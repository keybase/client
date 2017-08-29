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
    this.activeTimeoutID = window.setTimeout(this.goListening, 15000)
  }

  resetInactiveTimer = () => {
    window.clearTimeout(this.inactiveTimeoutID)
    this.goActive()
  }

  goInactive = () => {
    console.log('Going inactive due to 1 minute of no input')
    window.clearTimeout(this.inactiveTimeoutID)
    if (this.active) {
      this.notifyActive(false)
      this.active = false
    }
  }

  goListening = () => {
    console.log('Adding input listeners after 5 active minutes')
    window.clearTimeout(this.activeTimeoutID)

    window.addEventListener('mousemove', this.resetInactiveTimer, true)
    window.addEventListener('keypress', this.resetInactiveTimer, true)

    // wait 1 minute before calling goInactive
    this.inactiveTimeoutID = window.setTimeout(this.goInactive, 5000)
  }

  goActive = () => {
    window.removeEventListener('mousemove', this.resetInactiveTimer, true)
    window.removeEventListener('keypress', this.resetInactiveTimer, true)
    if (!this.active) {
      this.notifyActive(true)
      this.active = true
    }
    this.startActiveTimer()
  }
}

export default InputMonitor
