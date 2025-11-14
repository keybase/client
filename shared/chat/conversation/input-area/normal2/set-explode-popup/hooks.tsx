import * as C from '@/constants'
import * as React from 'react'
import type * as T from '@/constants/types'
import type {Props} from '.'

const makeItems = (meta: T.Chat.ConversationMeta) => {
  const convRetention = C.Chat.getEffectiveRetentionPolicy(meta)
  if (convRetention.type !== 'explode') {
    return C.Chat.messageExplodeDescriptions
  }
  const {seconds, title} = convRetention
  const items = C.Chat.messageExplodeDescriptions.filter(ed => ed.seconds < seconds)
  items.splice(0, 1, {seconds, text: `${title} (Chat policy)`})
  return items
}

export default (p: Props) => {
  const {setExplodingMode, onHidden, visible, attachTo, onAfterSelect} = p
  const _meta = C.useChatContext(s => s.meta)
  const selected = C.useChatContext(s => s.explodingMode)
  const onSelect = React.useCallback(
    (seconds: number) => {
      setExplodingMode(seconds)
      onAfterSelect?.(seconds)
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
