import * as React from 'react'
import {connect} from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Types from '../../../../constants/types/chat2'
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

const mapStateToProps = (state, ownProps: OwnProps) => {
  const meta = Constants.getMeta(state, ownProps.conversationIDKey)
  return {
    items: makeItems(meta),
    selected: Constants.getConversationExplodingMode(state, ownProps.conversationIDKey),
  }
}

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  onSelect: seconds => {
    dispatch(Chat2Gen.createSetConvExplodingMode({conversationIDKey: ownProps.conversationIDKey, seconds}))
    ownProps.onAfterSelect && ownProps.onAfterSelect(seconds)
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  attachTo: ownProps.attachTo,
  items: stateProps.items,
  onHidden: ownProps.onHidden,
  onSelect: dispatchProps.onSelect,
  selected: stateProps.selected,
  visible: ownProps.visible,
})

const SetExplodePopup = connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(SetExplodeTime)

export default SetExplodePopup
