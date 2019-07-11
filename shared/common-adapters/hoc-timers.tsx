import * as React from 'react'

type TimerProps = {
  setTimeout: (func: () => void, timing: number) => NodeJS.Timeout
  clearTimeout: (id: NodeJS.Timeout) => void
  setInterval: (func: () => void, timing: number) => NodeJS.Timeout
  clearInterval: (id: NodeJS.Timeout) => void
}

// Use this to mix your props with timer props like type Props = PropsWithTimer<{foo: number}>
export type PropsWithTimer<P> = TimerProps & P
export type PropsWithoutTimer<P> = Exclude<P, TimerProps>

function getDisplayName(Component): string {
  return Component.displayName || Component.name || 'Component'
}

function hOCTimers<PropsWithoutTimerProps, RefInstance>(
  Component: React.ComponentType<PropsWithoutTimerProps & TimerProps>
): React.ForwardRefExoticComponent<
  React.PropsWithoutRef<PropsWithoutTimerProps> & React.RefAttributes<RefInstance>
> {
  type HOCTimersProps = {
    forwardedRef: React.Ref<RefInstance>
  } & React.PropsWithChildren<PropsWithoutTimerProps>

  class HOCTimers extends React.Component<HOCTimersProps> {
    static displayName = `HOCTimers(${getDisplayName(Component)})`
    _timeoutIds: Array<NodeJS.Timeout> = []
    _intervalIds: Array<NodeJS.Timeout> = []

    setTimeout = (f, n: number) => {
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
        // @ts-ignore this HOC will probably be hook-ified pretty soon
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

  return React.forwardRef<RefInstance, PropsWithoutTimerProps>((props, ref) => (
    <HOCTimers {...props} forwardedRef={ref} />
  ))
}

export default hOCTimers
