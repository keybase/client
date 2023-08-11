import * as Container from '../../util/container'
import * as React from 'react'
import * as TeamsConstants from '../../constants/teams'
import * as C from '../../constants'
import * as TeamsTypes from '../../constants/types/teams'
import CreateChannel from '.'
import upperFirst from 'lodash/upperFirst'

type OwnProps = {
  navToChatOnSuccess?: boolean
  teamID: TeamsTypes.TeamID
}

const Wrapped = (p: OwnProps) => {
  const teamID = p.teamID ?? TeamsTypes.noTeamID
  const navToChatOnSuccess = p.navToChatOnSuccess ?? true
  const errorText = TeamsConstants.useState(s => upperFirst(s.errorInChannelCreation))
  const teamname = TeamsConstants.useState(s => TeamsConstants.getTeamNameFromID(s, teamID) ?? '')
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = navigateUp
  const [channelname, onChannelnameChange] = React.useState<string>('')
  const [description, onDescriptionChange] = React.useState<string>('')
  const createChannel = TeamsConstants.useState(s => s.dispatch.createChannel)
  const onSubmit = React.useCallback(() => {
    if (channelname) {
      createChannel({channelname, description, navToChatOnSuccess, teamID})
    }
  }, [createChannel, navToChatOnSuccess, channelname, description, teamID])

  const setChannelCreationError = TeamsConstants.useState(s => s.dispatch.setChannelCreationError)
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
