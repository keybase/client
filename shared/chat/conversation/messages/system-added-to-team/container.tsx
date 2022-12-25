import * as React from 'react'
import * as Container from '../../../../util/container'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Constants from '../../../../constants/chat2'
import type * as Types from '../../../../constants/types/chat2'
import * as TeamConstants from '../../../../constants/teams'
import SystemAddedToTeam from '.'
import {teamsTab} from '../../../../constants/tabs'

type OwnProps = {
  message: Types.MessageSystemAddedToTeam
}

const SystemAddedToTeamContainer = React.memo(function (p: OwnProps) {
  const {message} = p
  const {conversationIDKey, addee, adder, author, bulkAdds, role, timestamp} = message
  const meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const {teamID, teamname, teamType} = meta
  const authorIsAdmin = Container.useSelector(state =>
    TeamConstants.userIsRoleInTeam(state, teamID, author, 'admin')
  )
  const authorIsOwner = Container.useSelector(state =>
    TeamConstants.userIsRoleInTeam(state, teamID, author, 'owner')
  )
  const you = Container.useSelector(state => state.config.username)
  const isAdmin = authorIsAdmin || authorIsOwner
  const isTeam = teamType === 'big' || teamType === 'small'

  const dispatch = Container.useDispatch()
  const onManageNotifications = React.useCallback(() => {
    dispatch(Chat2Gen.createShowInfoPanel({conversationIDKey, show: true, tab: 'settings'}))
  }, [dispatch, conversationIDKey])

  const onViewBot = React.useCallback(() => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {botUsername: addee, conversationIDKey: conversationIDKey},
            selected: 'chatInstallBot',
          },
        ],
      })
    )
  }, [dispatch, conversationIDKey, addee])

  const onViewTeam = React.useCallback(() => {
    if (teamID) {
      dispatch(RouteTreeGen.createNavigateAppend({path: [teamsTab, {props: {teamID}, selected: 'team'}]}))
    } else {
      dispatch(Chat2Gen.createShowInfoPanel({conversationIDKey, show: true, tab: 'settings'}))
    }
  }, [dispatch, conversationIDKey, teamID])

  const props = {
    addee,
    adder,
    bulkAdds,
    isAdmin,
    isTeam,
    onManageNotifications,
    onViewBot,
    onViewTeam,
    role,
    teamname,
    timestamp,
    you,
  }

  return <SystemAddedToTeam {...props} />
})
export default SystemAddedToTeamContainer
