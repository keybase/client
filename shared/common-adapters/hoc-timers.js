// @flow
import * as React from 'react'

type TimerProps = {
  setTimeout: (func: () => void, timing: number) => TimeoutID,
  clearTimeout: (id: TimeoutID) => void,
  setInterval: (func: () => void, timing: number) => IntervalID,
  clearInterval: (id: IntervalID) => void,
}

// TODO couldn't figure out a quick way to type this correctly
// type OptionalProps = {
// innerRef?: ?(?React.Component<any>) => void,
// }

// Use this to mix your props with timer props like type Props = PropsWithTimer<{foo: number}>
export type PropsWithTimer<P> = {|
  ...$Exact<P>,
  ...$Exact<TimerProps>,
|}

function getDisplayName(WrappedComponent): string {
  return WrappedComponent.displayName || WrappedComponent.name || 'Component'
}

function HOCTimers<Props: TimerProps>(
  WrappedComponent: React.ComponentType<Props>
): React.ComponentType<$Diff<Props, TimerProps>> {
  class TimersComponent extends React.Component<$Diff<Props, TimerProps>> {
    static displayName = `HOCTimers(${getDisplayName(WrappedComponent)})`
    _timeoutIds: Array<TimeoutID> = []
    _intervalIds: Array<IntervalID> = []

    setTimeout = (f, n) => {
      const id = setTimeout(f, n)
      this._timeoutIds.push(id)
      return id
    }

    clearTimeout = id => {
      if ((id || id === 0) && this._timeoutIds.includes(id)) {
        this._timeoutIds.splice(this._timeoutIds.indexOf(id), 1)
        clearTimeout(id)
      }
    }

    setInterval = (f, n) => {
      const id = setInterval(f, n)
      this._intervalIds.push(id)
      return id
    }

    clearInterval = id => {
      if ((id || id === 0) && this._intervalIds.includes(id)) {
        this._intervalIds.splice(this._intervalIds.indexOf(id), 1)
        clearInterval(id)
      }
    }

    componentWillUnmount() {
      this._timeoutIds.forEach(clearTimeout)
      this._intervalIds.forEach(clearInterval)
    }

    render() {
      // $FlowIssue TODO type this
      const innerRef = (this.props.innerRef: any)
      return (
        <WrappedComponent
          {...this.props}
          ref={innerRef}
          setTimeout={this.setTimeout}
          setInterval={this.setInterval}
          clearInterval={this.clearInterval}
          clearTimeout={this.clearTimeout}
        />
      )
    }
  }

  return TimersComponent
}

export default HOCTimers
