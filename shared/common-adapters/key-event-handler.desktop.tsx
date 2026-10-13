import * as React from 'react'
import {OverlayEntryContext} from './overlay/context'
import {addKeyReceiver} from './overlay/controller.desktop'

// a handler takes a key by returning true or preventing its default
type Props = {
  onKeyDown?: (ev: KeyboardEvent) => unknown
  onKeyPress?: (ev: KeyboardEvent) => unknown
  children: React.ReactNode
}

// Gets keys while the overlay it is rendered in (or the app, outside every overlay) has them and it
// is the newest handler there.
const KeyEventHandler = (props: Props): React.ReactNode => {
  const {children, onKeyDown, onKeyPress} = props
  const entry = React.use(OverlayEntryContext)

  React.useEffect(
    () =>
      addKeyReceiver(entry, (type, ev) => {
        const prevented = ev.defaultPrevented
        const handler = type === 'keydown' ? onKeyDown : onKeyPress
        return handler?.(ev) === true || (!prevented && ev.defaultPrevented)
      }),
    [entry, onKeyDown, onKeyPress]
  )

  return children
}

export {KeyEventHandler}
