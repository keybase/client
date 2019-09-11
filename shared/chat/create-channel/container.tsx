import * as React from 'react'
import * as TeamsGen from '../../actions/teams-gen'
import CreateChannel from '.'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {upperFirst} from 'lodash-es'

type OwnProps = Container.RouteProps<{teamname: string}>

type Props = {
  _onCreateChannel: (o: {channelname: string; description: string; teamname: string}) => void
  _onSetChannelCreationError: (error: string) => void
  errorText: string
  onBack: () => void
  onClose: () => void
  teamname: string
}

const Wrapped = (p: Props) => {
  const [channelname, onChannelnameChange] = React.useState<string>('')
  const [description, onDescriptionChange] = React.useState<string>('')

  const {_onCreateChannel, _onSetChannelCreationError, teamname, ...rest} = p
  const onSubmit = React.useCallback(() => {
    channelname && _onCreateChannel({channelname, description, teamname})
  }, [channelname, _onCreateChannel, description, teamname])

  React.useEffect(() => {
    _onSetChannelCreationError('')
  }, [_onSetChannelCreationError])

  return (
    <CreateChannel
      {...rest}
      teamname={teamname}
      channelname={channelname}
      onChannelnameChange={onChannelnameChange}
      description={description}
      onDescriptionChange={onDescriptionChange}
      onSubmit={onSubmit}
    />
  )
}

export default Container.connect(
  (state, ownProps: OwnProps) => ({
    errorText: upperFirst(state.teams.channelCreationError),
    teamname: Container.getRouteProps(ownProps, 'teamname', ''),
  }),
  dispatch => ({
    _onCreateChannel: ({
      channelname,
      description,
      teamname,
    }: {
      channelname: string
      description: string
      teamname: string
    }) => dispatch(TeamsGen.createCreateChannel({channelname, description, teamname})),
    _onSetChannelCreationError: (error: string) => dispatch(TeamsGen.createSetChannelCreationError({error})),
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onClose: () => dispatch(RouteTreeGen.createNavigateUp()),
  }),
  (s, d, _: OwnProps) => ({...s, ...d})
)(Wrapped)
