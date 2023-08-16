import * as C from '../../constants'
import * as Container from '../../util/container'
import * as React from 'react'
import * as TeamsConstants from '../../constants/teams'
import * as T from '../../constants/types'
import CreateChannel from '.'
import upperFirst from 'lodash/upperFirst'

type OwnProps = {
  navToChatOnSuccess?: boolean
  teamID: T.Teams.TeamID
}

const Wrapped = (p: OwnProps) => {
  const teamID = p.teamID ?? T.Teams.noTeamID
  const navToChatOnSuccess = p.navToChatOnSuccess ?? true
  const errorText = C.useTeamsState(s => upperFirst(s.errorInChannelCreation))
  const teamname = C.useTeamsState(s => TeamsConstants.getTeamNameFromID(s, teamID) ?? '')
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = navigateUp
  const [channelname, onChannelnameChange] = React.useState<string>('')
  const [description, onDescriptionChange] = React.useState<string>('')
  const createChannel = C.useTeamsState(s => s.dispatch.createChannel)
  const onSubmit = React.useCallback(() => {
    if (channelname) {
      createChannel({channelname, description, navToChatOnSuccess, teamID})
    }
  }, [createChannel, navToChatOnSuccess, channelname, description, teamID])

  const setChannelCreationError = C.useTeamsState(s => s.dispatch.setChannelCreationError)
  Container.useOnMountOnce(() => {
    setChannelCreationError('')
  })

  return (
    <CreateChannel
      errorText={errorText}
      teamname={teamname}
      onBack={onBack}
      onClose={onBack}
      teamID={teamID}
      channelname={channelname}
      onChannelnameChange={onChannelnameChange}
      description={description}
      onDescriptionChange={onDescriptionChange}
      onSubmit={onSubmit}
    />
  )
}

export default Wrapped
