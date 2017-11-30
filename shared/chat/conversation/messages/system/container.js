// @flow
import * as Constants from '../../../../constants/chat'
import * as Types from '../../../../constants/types/chat'
import {AddedToTeamNotice, ComplexTeamNotice, InviteAddedToTeamNotice} from '.'
import {compose, branch, renderComponent} from 'recompose'
import createCachedSelector from 're-reselect'
import {connect} from 'react-redux'
import {navigateAppend} from '../../../../actions/route-tree'

import type {TypedState} from '../../../../constants/reducer'
import type {OwnProps} from './container'

const getDetails = createCachedSelector(
  [Constants.getMessageFromMessageKey, Constants.getYou, Constants.getFollowingMap],
  (message: Types.SystemMessage, you: string, following: {[key: string]: ?boolean}) => ({
    following: !!following[message.author],
    message,
    you,
  })
)((state, messageKey) => messageKey)

const mapStateToProps = (state: TypedState, {messageKey}: OwnProps) => getDetails(state, messageKey)

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onManageChannels: (teamname: string) => {
    dispatch(navigateAppend([{props: {teamname}, selected: 'manageChannels'}]))
  },
})

const mergeProps = (stateProps, dispatchProps) => {
  const teamname =
    stateProps.message.meta.systemType === 2 &&
    stateProps.message.meta.complexteam &&
    stateProps.message.meta.complexteam.team
  return {
    ...stateProps,
    onManageChannels: () => (teamname ? dispatchProps._onManageChannels(teamname) : {}),
  }
}

// TODO branch against constants defined somewhere
export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  branch(props => props.message.meta.systemType === 1, renderComponent(InviteAddedToTeamNotice)),
  branch(props => props.message.meta.systemType === 2, renderComponent(ComplexTeamNotice))
)(AddedToTeamNotice)
