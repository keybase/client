import * as React from 'react'
import Inbox from '.'
import {useIsFocused} from '@react-navigation/core'
import type {ChatRootRouteParams} from '../inbox-and-conversation'
import {useInboxSearch} from './use-inbox-search'

// keep track of this even on unmount, else if you background / foreground you'll lose it
let _everFocused = false

export default function Deferred(_props: ChatRootRouteParams) {
  const [visible, setVisible] = React.useState(_everFocused)
  const isFocused = useIsFocused()
  const search = useInboxSearch()
  React.useEffect(() => {
    _everFocused = _everFocused || isFocused
  }, [isFocused])

  // work around a bug in gesture handler if we show too quickly when going back from a convo on startup
  React.useEffect(() => {
    if (!isFocused || visible) {
      return
    }
    const id = setTimeout(() => {
      setVisible(true)
    }, 100)
    return () => {
      clearTimeout(id)
    }
  }, [isFocused, visible])
  return visible ? <Inbox search={search} /> : null
}
