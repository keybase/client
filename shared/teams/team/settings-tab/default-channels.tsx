import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import type {RPCError} from '@/util/errors'
import {ChannelsWidget} from '@/teams/common'
import {useLoadedTeam} from '../use-loaded-team'

type Props = {
  teamID: T.Teams.TeamID
}

export const useDefaultChannels = (teamID: T.Teams.TeamID) => {
  type DefaultChannelsState = {
    defaultChannels: Array<T.Teams.ChannelNameID>
    error?: RPCError
    loadedTeamID?: T.Teams.TeamID
    waiting: boolean
  }

  const getDefaultChannelsRPC = C.useRPC(T.RPCChat.localGetDefaultTeamChannelsLocalRpcPromise)
  const [state, setState] = React.useState<DefaultChannelsState>({
    defaultChannels: [],
    error: undefined,
    loadedTeamID: teamID,
    waiting: false,
  })
  const requestVersionRef = React.useRef(0)
  const requestTeamIDRef = React.useRef(teamID)

  const reloadDefaultChannels = React.useCallback(() => {
    const requestVersion = ++requestVersionRef.current
    setState(prev => ({...prev, error: undefined, waiting: true}))
    getDefaultChannelsRPC(
      [{teamID}],
      result => {
        if (requestVersion !== requestVersionRef.current) {
          return
        }
        setState({
          defaultChannels: [
            {channelname: 'general', conversationIDKey: 'unused'},
            ...(result.convs || []).map(conv => ({channelname: conv.channel, conversationIDKey: conv.convID})),
          ],
          error: undefined,
          loadedTeamID: teamID,
          waiting: false,
        })
      },
      err => {
        if (requestVersion !== requestVersionRef.current) {
          return
        }
        setState(prev => ({...prev, error: err, loadedTeamID: teamID, waiting: false}))
      }
    )
  }, [getDefaultChannelsRPC, teamID])

  React.useEffect(() => {
    if (requestTeamIDRef.current !== teamID) {
      requestTeamIDRef.current = teamID
      requestVersionRef.current++
    }
  }, [teamID])

  // Initialize
  React.useEffect(reloadDefaultChannels, [reloadDefaultChannels])

  const visibleState =
    state.loadedTeamID === teamID
      ? state
      : {
          defaultChannels: [] as Array<T.Teams.ChannelNameID>,
          error: undefined,
          loadedTeamID: teamID,
          waiting: true,
        }

  return {
    defaultChannels: visibleState.defaultChannels,
    defaultChannelsWaiting: visibleState.waiting,
    error: visibleState.error,
    reloadDefaultChannels,
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
