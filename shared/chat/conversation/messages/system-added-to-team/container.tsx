import * as RouterConstants from '../../../../constants/router2'
import * as React from 'react'
import * as Container from '../../../../util/container'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import * as ConfigConstants from '../../../../constants/config'
import type * as Types from '../../../../constants/types/chat2'
import * as TeamConstants from '../../../../constants/teams'
import SystemAddedToTeam from '.'

type OwnProps = {
  message: Types.MessageSystemAddedToTeam
}

const SystemAddedToTeamContainer = React.memo(function (p: OwnProps) {
  const {message} = p
  const {conversationIDKey, addee, adder, author, bulkAdds, role, timestamp} = message
  const meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const {teamID, teamname, teamType} = meta
  const authorIsAdmin = TeamConstants.useState(s =>
    TeamConstants.userIsRoleInTeam(s, teamID, author, 'admin')
  )
  const authorIsOwner = TeamConstants.useState(s =>
    TeamConstants.userIsRoleInTeam(s, teamID, author, 'owner')
  )
  const you = ConfigConstants.useCurrentUserState(s => s.username)
  const isAdmin = authorIsAdmin || authorIsOwner
  const isTeam = teamType === 'big' || teamType === 'small'

  const dispatch = Container.useDispatch()
  const onManageNotifications = React.useCallback(() => {
    dispatch(Chat2Gen.createShowInfoPanel({conversationIDKey, show: true, tab: 'settings'}))
  }, [dispatch, conversationIDKey])

  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
  const onViewBot = React.useCallback(() => {
    navigateAppend({
      props: {botUsername: addee, conversationIDKey: conversationIDKey},
      selected: 'chatInstallBot',
    })
  }, [navigateAppend, conversationIDKey, addee])

  const onViewTeam = React.useCallback(() => {
    if (teamID) {
      navigateAppend({props: {teamID}, selected: 'team'})
    } else {
      dispatch(Chat2Gen.createShowInfoPanel({conversationIDKey, show: true, tab: 'settings'}))
    }
  }, [navigateAppend, dispatch, conversationIDKey, teamID])

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
