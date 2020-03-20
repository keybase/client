import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Container from '../../../util/container'
import * as RPCChatGen from '../../../constants/types/rpc-chat-gen'
import * as Types from '../../../constants/types/teams'
import {ChannelsWidget} from '../../common'

type Props = {
  teamID: Types.TeamID
}

const DefaultChannels = (props: Props) => {
  const {teamID} = props
  const getDefaultChannelsRPC = Container.useRPC(RPCChatGen.localGetDefaultTeamChannelsLocalRpcPromise)
  const setDefaultChannelsRPC = Container.useRPC(RPCChatGen.localSetDefaultTeamChannelsLocalRpcPromise)
  const [defaultChannels, setDefaultChannels] = React.useState<Array<Types.ChannelNameID>>([])
  const [waiting, setWaiting] = React.useState(false)

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
      _ => {
        // TODO what to do with error?
        setWaiting(false)
      }
    )
  }, [teamID, getDefaultChannelsRPC])

  // Initialize
  React.useEffect(reloadDefaultChannels, [reloadDefaultChannels])

  const onAdd = (channels: Array<Types.ChannelNameID>) => {
    setWaiting(true)
    const convs = defaultChannels
      .concat(channels)
      .filter(c => c.channelname !== 'general')
      .map(c => c.conversationIDKey)
    setDefaultChannelsRPC([{convs, teamID}], reloadDefaultChannels, error => {
      console.error(error)
    })
  }

  const onRemove = (channel: Types.ChannelNameID) => {
    const toRemoveIdx = defaultChannels.findIndex(c => c.conversationIDKey === channel.conversationIDKey)
    if (toRemoveIdx >= 0) {
      const channelsCopy = defaultChannels.slice()
      channelsCopy.splice(toRemoveIdx, 1)
      const convs = channelsCopy.filter(c => c.channelname !== 'general').map(c => c.conversationIDKey)
      setWaiting(true)
      setDefaultChannelsRPC([{convs, teamID}], reloadDefaultChannels, error => {
        console.error(error)
      })
    }
  }

  return (
    <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true}>
      <ChannelsWidget
        teamID={teamID}
        channels={defaultChannels}
        disableGeneral={true}
        onAddChannel={onAdd}
        onRemoveChannel={onRemove}
      />
    </Kb.Box2>
  )
}

export default DefaultChannels
