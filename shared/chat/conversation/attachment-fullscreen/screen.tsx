import type * as T from '@/constants/types'
import * as ConvoState from '@/stores/convostate'
import * as React from 'react'
import {useSafeAreaFrame} from 'react-native-safe-area-context'
import Full from '.'
import {ConversationThreadProvider} from '../thread-context'

type OwnProps = {
  ordinal: T.Chat.Ordinal
}

const Screen = (p: OwnProps) => {
  const conversationIDKey = ConvoState.useChatContext(s => s.id)
  const {width, height} = useSafeAreaFrame()
  const isPortrait = height > width
  const wasPortraitRef = React.useRef(isPortrait)
  // reset zoom etc on change
  const [key, setKey] = React.useState(0)

  React.useEffect(() => {
    if (isPortrait !== wasPortraitRef.current) {
      wasPortraitRef.current = isPortrait
      setKey(k => k + 1)
    }
  }, [isPortrait])

  return (
    <ConversationThreadProvider id={conversationIDKey}>
      <Full ordinal={p.ordinal} showHeader={isPortrait} key={String(key)} />
    </ConversationThreadProvider>
  )
}

export default Screen
