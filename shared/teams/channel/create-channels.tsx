import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {RPCError} from '@/util/errors'
import {CreateChannelsModal} from '../new-team/wizard/create-channels'
import {useLoadedTeam} from '../team/use-loaded-team'

type Props = {teamID: T.Teams.TeamID}

const CreateChannels = (props: Props) => {
  return <CreateChannelsInner key={props.teamID} teamID={props.teamID} />
}

const CreateChannelsInner = (props: Props) => {
  const teamID = props.teamID
  const {
    teamMeta: {teamname},
  } = useLoadedTeam(teamID)
  const [waiting, setWaiting] = React.useState(false)
  const [error, setError] = React.useState('')
  const [success, setSuccess] = React.useState(false)

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
        setSuccess(true)
      } catch (error_) {
        if (error_ instanceof RPCError) {
          setError(error_.desc)
        }
      } finally {
        setWaiting(false)
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
