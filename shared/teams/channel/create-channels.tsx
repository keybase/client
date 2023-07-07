import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/teams'
import * as TeamsGen from '../../actions/teams-gen'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import CreateChannelsModal from '../new-team/wizard/create-channels'

type Props = {teamID: Types.TeamID}

const CreateChannels = (props: Props) => {
  const teamID = props.teamID ?? Types.noTeamID
  const dispatch = Container.useDispatch()
  React.useEffect(
    () => () => {
      dispatch(TeamsGen.createSetChannelCreationError({error: ''}))
    },
    [teamID, dispatch]
  )
  const waiting = Container.useSelector(s => s.teams.creatingChannels)
  const error = Container.useSelector(s => s.teams.errorInChannelCreation)
  const prevWaiting = Container.usePrevious(waiting)

  const loadTeamChannelList = Constants.useState(s => s.dispatch.loadTeamChannelList)
  React.useEffect(() => {
    if (prevWaiting === true && !waiting) {
      loadTeamChannelList(teamID)
    }
  }, [loadTeamChannelList, prevWaiting, teamID, waiting])

  const success = prevWaiting && !waiting && !error

  const banners = React.useMemo(
    () =>
      error ? (
        <Kb.Banner color="red" key="error">
          {error}
        </Kb.Banner>
      ) : success ? (
        <Kb.Banner color="green" key="success">
          Successfully created channels.
        </Kb.Banner>
      ) : null,
    [error, success]
  )

  const onSubmitChannels = (channels: Array<string>) => {
    dispatch(
      TeamsGen.createCreateChannels({
        channelnames: channels,
        teamID,
      })
    )
  }
  return (
    <CreateChannelsModal
      onSubmitChannels={onSubmitChannels}
      teamID={teamID}
      waiting={waiting}
      banners={banners}
    />
  )
}

export default CreateChannels
