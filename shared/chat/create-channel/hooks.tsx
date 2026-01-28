import * as C from '@/constants'
import * as React from 'react'
import * as Teams from '@/stores/teams'
import upperFirst from 'lodash/upperFirst'
import type {Props} from '.'

export default (p: Props) => {
  const teamID = p.teamID
  const navToChatOnSuccess = p.navToChatOnSuccess ?? true
  const errorText = Teams.useTeamsState(s => upperFirst(s.errorInChannelCreation))
  const teamname = Teams.useTeamsState(s => Teams.getTeamNameFromID(s, teamID) ?? '')
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = navigateUp
  const [channelname, onChannelnameChange] = React.useState<string>('')
  const [description, onDescriptionChange] = React.useState<string>('')
  const createChannel = Teams.useTeamsState(s => s.dispatch.createChannel)
  const onSubmit = React.useCallback(() => {
    if (channelname) {
      createChannel({channelname, description, navToChatOnSuccess, teamID})
    }
  }, [createChannel, navToChatOnSuccess, channelname, description, teamID])

  const setChannelCreationError = Teams.useTeamsState(s => s.dispatch.setChannelCreationError)
  C.useOnMountOnce(() => {
    setChannelCreationError('')
  })

  return {
    channelname,
    description,
    errorText,
    onBack,
    onChannelnameChange,
    onDescriptionChange,
    onSubmit,
    teamID,
    teamname,
  }
}
