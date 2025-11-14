import * as C from '@/constants'
import * as React from 'react'
import upperFirst from 'lodash/upperFirst'
import type {Props} from '.'

export default (p: Props) => {
  const teamID = p.teamID
  const navToChatOnSuccess = p.navToChatOnSuccess ?? true
  const errorText = C.useTeamsState(s => upperFirst(s.errorInChannelCreation))
  const teamname = C.useTeamsState(s => C.Teams.getTeamNameFromID(s, teamID) ?? '')
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
