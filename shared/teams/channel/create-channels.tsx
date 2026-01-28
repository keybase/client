import * as React from 'react'
import {useTeamsState} from '@/stores/teams'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {CreateChannelsModal} from '../new-team/wizard/create-channels'

type Props = {teamID: T.Teams.TeamID}

const CreateChannels = (props: Props) => {
  const teamID = props.teamID
  const setChannelCreationError = useTeamsState(s => s.dispatch.setChannelCreationError)
  React.useEffect(
    () => () => {
      setChannelCreationError('')
    },
    [teamID, setChannelCreationError]
  )
  const waiting = useTeamsState(s => s.creatingChannels)
  const error = useTeamsState(s => s.errorInChannelCreation)
  const prevWaitingRef = React.useRef(waiting)

  const loadTeamChannelList = useTeamsState(s => s.dispatch.loadTeamChannelList)
  const createChannels = useTeamsState(s => s.dispatch.createChannels)
  React.useEffect(() => {
    if (!!prevWaitingRef.current && !waiting) {
      loadTeamChannelList(teamID)
    }
  }, [loadTeamChannelList, teamID, waiting])

  const [success, setSuccess] = React.useState(!waiting && !error)

  React.useEffect(() => {
    prevWaitingRef.current = waiting
  }, [waiting])

  React.useEffect(() => {
    setSuccess(prevWaitingRef.current && !waiting && !error)
  }, [waiting, error])

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
