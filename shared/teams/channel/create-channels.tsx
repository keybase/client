import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/teams'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import CreateChannelsModal from '../new-team/wizard/create-channels'

type Props = {teamID: Types.TeamID}

const CreateChannels = (props: Props) => {
  const teamID = props.teamID ?? Types.noTeamID
  const setChannelCreationError = Constants.useState(s => s.dispatch.setChannelCreationError)
  React.useEffect(
    () => () => {
      setChannelCreationError('')
    },
    [teamID, setChannelCreationError]
  )
  const waiting = Constants.useState(s => s.creatingChannels)
  const error = Constants.useState(s => s.errorInChannelCreation)
  const prevWaiting = Container.usePrevious(waiting)

  const loadTeamChannelList = Constants.useState(s => s.dispatch.loadTeamChannelList)
  const createChannels = Constants.useState(s => s.dispatch.createChannels)
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
