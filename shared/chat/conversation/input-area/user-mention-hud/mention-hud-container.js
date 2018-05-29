// @flow
import {MentionHud} from '.'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import {compose, connect, lifecycle, type TypedState, setDisplayName} from '../../../../util/container'
import * as I from 'immutable'
import logger from '../../../../logger'

const mapStateToProps = (state: TypedState, {filter, conversationIDKey}) => {
  return {
    _filter: filter,
    _infoMap: state.users.infoMap,
    _metaMap: state.chat2.metaMap,
    conversationIDKey,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _loadParticipants: conversationIDKey =>
    dispatch(Chat2Gen.createMetaRequestTrusted({conversationIDKeys: [conversationIDKey], force: true})),
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
    }
  }

  return {
    ...ownProps,
    _generalChannelConversationIDKey,
    _loadParticipants: dispatchProps._loadParticipants,
    conversationIDKey: stateProps.conversationIDKey,
    filter: stateProps._filter.toLowerCase(),
    users: participants
      .map(p => ({fullName: stateProps._infoMap.getIn([p, 'fullname'], ''), username: p}))
      .toArray(),
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('UserMentionHud'),
  lifecycle({
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
    },
  })
)(MentionHud)
