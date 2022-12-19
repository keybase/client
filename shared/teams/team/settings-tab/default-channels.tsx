import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Container from '../../../util/container'
import * as RPCChatGen from '../../../constants/types/rpc-chat-gen'
import type * as Types from '../../../constants/types/teams'
import * as Constants from '../../../constants/teams'
import type {RPCError} from '../../../util/errors'
import {ChannelsWidget} from '../../common'

type Props = {
  teamID: Types.TeamID
}

export const useDefaultChannels = (teamID: Types.TeamID) => {
  const getDefaultChannelsRPC = Container.useRPC(RPCChatGen.localGetDefaultTeamChannelsLocalRpcPromise)
  const [defaultChannels, setDefaultChannels] = React.useState<Array<Types.ChannelNameID>>([])
  const [defaultChannelsWaiting, setWaiting] = React.useState(false)
  const [error, setError] = React.useState<RPCError | null>(null)

  const reloadDefaultChannels = React.useCallback(() => {
    setWaiting(true)
    getDefaultChannelsRPC(
      [{teamID}],
      result => {
        setDefaultChannels([
          {channelname: 'general', conversationIDKey: 'unused'},
          ...(result.convs || []).map(conv => ({channelname: conv.channel, conversationIDKey: conv.convID})),
        ])
        setWaiting(false)
      },
      err => {
        setError(err)
        setWaiting(false)
      }
    )
  }, [teamID, getDefaultChannelsRPC])

  // Initialize
  React.useEffect(reloadDefaultChannels, [reloadDefaultChannels])

  return {defaultChannels, defaultChannelsWaiting, error, reloadDefaultChannels}
}

const DefaultChannels = (props: Props) => {
  const {teamID} = props
  const {defaultChannels, defaultChannelsWaiting, reloadDefaultChannels} = useDefaultChannels(teamID)
  const setDefaultChannelsRPC = Container.useRPC(RPCChatGen.localSetDefaultTeamChannelsLocalRpcPromise)
  const [waiting, setWaiting] = React.useState(false)
  // TODO TRIAGE-2474
  // Implicit admins should be able to set this, but chat stuff doesnt know about them.
  // For now limit to people who are admins in this team.
  // const canEdit = Container.useSelector(s => Constants.getCanPerformByID(s, teamID).manageMembers)
  const canEdit = Container.useSelector(s => ['admin', 'owner'].includes(Constants.getRole(s, teamID)))

  const onAdd = (channels: Array<Types.ChannelNameID>) => {
    setWaiting(true)
    const convs = defaultChannels
      .concat(channels)
      .filter(c => c.channelname !== 'general')
      .map(c => c.conversationIDKey)
    setDefaultChannelsRPC(
      [{convs, teamID}],
      () => {
        setWaiting(false)
        reloadDefaultChannels()
      },
      error => {
        setWaiting(false)
        console.error(error)
      }
    )
  }

  const onRemove = (channel: Types.ChannelNameID) => {
    const toRemoveIdx = defaultChannels.findIndex(c => c.conversationIDKey === channel.conversationIDKey)
    if (toRemoveIdx >= 0) {
      const channelsCopy = defaultChannels.slice()
      channelsCopy.splice(toRemoveIdx, 1)
      const convs = channelsCopy.filter(c => c.channelname !== 'general').map(c => c.conversationIDKey)
      setWaiting(true)
      setDefaultChannelsRPC(
        [{convs, teamID}],
        () => {
          setWaiting(false)
          reloadDefaultChannels()
        },
        error => {
          setWaiting(false)
          console.error(error)
        }
      )
    }
  }

  const anyWaiting = defaultChannelsWaiting || waiting
  return (
    <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true} alignItems="flex-start">
      <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true}>
        <Kb.Text type="BodySmallSemibold">Default join channels</Kb.Text>
        {anyWaiting && <Kb.ProgressIndicator />}
      </Kb.Box2>
      {canEdit ? (
        <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true}>
          <Kb.Text type="BodySmall">Define which channels new members will be added to.</Kb.Text>
          <ChannelsWidget
            teamID={teamID}
            channels={defaultChannels}
            disableGeneral={true}
            onAddChannel={onAdd}
            onRemoveChannel={onRemove}
          />
        </Kb.Box2>
      ) : (
        <Kb.Text type="BodySmall">
          New members will be added to{' '}
          {defaultChannels.map((channel, index) => (
            <Kb.Text key={channel.conversationIDKey} type="BodySmallSemibold">
              #{channel.channelname}
              {defaultChannels.length > 2 && index < defaultChannels.length - 1 && ', '}
              {index === defaultChannels.length - 2 && <Kb.Text type="BodySmall"> and </Kb.Text>}
            </Kb.Text>
          ))}
          .
        </Kb.Text>
      )}
    </Kb.Box2>
  )
}

export default DefaultChannels
