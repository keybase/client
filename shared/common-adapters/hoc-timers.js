// @flow
import * as React from 'react'

// duplicating this from the .flow file as we don't pull in those files for rn
type TimerProps = {
  setTimeout: (func: () => void, timing: number) => TimeoutID,
  clearTimeout: (id: TimeoutID) => void,
  setInterval: (func: () => void, timing: number) => IntervalID,
  clearInterval: (id: IntervalID) => void,
}

function getDisplayName(WrappedComponent): string {
  return WrappedComponent.displayName || WrappedComponent.name || 'Component'
}

export default function HOCTimers(ComposedComponent: any) {
  class TimersComponent extends React.Component<any> {
    static displayName = `HOCTimers(${getDisplayName(ComposedComponent)})`
    _timeoutIds: Array<TimeoutID>
    _intervalIds: Array<IntervalID>
    _timerFuncs: TimerProps

    constructor(props: any) {
      super(props)
      this._timeoutIds = []
      this._intervalIds = []
      this._timerFuncs = {
        setTimeout: (f, n) => {
          const id = setTimeout(f, n)
          this._timeoutIds.push(id)
          return id
        },
        clearTimeout: id => {
          if ((id || id === 0) && this._timeoutIds.includes(id)) {
            this._timeoutIds.splice(this._timeoutIds.indexOf(id), 1)
            clearTimeout(id)
          }
        },
        setInterval: (f, n) => {
          const id = setInterval(f, n)
          this._intervalIds.push(id)
          return id
        },
        clearInterval: id => {
          if ((id || id === 0) && this._intervalIds.includes(id)) {
            this._intervalIds.splice(this._intervalIds.indexOf(id), 1)
            clearInterval(id)
          }
        },
      }
    }

    componentWillUnmount() {
      this._timeoutIds.forEach(clearTimeout)
      this._intervalIds.forEach(clearInterval)
    }

    render() {
      return <ComposedComponent {...this.props} {...this._timerFuncs} />
    }
  }

  return TimersComponent
}
