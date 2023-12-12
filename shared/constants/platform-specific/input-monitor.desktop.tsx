const timeToConsiderActiveForAwhile = 300000
const timeToConsiderInactive = 60000

const DEBUG_LOG = __DEV__ && (false as boolean)

type NotifyActiveFunction = (isActive: boolean) => void
type Reason = 'blur' | 'focus' | 'mouseKeyboard' | 'timeout'
type State = 'appActive' | 'afterActiveCheck' | 'appInactive' | 'blurred' | 'focused'
// State machine
// appActive: User is active. In 5 minutes go to 'afterActiveCheck'. If blur go 'appInactive' immediately
// afterActiveCheck: User was 'appActive', in a window of 1 minute see if any keyboard / mouse happens. If so go to 'appInactive', else go appActive
// appInactive: Wait for focus or keyboard/mouse, then go to 'appActive'.
// blurred: App in background, wait for focus.
// focused: App in foreground but no input yet, wait for keyboard/mouse

class InputMonitor {
  notifyActive?: NotifyActiveFunction
  private state: State
  private timeoutID?: ReturnType<typeof setInterval>

  constructor() {
    window.addEventListener('focus', this.onFocus)
    window.addEventListener('blur', this.onBlur)
    this.state = 'appInactive'
    this.transition('focus')
  }

  private nextState = (reason: Reason) => {
    switch (reason) {
      case 'blur':
        return 'blurred'
      case 'focus':
        return 'focused'
      case 'mouseKeyboard':
        return 'appActive'
      case 'timeout':
        return this.state === 'appActive' ? 'afterActiveCheck' : 'appInactive'
    }
  }

  private exitState = (next: State) => {
    switch (next) {
      case 'focused':
        this.unlistenForMouseKeyboard()
        break
      case 'afterActiveCheck':
        this.unlistenForMouseKeyboard()
        break
      case 'appInactive':
        this.unlistenForMouseKeyboard()
        break
      default:
    }
  }
  private enterState = (next: State) => {
    switch (next) {
      case 'focused':
        this.listenForMouseKeyboard()
        break
      case 'blurred':
        this.notifyActive?.(false)
        break
      case 'appActive':
        this.notifyActive?.(true)
        DEBUG_LOG && console.log('InputMonitor: 5 minute timeout')
        this.timeoutID = setTimeout(() => this.transition('timeout'), timeToConsiderActiveForAwhile)
        break
      case 'afterActiveCheck':
        this.listenForMouseKeyboard()
        DEBUG_LOG && console.log('InputMonitor: 1 minute timeout')
        this.timeoutID = setTimeout(() => this.transition('timeout'), timeToConsiderInactive)
        break
      case 'appInactive':
        DEBUG_LOG && console.log('InputMonitor: Inactive')
        this.listenForMouseKeyboard()
        this.notifyActive?.(false)
        break
    }
  }

  private clearTimers = () => {
    // always kill timers
    this.timeoutID && clearTimeout(this.timeoutID)
    this.timeoutID = undefined
    DEBUG_LOG && console.log('InputMonitor: Timer cleared')
  }

  private listenerOptions = {
    capture: true,
    passive: true,
  }

  private listenForMouseKeyboard = () => {
    this.unlistenForMouseKeyboard()
    DEBUG_LOG && console.log('InputMonitor: adding mouseKeyboard events')
    window.addEventListener('mousemove', this.onMouseKeyboard, this.listenerOptions)
    window.addEventListener('keypress', this.onMouseKeyboard, this.listenerOptions)
  }

  private unlistenForMouseKeyboard = () => {
    DEBUG_LOG && console.log('InputMonitor: removing mouseKeyboard events')
    window.removeEventListener('mousemove', this.onMouseKeyboard, this.listenerOptions)
    window.removeEventListener('keypress', this.onMouseKeyboard, this.listenerOptions)
  }

  private transition = (reason: Reason) => {
    this.clearTimers()

    const nextState = this.nextState(reason)
    DEBUG_LOG && console.log('InputMonitor: transition', this.state, nextState)
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
