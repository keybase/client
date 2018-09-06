// @flow
import {FilterBigTeamChannel} from '.'
import * as Constants from '../../../../constants/chat2'
import * as Route from '../../../../actions/route-tree'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import {connect, isMobile} from '../../../../util/container'

const mapStateToProps = (state, {conversationIDKey, teamname, channelname}) => ({
  channelname,
  isSelected: Constants.getSelectedConversation(state) === conversationIDKey,
  teamname,
})

const mapDispatchToProps = (dispatch, {conversationIDKey}) => ({
  onSelectConversation: () => {
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'inboxBig'}))
    if (isMobile) {
      dispatch(Route.navigateAppend(['conversation']))
    }
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  channelname: stateProps.channelname || '',
  isSelected: stateProps.isSelected,
  onSelectConversation: dispatchProps.onSelectConversation,
  teamname: stateProps.teamname || '',
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(FilterBigTeamChannel)
