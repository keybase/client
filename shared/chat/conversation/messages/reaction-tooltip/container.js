// @flow
import {compose, connect, isMobile, setDisplayName, type TypedState} from '../../../../util/container'
import * as React from 'react'
import * as I from 'immutable'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as Route from '../../../../actions/route-tree'
import {ReactionTooltip} from '.'

/**
 * On desktop this component shows the reactions for one emoji
 * at a time. On mobile it shows all the reactions. This container
 * will use the emoji in OwnProps to filter if !isMobile.
 */

export type OwnProps = {|
  attachmentRef?: ?React.Component<any, any>,
  conversationIDKey: Types.ConversationIDKey,
  emoji?: string,
  onHidden: () => void,
  onMouseLeave?: (SyntheticEvent<Element>) => void,
  onMouseOver?: (SyntheticEvent<Element>) => void,
  ordinal: Types.Ordinal,
  visible: boolean,
|}

const emptyStateProps = {
  _reactions: I.Map(),
  _usersInfo: I.Map(),
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const message = Constants.getMessage(state, ownProps.conversationIDKey, ownProps.ordinal)
  if (!message || message.type === 'placeholder' || message.type === 'deleted') {
    return emptyStateProps
  }
  const _reactions = message.reactions
  const _usersInfo = state.users.infoMap
  return {_reactions, _usersInfo}
}

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  onAddReaction: () => {
    ownProps.onHidden()
    dispatch(
      Route.navigateAppend([
        {
          props: {conversationIDKey: ownProps.conversationIDKey, ordinal: ownProps.ordinal},
          selected: 'chooseEmoji',
        },
      ])
    )
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  let reactions = stateProps._reactions
    .keySeq()
    .toArray()
    .map(emoji => ({
      emoji,
      users: stateProps._reactions
        .get(emoji, I.Set())
        // Earliest users go at the top
        .sort((a, b) => a.timestamp - b.timestamp)
        .map(r => ({
          fullName: stateProps._usersInfo.get(r.username, {fullname: ''}).fullname,
          timestamp: r.timestamp,
          username: r.username,
        }))
        .toArray(),
    }))
    // earliest reactions go at the top
    .sort((a, b) => ((a.users[0] && a.users[0].timestamp) || 0) - ((b.users[0] && b.users[0].timestamp) || 0))
  if (!isMobile && ownProps.emoji) {
    // Filter down to selected emoji
    reactions = reactions.filter(r => r.emoji === ownProps.emoji)
  }
  return {
    attachmentRef: ownProps.attachmentRef,
    conversationIDKey: ownProps.conversationIDKey,
    onAddReaction: dispatchProps.onAddReaction,
    onHidden: ownProps.onHidden,
    onMouseLeave: ownProps.onMouseLeave,
    onMouseOver: ownProps.onMouseOver,
    ordinal: ownProps.ordinal,
    reactions,
    visible: ownProps.visible,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('ReactionTooltip')
)(ReactionTooltip)
