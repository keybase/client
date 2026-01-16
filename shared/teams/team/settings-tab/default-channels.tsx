import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import type {RPCError} from '@/util/errors'
import {ChannelsWidget} from '@/teams/common'
import * as Teams from '@/stores/teams'
import {useTeamsState} from '@/stores/teams'

type Props = {
  teamID: T.Teams.TeamID
}

export const useDefaultChannels = (teamID: T.Teams.TeamID) => {
  const getDefaultChannelsRPC = C.useRPC(T.RPCChat.localGetDefaultTeamChannelsLocalRpcPromise)
  const [defaultChannels, setDefaultChannels] = React.useState<Array<T.Teams.ChannelNameID>>([])
  const [defaultChannelsWaiting, setWaiting] = React.useState(false)
  const [error, setError] = React.useState<RPCError | undefined>()

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
  const setDefaultChannelsRPC = C.useRPC(T.RPCChat.localSetDefaultTeamChannelsLocalRpcPromise)
  const [waiting, setWaiting] = React.useState(false)
  // TODO TRIAGE-2474
  // Implicit admins should be able to set this, but chat stuff doesnt know about them.
  // For now limit to people who are admins in this team.
  // const canEdit = Container.useSelector(s => Constants.getCanPerformByID(s, teamID).manageMembers)
  const canEdit = useTeamsState(s => ['admin', 'owner'].includes(Teams.getRole(s, teamID)))

  const onAdd = (channels: ReadonlyArray<T.Teams.ChannelNameID>) => {
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

  const onRemove = (channel: T.Teams.ChannelNameID) => {
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
