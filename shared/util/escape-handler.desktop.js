// @flow
import * as React from 'react'

type GlobalProps = {
  children: ?React.Node,
}

type Props = {
  onESC: ?() => void,
  children: ?React.Node,
}

type HandlerProps = {
  // eslint-disable-next-line no-use-before-define
  add: (receiver: EscapeHandler) => void,
  // eslint-disable-next-line no-use-before-define
  remove: (receiver: EscapeHandler) => void,
}

const EscapeContext = React.createContext<HandlerProps>({
  add: () => {},
  remove: () => {},
})

class EscapeHandlerWrapper extends React.Component<Props> {
  render() {
    return (
      <EscapeContext.Consumer>
        {({add, remove}) => <EscapeHandler {...this.props} add={add} remove={remove} />}
      </EscapeContext.Consumer>
    )
  }
}

class EscapeHandler extends React.Component<Props & HandlerProps> {
  componentDidMount() {
    this.props.add(this)
  }

  componentWillUnmount() {
    this.props.remove(this)
  }

  onESC() {
    this.props.onESC && this.props.onESC()
  }

  render() {
    return this.props.children || null
  }
}

class GlobalEscapeHandler extends React.Component<GlobalProps> {
  _stack: Array<EscapeHandler> = []

  componentDidMount() {
    document.body && document.body.addEventListener('keydown', this._handleESC)
  }

  componentWillUnmount() {
    document.body && document.body.removeEventListener('keydown', this._handleESC)
  }

  _handleESC = (ev: KeyboardEvent) => {
    if (ev.key !== 'Escape') {
      return
    }
    const receiver = this._stack.pop()
    if (!receiver) {
      return
    }
    receiver.onESC()
  }

  add = (receiver: EscapeHandler) => {
    this._stack.push(receiver)
  }

  remove = (receiver: EscapeHandler) => {
    const idx = this._stack.indexOf(receiver)
    if (idx !== -1) {
      this._stack.splice(idx, 1)
    }
  }

  render() {
    return (
      <EscapeContext.Provider value={{add: this.add, remove: this.remove}}>
        {this.props.children}
      </EscapeContext.Provider>
    )
  }
}

export {GlobalEscapeHandler}
export default EscapeHandlerWrapper
