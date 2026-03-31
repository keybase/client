import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as Teams from '@/stores/teams'
import {useTeamsState} from '@/stores/teams'
import {RPCError} from '@/util/errors'
import {CreateChannelsModal} from '../new-team/wizard/create-channels'

type Props = {teamID: T.Teams.TeamID}

const CreateChannels = (props: Props) => {
  const teamID = props.teamID
  const teamname = useTeamsState(s => Teams.getTeamNameFromID(s, teamID))
  const loadTeamChannelList = useTeamsState(s => s.dispatch.loadTeamChannelList)
  const isMountedRef = React.useRef(false)
  const [waiting, setWaiting] = React.useState(false)
  const [error, setError] = React.useState('')
  const [success, setSuccess] = React.useState(false)

  React.useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  React.useEffect(() => {
    setError('')
    setSuccess(false)
    setWaiting(false)
  }, [teamID])

  const banners = error ? (
    <Kb.Banner color="red" key="error">
      {error}
    </Kb.Banner>
  ) : success ? (
    <Kb.Banner color="green" key="success">
      Successfully created channels.
    </Kb.Banner>
  ) : null

  const onSubmitChannels = (channels: Array<string>) => {
    if (!teamname) {
      setError('Invalid team name')
      setSuccess(false)
      return
    }

    setError('')
    setSuccess(false)
    setWaiting(true)

    const f = async () => {
      try {
        for (const channelname of channels) {
          await T.RPCChat.localNewConversationLocalRpcPromise(
            {
              identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
              membersType: T.RPCChat.ConversationMembersType.team,
              tlfName: teamname,
              tlfVisibility: T.RPCGen.TLFVisibility.private,
              topicName: channelname,
              topicType: T.RPCChat.TopicType.chat,
            },
            C.waitingKeyTeamsCreateChannel(teamID)
          )
        }
        loadTeamChannelList(teamID)
        if (isMountedRef.current) {
          setSuccess(true)
        }
      } catch (error_) {
        if (isMountedRef.current && error_ instanceof RPCError) {
          setError(error_.desc)
        }
      } finally {
        if (isMountedRef.current) {
          setWaiting(false)
        }
      }
    }
    void f()
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
