const timeToConsiderActiveForAwhile = 300000
const timeToConsiderInactive = 60000

type NotifyActiveFunction = (isActive: boolean) => void
type Reason = 'blur' | 'focus' | 'mouseKeyboard' | 'timeout'
type State = 'appActive' | 'afterActiveCheck' | 'appInactive'
// State machine
// appActive: User is active. In 5 minutes go to 'afterActiveCheck'. If blur go 'appInactive' immediately
// afterActiveCheck: User was 'appActive', in a window of 1 minute see if any keyboard / mouse happens. If so go to 'appInactive', else go appActive
// appInactive: Wait for focus or keyboard/mouse, then go to 'appActive'

class InputMonitor {
  notifyActive?: NotifyActiveFunction
  private state: State
  private timeoutID?: NodeJS.Timeout

  constructor() {
    window.addEventListener('focus', this.onFocus)
    window.addEventListener('blur', this.onBlur)
    this.state = 'appInactive'
    this.transition('focus')
  }

  private nextState = (reason: Reason) => {
    switch (reason) {
      case 'blur':
        return 'appInactive'
      case 'focus':
        return 'appActive'
      case 'mouseKeyboard':
        return 'appActive'
      case 'timeout':
        return this.state === 'appActive' ? 'afterActiveCheck' : 'appInactive'
    }
  }

  private exitState = (next: State) => {
    this.timeoutID && clearTimeout(this.timeoutID)
    this.timeoutID = undefined
    switch (next) {
      case 'appActive':
        break
      case 'afterActiveCheck':
        console.log('InputMonitor: removing mouseKeyboard events')
        window.removeEventListener('mousemove', this.onMouseKeyboard, true)
        window.removeEventListener('keypress', this.onMouseKeyboard, true)
        break
      case 'appInactive':
        console.log('InputMonitor: removing mouseKeyboard events')
        window.removeEventListener('mousemove', this.onMouseKeyboard, true)
        window.removeEventListener('keypress', this.onMouseKeyboard, true)
        break
    }
  }
  private enterState = (next: State) => {
    switch (next) {
      case 'appActive':
        console.log('InputMonitor: Active')
        this.notifyActive && this.notifyActive(true)
        console.log('InputMonitor: 5 minute timeout')
        this.timeoutID = setTimeout(() => this.transition('timeout'), timeToConsiderActiveForAwhile)
        break
      case 'afterActiveCheck':
        console.log('InputMonitor: after active 5 minute check')
        console.log('InputMonitor: adding mouseKeyboard events')
        window.addEventListener('mousemove', this.onMouseKeyboard, true)
        window.addEventListener('keypress', this.onMouseKeyboard, true)
        console.log('InputMonitor: 1 minute timeout')
        this.timeoutID = setTimeout(() => this.transition('timeout'), timeToConsiderInactive)
        break
      case 'appInactive':
        console.log('InputMonitor: Inactive')
        console.log('InputMonitor: adding mouseKeyboard events')
        window.addEventListener('mousemove', this.onMouseKeyboard, true)
        window.addEventListener('keypress', this.onMouseKeyboard, true)
        this.notifyActive && this.notifyActive(false)
        break
    }
  }

  private transition = (reason: Reason) => {
    const nextState = this.nextState(reason)
    console.log('InputMonitor: transition', this.state, nextState)
    if (nextState === this.state) return
    this.exitState(this.state)
    this.enterState(nextState)
    this.state = nextState
  }

  private onBlur = () => {
    this.transition('blur')
  }
  private onFocus = () => {
    this.transition('focus')
  }
  private onMouseKeyboard = () => {
    this.transition('mouseKeyboard')
  }
}

export default InputMonitor
