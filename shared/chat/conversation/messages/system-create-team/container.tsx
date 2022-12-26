import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import * as React from 'react'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as TeamConstants from '../../../../constants/teams'
import SystemCreateTeam from '.'
import type * as Types from '../../../../constants/types/chat2'
import {teamsTab} from '../../../../constants/tabs'

type OwnProps = {
  message: Types.MessageSystemCreateTeam
}

const SystemCreateTeamContainer = React.memo(function SystemCreateTeamContainer(p: OwnProps) {
  const {message} = p
  const {conversationIDKey, creator} = message
  const {teamID, teamname} = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const role = Container.useSelector(state => TeamConstants.getRole(state, teamID))
  const you = Container.useSelector(state => state.config.username)
  const isAdmin = TeamConstants.isAdmin(role) || TeamConstants.isOwner(role)
  const team = teamname
  const dispatch = Container.useDispatch()

  const onViewTeam = React.useCallback(() => {
    if (teamID) {
      dispatch(RouteTreeGen.createNavigateAppend({path: [teamsTab, {props: {teamID}, selected: 'team'}]}))
    } else {
      dispatch(Chat2Gen.createShowInfoPanel({conversationIDKey, show: true, tab: 'settings'}))
    }
  }, [dispatch, teamID, conversationIDKey])

  const props = {
    creator,
    isAdmin,
    onViewTeam,
    team,
    teamID,
    you,
  }

  return <SystemCreateTeam {...props} />
})

export default SystemCreateTeamContainer
