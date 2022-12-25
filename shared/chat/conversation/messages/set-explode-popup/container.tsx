import * as React from 'react'
import * as Container from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
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
  conversationIDKey: Types.ConversationIDKey
  onAfterSelect?: (s: number) => void
  onHidden: () => void
  visible: boolean
}

const SetExplodePopup = React.memo(function SetExplodePopup(p: OwnProps) {
  const {onHidden, visible, attachTo, conversationIDKey, onAfterSelect} = p
  const _meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const selected = Container.useSelector(state =>
    Constants.getConversationExplodingMode(state, conversationIDKey)
  )

  const dispatch = Container.useDispatch()
  const onSelect = React.useCallback(
    (seconds: number) => {
      dispatch(Chat2Gen.createSetConvExplodingMode({conversationIDKey, seconds}))
      onAfterSelect?.(seconds)
    },
    [dispatch, onAfterSelect, conversationIDKey]
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
