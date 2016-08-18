// @flow
import React from 'react'

export type TimerFunc = (func: () => void, timing: number) => number
export type ClearTimerFunc = (id?: ?number) => void
export type TimerProps = {
  setTimeout: TimerFunc,
  clearTimeout: ClearTimerFunc,
  setInterval: TimerFunc,
  clearInterval: ClearTimerFunc,
}

function clearId (clearFunc: (id: number) => void, array: Array<number>, id?: ?number): void {
  if ((id || id === 0) && array.includes(id)) {
    array.splice(array.indexOf(id), 1)
    clearFunc(id)
  }
}

const HOCTimers = (ComposedComponent: ReactClass<*>): ReactClass<TimerProps> => class extends React.Component {
  _timeoutIds: Array<number>
  _intervalIds: Array<number>
  _timerFuncs: TimerProps

  constructor (props: any) {
    super(props)
    this._timeoutIds = []
    this._intervalIds = []
    this._timerFuncs = {
      setTimeout: (f, n) => {
        const id = setTimeout(f, n)
        this._timeoutIds.push(id)
        return id
      },
      clearTimeout: (id) => { clearId(clearTimeout, this._timeoutIds, id) },
      setInterval: (f, n) => {
        const id = setInterval(f, n)
        this._intervalIds.push(id)
        return id
      },
      clearInterval: (id) => { clearId(clearInterval, this._intervalIds, id) },
    }
  }

  componentWillUnmount () {
    this._timeoutIds.forEach(clearTimeout)
    this._intervalIds.forEach(clearInterval)
  }

  render () {
    return <ComposedComponent {...this.props} {...this._timerFuncs} />
  }
}

export default HOCTimers
