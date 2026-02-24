import * as Chat from '@/constants/chat2'
import * as React from 'react'
import type * as T from '@/constants/types'
import type {Props} from '.'

const messageExplodeDescriptions: T.Chat.MessageExplodeDescription[] = [
  {seconds: 30, text: '30 seconds'},
  {seconds: 300, text: '5 minutes'},
  {seconds: 3600, text: '60 minutes'},
  {seconds: 3600 * 6, text: '6 hours'},
  {seconds: 86400, text: '24 hours'},
  {seconds: 86400 * 3, text: '3 days'},
  {seconds: 86400 * 7, text: '7 days'},
  {seconds: 0, text: 'Never explode (turn off)'},
].reverse()

const makeItems = (meta: T.Chat.ConversationMeta) => {
  const convRetention = Chat.getEffectiveRetentionPolicy(meta)
  if (convRetention.type !== 'explode') {
    return messageExplodeDescriptions
  }
  const {seconds, title} = convRetention
  const items = messageExplodeDescriptions.filter(ed => ed.seconds < seconds)
  items.splice(0, 1, {seconds, text: `${title} (Chat policy)`})
  return items
}

export default (p: Props) => {
  const {setExplodingMode, onHidden, visible, attachTo, onAfterSelect} = p
  const _meta = Chat.useChatContext(s => s.meta)
  const selected = Chat.useChatContext(s => s.explodingMode)
  const onSelect = React.useCallback(
    (seconds: number) => {
      setTimeout(() => {
        setExplodingMode(seconds)
        onAfterSelect?.(seconds)
      }, 0)
    },
    [setExplodingMode, onAfterSelect]
  )

  const items = React.useMemo(() => makeItems(_meta), [_meta])
  return {
    attachTo,
    items,
    onHidden,
    onSelect,
    selected,
    visible,
  }
}
