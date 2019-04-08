import * as React from 'react'

type TimerProps = {
  setTimeout: (func: () => void, timing: number) => number | void,
  clearTimeout: (id: number) => void | void,
  setInterval: (func: () => void, timing: number) => number | void,
  clearInterval: (id: number) => void | void
};

// Use this to mix your props with timer props like type Props = PropsWithTimer<{foo: number}>
export type PropsWithTimer<P> = {
  setTimeout: (func: () => void, timing: number) => number,
  clearTimeout: (id: number) => void,
  setInterval: (func: () => void, timing: number) => number,
  clearInterval: (id: number) => void
} & P;

function getDisplayName(Component): string {
  return Component.displayName || Component.name || 'Component'
}

function hOCTimers<Config extends {}, Instance>(Component: React.AbstractComponent<Config, Instance>): React.AbstractComponent<Exclude<Config, TimerProps>, Instance> {
  type HOCTimersProps = {
    forwardedRef: React.Ref<React.AbstractComponent<Config, Instance>>
  } & Exclude<Config, TimerProps>;

  class HOCTimers extends React.Component<HOCTimersProps> {
    static displayName = `HOCTimers(${getDisplayName(Component)})`
    _timeoutIds: Array<number> = [];
    _intervalIds: Array<number> = [];

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
