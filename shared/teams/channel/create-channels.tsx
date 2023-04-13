import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as TeamsTypes from '../../constants/types/teams'
import * as TeamsGen from '../../actions/teams-gen'
import * as Container from '../../util/container'
import CreateChannelsModal from '../new-team/wizard/create-channels'

type Props = Container.RouteProps<'teamCreateChannels'>

const CreateChannels = (props: Props) => {
  const teamID = props.route.params?.teamID ?? TeamsTypes.noTeamID
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

  React.useEffect(() => {
    if (prevWaiting === true && !waiting) {
      dispatch(TeamsGen.createLoadTeamChannelList({teamID}))
    }
  }, [dispatch, prevWaiting, teamID, waiting])

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
