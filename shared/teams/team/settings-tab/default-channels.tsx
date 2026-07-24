import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import logger from '@/logger'
import {registerExternalResetter} from '@/util/zustand'
import {ChannelsWidget} from '@/teams/common'
import {useLoadedTeam} from '../use-loaded-team'
import {type CachedResourceCache, getCachedResourceCache, useCachedResource} from '../../use-cached-resource'

type Props = {
  teamID: T.Teams.TeamID
}

type DefaultChannelsData = ReadonlyArray<T.Teams.ChannelNameID>

const defaultChannelsStaleMs = 5_000
const emptyDefaultChannels: DefaultChannelsData = []

// One cache per team, shared by every consumer: each load is a remote
// chat.1.remote.getDefaultTeamChannels round trip, so a per-instance cache turns
// every extra mount of the settings tab into another hit on the chat rate limit.
const defaultChannelsCaches = new Map<
  T.Teams.TeamID,
  CachedResourceCache<DefaultChannelsData, T.Teams.TeamID>
>()

// module scope outlives sign-out, so the next user would inherit this user's channels
registerExternalResetter('teams-default-channels-caches', () => {
  defaultChannelsCaches.clear()
})

export const useDefaultChannels = (teamID: T.Teams.TeamID) => {
  const cache = React.useMemo(
    () => getCachedResourceCache(defaultChannelsCaches, emptyDefaultChannels, teamID),
    [teamID]
  )
  const {data, loaded, loading, reload} = useCachedResource({
    cache,
    cacheKey: teamID,
    initialData: emptyDefaultChannels,
    // resolve rather than reject on failure: consumers render an empty list (and no
    // spinner) on error, and a cached failure keeps a broken team from re-requesting
    // on every render
    load: async () => {
      try {
        const {convs} = await T.RPCChat.localGetDefaultTeamChannelsLocalRpcPromise({teamID})
        return [
          {channelname: 'general', conversationIDKey: 'unused'},
          ...(convs ?? []).map(conv => ({channelname: conv.channel, conversationIDKey: conv.convID})),
        ]
      } catch (error) {
        logger.warn(`Failed to load default channels for ${teamID}`, error)
        return emptyDefaultChannels
      }
    },
    staleMs: defaultChannelsStaleMs,
  })

  return {
    defaultChannels: data,
    defaultChannelsWaiting: loading || !loaded,
    reloadDefaultChannels: reload,
  }
}

const DefaultChannels = (props: Props) => {
  const {teamID} = props
  const {defaultChannels, defaultChannelsWaiting, reloadDefaultChannels} = useDefaultChannels(teamID)
  const {
    yourOperations: {manageMembers: canEdit},
  } = useLoadedTeam(teamID)
  const setDefaultChannelsRPC = C.useRPC(T.RPCChat.localSetDefaultTeamChannelsLocalRpcPromise)
  const [waiting, setWaiting] = React.useState(false)

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
        void reloadDefaultChannels()
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
          void reloadDefaultChannels()
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
