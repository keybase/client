import * as React from 'react'

type GlobalProps = {
  children: React.ReactNode
}

type Props = {
  onKeyDown?: (ev: KeyboardEvent) => void
  onKeyPress?: (ev: KeyboardEvent) => void
  children: React.ReactNode
}

type KeyType = 'keydown' | 'keypress'

type Receiver = {
  isLayer: boolean
  dispatch: (type: KeyType, ev: KeyboardEvent) => void
}

type Layer = Receiver & {
  add: (receiver: Receiver) => void
  remove: (receiver: Receiver) => void
  setOnEscape: (onEscape: (() => void) | undefined) => void
}

// Only the most recently registered handler gets a key. A layer is a modal dialog: everything outside
// it is inert, so while one is registered it gets every key, and passes it to the handlers registered
// inside it, or to its own Escape handler when there are none.
const makeLayer = (): Layer => {
  let stack: Array<Receiver> = []
  let onEscape: (() => void) | undefined
  return {
    add: receiver => {
      stack = [...stack, receiver]
    },
    dispatch: (type, ev) => {
      const top = stack.findLast(r => r.isLayer) ?? stack.at(-1)
      if (top) {
        if (top.isLayer && ev.key === 'Escape') {
          // the dialog handles its own Escape, so the browser must not also close it
          ev.preventDefault()
        }
        top.dispatch(type, ev)
      } else if (type === 'keydown' && ev.key === 'Escape') {
        onEscape?.()
      }
    },
    isLayer: true,
    remove: receiver => {
      stack = stack.filter(r => r !== receiver)
    },
    setOnEscape: next => {
      onEscape = next
    },
  }
}

type KeyEventContextType = {
  layer: Layer
  root: Layer
}

const defaultRoot = makeLayer()
const KeyEventContext = React.createContext<KeyEventContextType>({layer: defaultRoot, root: defaultRoot})

const KeyEventHandler = (props: Props): React.ReactNode => {
  const {children, onKeyDown, onKeyPress} = props
  const {layer} = React.use(KeyEventContext)

  React.useEffect(() => {
    const receiver: Receiver = {
      dispatch: (type, ev) => {
        if (type === 'keydown') {
          onKeyDown?.(ev)
        } else {
          onKeyPress?.(ev)
        }
      },
      isLayer: false,
    }
    layer.add(receiver)
    return () => {
      layer.remove(receiver)
    }
  }, [layer, onKeyDown, onKeyPress])

  return children
}

const GlobalKeyEventHandler = (props: GlobalProps) => {
  const [root] = React.useState(makeLayer)

  React.useEffect(() => {
    const handleKeyDown = (ev: KeyboardEvent) => {
      root.dispatch('keydown', ev)
    }

    const handleKeyPress = (ev: KeyboardEvent) => {
      root.dispatch('keypress', ev)
    }

    const body = document.body
    body.addEventListener('keydown', handleKeyDown)
    body.addEventListener('keypress', handleKeyPress)

    return () => {
      body.removeEventListener('keydown', handleKeyDown)
      body.removeEventListener('keypress', handleKeyPress)
    }
  }, [root])

  return <KeyEventContext value={{layer: root, root}}>{props.children}</KeyEventContext>
}

type KeyEventLayerProps = {
  // registered only while active, and on top of everything registered before
  active: boolean
  onEscape?: () => void
  children: React.ReactNode
}

const KeyEventLayer = (props: KeyEventLayerProps) => {
  const {active, children, onEscape} = props
  const {layer: parent, root} = React.use(KeyEventContext)
  const [layer] = React.useState(makeLayer)

  React.useEffect(() => {
    layer.setOnEscape(onEscape)
  }, [layer, onEscape])

  React.useLayoutEffect(() => {
    if (!active) {
      return undefined
    }
    parent.add(layer)
    return () => {
      parent.remove(layer)
    }
  }, [active, layer, parent])

  return <KeyEventContext value={{layer, root}}>{children}</KeyEventContext>
}

// sends a key through the registered handlers as if it had been pressed
const useDispatchKey = () => React.use(KeyEventContext).root.dispatch

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
  const onKeyDown = (ev: KeyboardEvent) => {
    handleESC(onESC, ev)
  }
  return <KeyEventHandler onKeyDown={onKeyDown} children={props.children} />
}

export {EscapeHandler, GlobalKeyEventHandler, KeyEventHandler, KeyEventLayer, useDispatchKey}
