// @flow
import {FilterBigTeamChannel} from '.'
import * as Creators from '../../../../actions/chat/creators'
import {pausableConnect} from '../../../../util/container'

const mapStateToProps = (_, {teamname, channelname}) => ({
  channelname,
  teamname,
})

const mapDispatchToProps = (dispatch: Dispatch, {conversationIDKey}) => ({
  onSelectConversation: () => {
    dispatch(Creators.setInboxFilter(''))
    dispatch(Creators.selectConversation(conversationIDKey, true))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  channelname: stateProps.channelname || '',
  onSelectConversation: dispatchProps.onSelectConversation,
  teamname: stateProps.teamname || '',
})

export default pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps)(FilterBigTeamChannel)
