// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import {MentionHud} from '.'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import {compose, connect, type TypedState, setDisplayName} from '../../../../util/container'
import * as I from 'immutable'
import logger from '../../../../logger'
import type {MentionHudProps} from '.'

const mapStateToProps = (state: TypedState, {filter, conversationIDKey}) => {
  const meta = Constants.getMeta(state, conversationIDKey)
  const teamType = meta.teamType
  return {
    _filter: filter,
    _infoMap: state.users.infoMap,
    _metaMap: state.chat2.metaMap,
    conversationIDKey,
    teamType,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _loadParticipants: conversationIDKey =>
    dispatch(
      Chat2Gen.createMetaRequestTrusted({
        conversationIDKeys: [Types.stringToConversationIDKey(conversationIDKey)],
        force: true,
      })
    ),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const meta = stateProps._metaMap.get(stateProps.conversationIDKey)
  let participants = meta ? meta.participants : I.Set()
  let _generalChannelConversationIDKey = ''
  // Get the general channel participants instead
  if (meta && meta.teamType === 'big' && meta.channelname !== 'general') {
    const m = stateProps._metaMap.find(m => m.teamname === meta.teamname && m.channelname === 'general')
    if (m) {
      participants = m.participants
      _generalChannelConversationIDKey = m.conversationIDKey
    } else {
      logger.info(`MentionHUD: no meta found for general channel in team ${meta.teamname}`)
    }
  }

  const users = participants
    .map(p => ({fullName: stateProps._infoMap.getIn([p, 'fullname'], ''), username: p}))
    .toArray()
  return {
    ...ownProps,
    _generalChannelConversationIDKey,
    _loadParticipants: dispatchProps._loadParticipants,
    conversationIDKey: stateProps.conversationIDKey,
    filter: stateProps._filter.toLowerCase(),
    teamType: stateProps.teamType,
    loading: users.length === 0,
    users,
  }
}

class AutoLoadMentionHud extends React.Component<MentionHudProps> {
  componentDidMount() {
    if (this.props.users.length === 0) {
      // it can never be 0, we don't have a list of participants cached for the general channel or this channel
      if (!this.props._generalChannelConversationIDKey) {
        logger.warn(
          'Mention HUD: no meta found for general channel, loading participants of current channel.'
        )
        this.props._loadParticipants(this.props.conversationIDKey)
        return
      }
      logger.info('Mention HUD: no participants in general channel meta, requesting trusted inbox item.')
      this.props._loadParticipants(this.props._generalChannelConversationIDKey)
    }
  }
  render() {
    return <MentionHud {...this.props} />
  }
}
// TODO fix up the typing of this component
export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  // $FlowIssue hud uses a ton of not safe recompose stuff
  setDisplayName('UserMentionHud')
)(AutoLoadMentionHud)
