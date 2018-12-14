// @flow
import * as React from 'react'

type GlobalProps = {
  children: ?React.Node,
}

type Props = {
  onKeyDown: (ev: KeyboardEvent) => void,
  children: ?React.Node,
}

type HandlerProps = {
  // eslint-disable-next-line no-use-before-define
  add: (receiver: KeyDownHandler) => void,
  // eslint-disable-next-line no-use-before-define
  remove: (receiver: KeyDownHandler) => void,
}

const KeyDownContext = React.createContext<HandlerProps>({
  add: () => {},
  remove: () => {},
})

class KeyDownHandlerWrapper extends React.Component<Props> {
  render() {
    return (
      <KeyDownContext.Consumer>
        {({add, remove}) => <KeyDownHandler {...this.props} add={add} remove={remove} />}
      </KeyDownContext.Consumer>
    )
  }
}

class KeyDownHandler extends React.Component<Props & HandlerProps> {
  componentDidMount() {
    this.props.add(this)
  }

  componentWillUnmount() {
    this.props.remove(this)
  }

  onKeyDown(ev) {
    this.props.onKeyDown(ev)
  }

  render() {
    return this.props.children || null
  }
}

class GlobalKeyDownHandler extends React.Component<GlobalProps> {
  _stack: Array<KeyDownHandler> = []

  componentDidMount() {
    const body = document.body
    if (!body) {
      return
    }
    body.addEventListener('keydown', this._handleKeyDown)
    body.addEventListener('keypress', this._handleKeyDown)
  }

  componentWillUnmount() {
    const body = document.body
    if (!body) {
      return
    }
    body.removeEventListener('keydown', this._handleKeyDown)
    body.removeEventListener('keypress', this._handleKeyDown)
  }

  _handleKeyDown = (ev: KeyboardEvent) => {
    if (this._stack.length === 0) {
      return
    }
    const top = this._stack[this._stack.length - 1]
    top.onKeyDown(ev)
  }

  add = (receiver: KeyDownHandler) => {
    this._stack.push(receiver)
  }

  remove = (receiver: KeyDownHandler) => {
    const idx = this._stack.indexOf(receiver)
    if (idx !== -1) {
      this._stack.splice(idx, 1)
    }
  }

  render() {
    return (
      <KeyDownContext.Provider value={{add: this.add, remove: this.remove}}>
        {this.props.children}
      </KeyDownContext.Provider>
    )
  }
}

export {GlobalKeyDownHandler}
export default KeyDownHandlerWrapper
