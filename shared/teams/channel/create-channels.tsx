import * as C from '../../constants'
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as T from '../../constants/types'
import * as Container from '../../util/container'
import CreateChannelsModal from '../new-team/wizard/create-channels'

type Props = {teamID: T.Teams.TeamID}

const CreateChannels = (props: Props) => {
  const teamID = props.teamID ?? T.Teams.noTeamID
  const setChannelCreationError = C.useTeamsState(s => s.dispatch.setChannelCreationError)
  React.useEffect(
    () => () => {
      setChannelCreationError('')
    },
    [teamID, setChannelCreationError]
  )
  const waiting = C.useTeamsState(s => s.creatingChannels)
  const error = C.useTeamsState(s => s.errorInChannelCreation)
  const prevWaiting = Container.usePrevious(waiting)

  const loadTeamChannelList = C.useTeamsState(s => s.dispatch.loadTeamChannelList)
  const createChannels = C.useTeamsState(s => s.dispatch.createChannels)
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
    createChannels(teamID, channels)
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
