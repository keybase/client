// @flow
import {MentionHud} from '.'
import {compose, connect, type TypedState, setDisplayName} from '../../../../util/container'
import * as TeamsGen from '../../../../actions/teams-gen'
import * as Constants from '../../../../constants/chat2'
import * as TeamConstants from '../../../../constants/teams'
import {anyWaiting} from '../../../../constants/waiting'

const mapStateToProps = (state: TypedState, {filter, conversationIDKey}) => {
  const meta = Constants.getMeta(state, conversationIDKey)
  const _teamname = meta.teamname
  const _channelInfos = TeamConstants.getTeamChannelInfos(state, _teamname)
  return {
    _channelInfos,
    _teamname,
    loading: anyWaiting(state, TeamConstants.getChannelsWaitingKey(_teamname)),
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _loadChannels: (teamname: string) => dispatch(TeamsGen.createGetChannels({teamname})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const channels = Array.from(stateProps._channelInfos.map(ci => ci.channelname).values())
  return {
    ...ownProps,
    channels,
    filter: ownProps.filter.toLowerCase(),
    loadChannels: stateProps._teamname ? () => dispatchProps._loadChannels(stateProps._teamname) : null,
    loading: stateProps.loading,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('ChannelMentionHud')
)(MentionHud)
