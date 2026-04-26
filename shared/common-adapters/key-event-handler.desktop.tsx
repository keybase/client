import * as React from 'react'

type GlobalProps = {
  children: React.ReactNode
}

type Props = {
  onKeyDown?: ((ev: KeyboardEvent) => void) | undefined
  onKeyPress?: ((ev: KeyboardEvent) => void) | undefined
  children: React.ReactNode
}

type HandlerProps = {
  add: (receiver: KeyEventHandlerRef) => void
  remove: (receiver: KeyEventHandlerRef) => void
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

type KeyEventHandlerRef = {
  onKeyDown?: ((ev: KeyboardEvent) => void) | undefined
  onKeyPress?: ((ev: KeyboardEvent) => void) | undefined
}
const KeyEventHandler = (props: Props & HandlerProps): React.ReactNode => {
  const {add, remove, onKeyDown, onKeyPress} = props

  React.useEffect(() => {
    const ref = {onKeyDown, onKeyPress}
    add(ref)
    return () => {
      remove(ref)
    }
  }, [add, remove, onKeyDown, onKeyPress])

  return props.children
}

const GlobalKeyEventHandler = (props: GlobalProps) => {
  const [stack, setStack] = React.useState<KeyEventHandlerRef[]>([])
  const stackRef = React.useRef(stack)
  React.useEffect(() => {
    stackRef.current = stack
  }, [stack])

  React.useEffect(() => {
    const handleKeyDown = (ev: KeyboardEvent) => {
      const s = stackRef.current
      s[s.length - 1]?.onKeyDown?.(ev)
    }

    const handleKeyPress = (ev: KeyboardEvent) => {
      const s = stackRef.current
      s[s.length - 1]?.onKeyPress?.(ev)
    }

    const body = document.body
    body.addEventListener('keydown', handleKeyDown)
    body.addEventListener('keypress', handleKeyPress)

    return () => {
      body.removeEventListener('keydown', handleKeyDown)
      body.removeEventListener('keypress', handleKeyPress)
    }
  }, [])

  const add = (receiver: KeyEventHandlerRef) => {
    setStack(prevStack => [...prevStack, receiver])
  }

  const remove = (receiver: KeyEventHandlerRef) => {
    setStack(prevStack => prevStack.filter(handler => handler !== receiver))
  }

  return <KeyEventContext value={{add, remove}}>{props.children}</KeyEventContext>
}

type EscapeHandlerProps = {
  onESC?: (() => void) | undefined
  children: React.ReactNode
}

const handleESC = (onESC: (() => void) | undefined, ev: KeyboardEvent) => {
  if (ev.key !== 'Escape') {
    return
  }
  onESC?.()
}

const EscapeHandler = (props: EscapeHandlerProps) => {
  const {onESC} = props
  const onKeyDown = (ev: KeyboardEvent) => {
    handleESC(onESC, ev)
  }
  return <KeyEventHandlerWrapper onKeyDown={onKeyDown} children={props.children} />
}

export {GlobalKeyEventHandler, KeyEventHandlerWrapper as KeyEventHandler, EscapeHandler}
