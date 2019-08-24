import * as React from 'react'

type GlobalProps = {
  children: React.ReactNode
}

type Props = {
  onKeyDown?: (ev: KeyboardEvent) => void
  onKeyPress?: (ev: KeyboardEvent) => void
  children: React.ReactNode
}

type HandlerProps = {
  add: (receiver: KeyEventHandler) => void
  remove: (receiver: KeyEventHandler) => void
}

const KeyEventContext = React.createContext<HandlerProps>({
  add: () => {},
  remove: () => {},
})

const KeyEventHandlerWrapper = (props: Props) => (
  <KeyEventContext.Consumer>
    {({add, remove}) => <KeyEventHandler {...props} add={add} remove={remove} />}
  </KeyEventContext.Consumer>
)

class KeyEventHandler extends React.Component<Props & HandlerProps> {
  componentDidMount = () => {
    this.props.add(this)
  }

  componentWillUnmount = () => {
    this.props.remove(this)
  }

  onKeyDown = ev => {
    this.props.onKeyDown && this.props.onKeyDown(ev)
  }

  onKeyPress = ev => {
    this.props.onKeyPress && this.props.onKeyPress(ev)
  }

  render = () => {
    return this.props.children
  }
}

class GlobalKeyEventHandler extends React.Component<GlobalProps> {
  _stack: Array<KeyEventHandler> = []

  componentDidMount = () => {
    const body = document.body
    if (!body) {
      return
    }
    body.addEventListener('keydown', this._handleKeyDown)
    body.addEventListener('keypress', this._handleKeyPress)
  }

  componentWillUnmount = () => {
    const body = document.body
    if (!body) {
      return
    }
    body.removeEventListener('keydown', this._handleKeyDown)
    body.removeEventListener('keypress', this._handleKeyPress)
  }

  _topHandler = () => {
    if (this._stack.length === 0) {
      return null
    }
    return this._stack[this._stack.length - 1]
  }

  _handleKeyDown = (ev: KeyboardEvent) => {
    const top = this._topHandler()
    top && top.onKeyDown(ev)
  }

  _handleKeyPress = (ev: KeyboardEvent) => {
    const top = this._topHandler()
    top && top.onKeyPress(ev)
  }

  add = (receiver: KeyEventHandler) => {
    this._stack.push(receiver)
  }

  remove = (receiver: KeyEventHandler) => {
    const idx = this._stack.indexOf(receiver)
    if (idx !== -1) {
      this._stack.splice(idx, 1)
    }
  }

  render = () => (
    <KeyEventContext.Provider value={{add: this.add, remove: this.remove}}>
      {this.props.children}
    </KeyEventContext.Provider>
  )
}

type EscapeHandlerProps = {
  onESC: (() => void) | null
  children: React.ReactNode | null
}

const handleESC = (onESC: (() => void) | null, ev: KeyboardEvent) => {
  if (ev.key !== 'Escape') {
    return
  }
  onESC && onESC()
}

const EscapeHandler = (props: EscapeHandlerProps) => (
  <KeyEventHandlerWrapper onKeyDown={ev => handleESC(props.onESC, ev)} children={props.children} />
)

export {GlobalKeyEventHandler, KeyEventHandlerWrapper as KeyEventHandler, EscapeHandler}
