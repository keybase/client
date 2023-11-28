import * as C from '@/constants'
import * as React from 'react'
import type * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import SetExplodeTime from '.'

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

type OwnProps = {
  attachTo?: React.RefObject<Kb.MeasureRef>
  onAfterSelect?: (s: number) => void
  onHidden: () => void
  visible: boolean
}

const SetExplodePopup = React.memo(function SetExplodePopup(p: OwnProps) {
  const {onHidden, visible, attachTo, onAfterSelect} = p
  const _meta = C.useChatContext(s => s.meta)
  const selected = C.useChatContext(s => s.getExplodingMode())
  const setExplodingMode = C.useChatContext(s => s.dispatch.setExplodingMode)
  const onSelect = React.useCallback(
    (seconds: number) => {
      setExplodingMode(seconds)
      onAfterSelect?.(seconds)
    },
    [setExplodingMode, onAfterSelect]
  )

  const items = React.useMemo(() => makeItems(_meta), [_meta])

  const props = {
    attachTo,
    items,
    onHidden,
    onSelect,
    selected,
    visible,
  }
  return <SetExplodeTime {...props} />
})

export default SetExplodePopup
