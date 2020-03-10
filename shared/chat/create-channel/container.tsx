import * as React from 'react'
import * as TeamsGen from '../../actions/teams-gen'
import CreateChannel from '.'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import upperFirst from 'lodash/upperFirst'
import * as TeamsTypes from '../../constants/types/teams'
import * as TeamsConstants from '../../constants/teams'

type OwnProps = Container.RouteProps<{navToChatOnSuccess?: boolean; teamID: TeamsTypes.TeamID}>

type Props = {
  _onCreateChannel: (o: {channelname: string; description: string; teamID: TeamsTypes.TeamID}) => void
  _onSetChannelCreationError: (error: string) => void
  errorText: string
  onBack: () => void
  onClose: () => void
  teamID: TeamsTypes.TeamID
  teamname: string
}

const Wrapped = (p: Props) => {
  const [channelname, onChannelnameChange] = React.useState<string>('')
  const [description, onDescriptionChange] = React.useState<string>('')

  const {_onCreateChannel, _onSetChannelCreationError, teamID, ...rest} = p
  const onSubmit = React.useCallback(() => {
    channelname && _onCreateChannel({channelname, description, teamID})
  }, [channelname, _onCreateChannel, description, teamID])

  React.useEffect(() => {
    _onSetChannelCreationError('')
  }, [_onSetChannelCreationError])

  return (
    <CreateChannel
      {...rest}
      teamID={teamID}
      channelname={channelname}
      onChannelnameChange={onChannelnameChange}
      description={description}
      onDescriptionChange={onDescriptionChange}
      onSubmit={onSubmit}
    />
  )
}

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const teamID = Container.getRouteProps(ownProps, 'teamID', TeamsTypes.noTeamID)
    return {
      errorText: upperFirst(state.teams.errorInChannelCreation),
      teamID,
      teamname: TeamsConstants.getTeamNameFromID(state, teamID) ?? '',
    }
  },
  (dispatch, ownProps: OwnProps) => ({
    _onCreateChannel: ({
      channelname,
      description,
      teamID,
    }: {
      channelname: string
      description: string
      teamID: TeamsTypes.TeamID
    }) =>
      dispatch(
        TeamsGen.createCreateChannel({
          channelname,
          description,
          navToChatOnSuccess: Container.getRouteProps(ownProps, 'navToChatOnSuccess', undefined) ?? true,
          teamID,
        })
      ),
    _onSetChannelCreationError: (error: string) => dispatch(TeamsGen.createSetChannelCreationError({error})),
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onClose: () => dispatch(RouteTreeGen.createNavigateUp()),
  }),
  (s, d, _: OwnProps) => ({...s, ...d})
)(Wrapped)
