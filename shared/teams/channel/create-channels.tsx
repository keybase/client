import * as React from 'react'
import * as TeamsTypes from '../../constants/types/teams'
import * as TeamsGen from '../../actions/teams-gen'
import * as Container from '../../util/container'
import CreateChannels from '../new-team/wizard/create-channels'

type Props = Container.RouteProps<{teamID: TeamsTypes.TeamID}>

export default (props: Props) => {
  const teamID = Container.getRouteProps(props, 'teamID', TeamsTypes.noTeamID)
  const dispatch = Container.useDispatch()

  const onSubmitChannels = (channels: Array<string>) =>
    channels.forEach(c =>
      dispatch(
        TeamsGen.createCreateChannel({
          channelname: c,
          description: '',
          navToChatOnSuccess: false,
          teamID,
        })
      )
    )
  return <CreateChannels onSubmitChannels={onSubmitChannels} />
}
