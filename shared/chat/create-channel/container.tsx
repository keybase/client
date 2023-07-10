import * as Container from '../../util/container'
import * as React from 'react'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as TeamsConstants from '../../constants/teams'
import * as TeamsGen from '../../actions/teams-gen'
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
  const dispatch = Container.useDispatch()
  const onBack = React.useCallback(() => dispatch(RouteTreeGen.createNavigateUp()), [dispatch])
  const [channelname, onChannelnameChange] = React.useState<string>('')
  const [description, onDescriptionChange] = React.useState<string>('')
  const onSubmit = React.useCallback(() => {
    if (channelname) {
      dispatch(TeamsGen.createCreateChannel({channelname, description, navToChatOnSuccess, teamID}))
    }
  }, [navToChatOnSuccess, channelname, description, teamID, dispatch])

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
