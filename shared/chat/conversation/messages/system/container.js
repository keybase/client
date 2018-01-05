// @flow
import * as Constants from '../../../../constants/chat'
import * as Types from '../../../../constants/types/chat'
import {AddedToTeamNotice, ComplexTeamNotice, InviteAddedToTeamNotice, GitPushInfoNotice} from '.'
import {compose, branch, renderComponent, renderNothing} from 'recompose'
import createCachedSelector from 're-reselect'
import {connect} from 'react-redux'
import {navigateAppend, navigateTo} from '../../../../actions/route-tree'
import {teamsTab} from '../../../../constants/tabs'
import {getRole, isAdmin, isOwner} from '../../../../constants/teams'
import {type TeamRoleType} from '../../../../constants/types/teams'

import type {TypedState} from '../../../../constants/reducer'
import type {OwnProps} from './container'

const getDetails = createCachedSelector(
  [Constants.getMessageFromMessageKey, Constants.getYou, getRole],
  (message: Types.SystemMessage, you: string, role: TeamRoleType) => ({
    admin: isAdmin(role) || isOwner(role),
    message,
    info: message.info,
    you,
  })
)((state, messageKey) => messageKey)

const mapStateToProps = (state: TypedState, {messageKey}: OwnProps) => getDetails(state, messageKey)

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onManageChannels: (teamname: string) => {
    dispatch(navigateAppend([{props: {teamname}, selected: 'manageChannels'}]))
  },
  onViewTeam: (teamname: string) => dispatch(navigateTo([teamsTab, {props: {teamname}, selected: 'team'}])),
})

const mergeProps = (stateProps, dispatchProps) => {
  return {
    ...stateProps,
    ...dispatchProps,
  }
}

// TODO branch against constants defined somewhere
export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  branch(props => props.message.info.type === 'inviteAccepted', renderComponent(InviteAddedToTeamNotice)),
  branch(props => props.message.info.type === 'simpleToComplex', renderComponent(ComplexTeamNotice)),
  branch(props => props.message.info.type === 'addedToTeam', renderComponent(AddedToTeamNotice)),
  branch(props => props.message.info.type === 'gitPush', renderComponent(GitPushInfoNotice))
  // $FlowIssue with the renderNothing type
)(renderNothing())
