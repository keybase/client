// @flow
import * as React from 'react'

type TimerProps = {|
  setTimeout: ((func: () => void, timing: number) => TimeoutID) | void,
  clearTimeout: ((id: TimeoutID) => void) | void,
  setInterval: ((func: () => void, timing: number) => IntervalID) | void,
  clearInterval: ((id: IntervalID) => void) | void,
|}

// Use this to mix your props with timer props like type Props = PropsWithTimer<{foo: number}>
export type PropsWithTimer<P> = {|
  ...$Exact<P>,
  setTimeout: (func: () => void, timing: number) => TimeoutID,
  clearTimeout: (id: TimeoutID) => void,
  setInterval: (func: () => void, timing: number) => IntervalID,
  clearInterval: (id: IntervalID) => void,
|}

function getDisplayName(Component): string {
  return Component.displayName || Component.name || 'Component'
}

function hOCTimers<Config: {}, Instance>(
  Component: React.AbstractComponent<Config, Instance>
): React.AbstractComponent<$Diff<Config, TimerProps>, Instance> {
  type HOCTimersProps = {|
    ...$Exact<$Diff<Config, TimerProps>>,
    forwardedRef: React.Ref<React.AbstractComponent<Config, Instance>>,
  |}

  class HOCTimers extends React.Component<HOCTimersProps> {
    static displayName = `HOCTimers(${getDisplayName(Component)})`
    _timeoutIds: Array<TimeoutID> = []
    _intervalIds: Array<IntervalID> = []

    setTimeout = (f, n) => {
      const id = setTimeout(f, n)
      this._timeoutIds.push(id)
      return id
    }

    clearTimeout = id => {
      if (id && this._timeoutIds.includes(id)) {
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
      if (id && this._intervalIds.includes(id)) {
        this._intervalIds.splice(this._intervalIds.indexOf(id), 1)
        clearInterval(id)
      }
    }

    componentWillUnmount() {
      this._timeoutIds.forEach(clearTimeout)
      this._intervalIds.forEach(clearInterval)
    }

    render() {
      const {forwardedRef, ...rest} = this.props
      return (
        <Component
          ref={forwardedRef}
          {...rest}
          setTimeout={this.setTimeout}
          setInterval={this.setInterval}
          clearInterval={this.clearInterval}
          clearTimeout={this.clearTimeout}
        />
      )
    }
  }

  return React.forwardRef<Config, Instance>((props, ref) => <HOCTimers {...props} forwardedRef={ref} />)
}

export default hOCTimers
