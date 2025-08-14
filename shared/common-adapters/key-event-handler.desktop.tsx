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
  onKeyDown?: (ev: KeyboardEvent) => void
  onKeyPress?: (ev: KeyboardEvent) => void
}
const KeyEventHandler = (props: Props & HandlerProps): React.ReactNode => {
  const {add, remove, onKeyDown, onKeyPress} = props

  const keyEventHandlerRef = React.useMemo(() => {
    return {onKeyDown, onKeyPress}
  }, [onKeyDown, onKeyPress])

  React.useEffect(() => {
    add(keyEventHandlerRef)
    return () => {
      remove(keyEventHandlerRef)
    }
  }, [add, remove, keyEventHandlerRef])

  return props.children
}

const GlobalKeyEventHandler = (props: GlobalProps) => {
  const [stack, setStack] = React.useState<KeyEventHandlerRef[]>([])

  const topHandler = React.useCallback(() => {
    if (stack.length === 0) {
      return null
    }
    return stack[stack.length - 1]
  }, [stack])

  const handleKeyDown = React.useCallback(
    (ev: KeyboardEvent) => {
      const top = topHandler()
      top?.onKeyDown?.(ev)
    },
    [topHandler]
  )

  const handleKeyPress = React.useCallback(
    (ev: KeyboardEvent) => {
      const top = topHandler()
      top?.onKeyPress?.(ev)
    },
    [topHandler]
  )

  React.useEffect(() => {
    const body = document.body
    body.addEventListener('keydown', handleKeyDown)
    body.addEventListener('keypress', handleKeyPress)

    return () => {
      body.removeEventListener('keydown', handleKeyDown)
      body.removeEventListener('keypress', handleKeyPress)
    }
  }, [handleKeyDown, handleKeyPress])

  const add = React.useCallback((receiver: KeyEventHandlerRef) => {
    setStack(prevStack => [...prevStack, receiver])
  }, [])

  const remove = React.useCallback((receiver: KeyEventHandlerRef) => {
    setStack(prevStack => prevStack.filter(handler => handler !== receiver))
  }, [])

  return <KeyEventContext.Provider value={{add, remove}}>{props.children}</KeyEventContext.Provider>
}

type EscapeHandlerProps = {
  onESC?: () => void
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
  const onKeyDown = React.useCallback(
    (ev: KeyboardEvent) => {
      handleESC(onESC, ev)
    },
    [onESC]
  )
  return <KeyEventHandlerWrapper onKeyDown={onKeyDown} children={props.children} />
}

export {GlobalKeyEventHandler, KeyEventHandlerWrapper as KeyEventHandler, EscapeHandler}
