import {namedConnect, isMobile} from '../../../../util/container'
import * as React from 'react'
import * as I from 'immutable'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as UsersTypes from '../../../../constants/types/users'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import ReactionTooltip from '.'

/**
 * On desktop this component shows the reactions for one emoji
 * at a time. On mobile it shows all the reactions. This container
 * will use the emoji in OwnProps to filter if !isMobile.
 */

export type OwnProps = {
  attachmentRef?: () => React.Component<any> | null
  conversationIDKey: Types.ConversationIDKey
  emoji?: string
  onHidden: () => void
  onMouseLeave?: (syntheticEvent: React.SyntheticEvent) => void
  onMouseOver?: (syntheticEvent: React.SyntheticEvent) => void
  ordinal: Types.Ordinal
  visible: boolean
}

const emptyStateProps = {
  _reactions: I.Map<string, I.Set<Types.Reaction>>(),
  _usersInfo: new Map<string, UsersTypes.UserInfo>(),
}

export default namedConnect(
  (state, ownProps: OwnProps) => {
    const message = Constants.getMessage(state, ownProps.conversationIDKey, ownProps.ordinal)
    if (!message || !Constants.isDecoratedMessage(message)) {
      return emptyStateProps
    }
    const _reactions = message.reactions
    const _usersInfo = state.users.infoMap
    return {_reactions, _usersInfo}
  },
  (dispatch, ownProps: OwnProps) => ({
    onAddReaction: () => {
      ownProps.onHidden()
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [
            {
              props: {conversationIDKey: ownProps.conversationIDKey, ordinal: ownProps.ordinal},
              selected: 'chatChooseEmoji',
            },
          ],
        })
      )
    },
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    let reactions = [...stateProps._reactions.keys()]
      .map(emoji => ({
        emoji,
        users: [...(stateProps._reactions.get(emoji) || new Set())]
          // Earliest users go at the top
          .sort((a, b) => a.timestamp - b.timestamp)
          .map(r => ({
            fullName: (stateProps._usersInfo.get(r.username) || {fullname: ''}).fullname || '',
            timestamp: r.timestamp,
            username: r.username,
          })),
      }))
      .sort(
        // earliest reactions go at the top
        (a, b) => ((a.users[0] && a.users[0].timestamp) || 0) - ((b.users[0] && b.users[0].timestamp) || 0)
      )
      // strip timestamp
      .map(e => ({
        emoji: e.emoji,
        users: e.users.map(u => ({
          fullName: u.fullName,
          username: u.username,
        })),
      }))
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
  },
  'ReactionTooltip'
)(ReactionTooltip)
