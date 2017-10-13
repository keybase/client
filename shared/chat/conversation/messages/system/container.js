// @flow
import * as Constants from '../../../../constants/chat'
import SystemNotice from '.'
import createCachedSelector from 're-reselect'
import {compose} from 'recompose'
import {connect} from 'react-redux'
import {navigateTo, switchTo} from '../../../../actions/route-tree'
import {teamsTab} from '../../../../constants/tabs'

import type {TypedState} from '../../../../constants/reducer'
import type {OwnProps} from './container'

type StateProps = {
  channelname: string,
  message: Constants.TextMessage,
  teamname: string,
  you: string,
}

type DispatchProps = {
  _onManageChannels: (teamname: string) => void,
}

const getDetails = createCachedSelector(
  [Constants.getMessageFromMessageKey, Constants.getYou, Constants.getChannelName, Constants.getTeamName],
  (message: Constants.TextMessage, you: string, channelname: string, teamname: string) => ({
    channelname,
    message,
    teamname,
    you,
  })
)((state, messageKey) => messageKey)

const mapStateToProps = (state: TypedState, {messageKey}: OwnProps) => getDetails(state, messageKey)

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onManageChannels: (teamname: string) => {
    dispatch(navigateTo([{props: {teamname}, selected: 'manageChannels'}], [teamsTab]))
    dispatch(switchTo([teamsTab]))
  },
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps) => ({
  ...stateProps,
  onManageChannels: () => dispatchProps._onManageChannels(stateProps.teamname),
})

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps))(SystemNotice)
