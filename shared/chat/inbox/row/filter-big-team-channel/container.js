// @flow
import {FilterBigTeamChannel} from '.'
import * as Creators from '../../../../actions/chat/creators'
import {pausableConnect} from '../../../../util/container'

const mapStateToProps = (_, {teamname, channelname, isActiveRoute}) => ({
  channelname,
  isActiveRoute,
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
  isActiveRoute: stateProps.isActiveRoute,
  onSelectConversation: dispatchProps.onSelectConversation,
  teamname: stateProps.teamname || '',
})

export default pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps)(FilterBigTeamChannel)
