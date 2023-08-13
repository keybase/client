import * as C from '../../../../constants'
import * as React from 'react'
import * as Constants from '../../../../constants/chat2'
import type * as Types from '../../../../constants/types/chat2'
import SetExplodeTime from '.'

const makeItems = (meta: Types.ConversationMeta) => {
  const convRetention = Constants.getEffectiveRetentionPolicy(meta)
  if (convRetention.type !== 'explode') {
    return Constants.messageExplodeDescriptions
  }
  const {seconds, title} = convRetention
  const items = Constants.messageExplodeDescriptions.filter(ed => ed.seconds < seconds)
  items.splice(0, 1, {seconds, text: `${title} (Chat policy)`})
  return items
}

type OwnProps = {
  attachTo?: () => React.Component<any> | null
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
