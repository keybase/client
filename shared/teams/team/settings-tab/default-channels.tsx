import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import * as RPCChatGen from '../../../constants/types/rpc-chat-gen'
import * as ChatTypes from '../../../constants/types/chat2'
import * as Types from '../../../constants/types/teams'
import {useAllChannelMetas, ChannelsWidget} from '../../common'

type Props = {
  teamID: Types.TeamID
}

const DefaultChannels = (props: Props) => {
  const {teamID} = props
  const getDefaultChannelsRPC = Container.useRPC(RPCChatGen.localGetDefaultTeamChannelsLocalRpcPromise)
  const setDefaultChannelsRPC = Container.useRPC(RPCChatGen.localSetDefaultTeamChannelsLocalRpcPromise)
  const [defaultChannels, setDefaultChannels] = React.useState<Array<Types.ChannelNameID>>([])
  const [waiting, setWaiting] = React.useState(false)
  React.useEffect(() => {
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
      _ => {}
    )
  }, [getDefaultChannelsRPC, teamID])
  const onAdd = (channels: Array<Types.ChannelNameID>) => {
    setWaiting(true)
    setDefaultChannelsRPC(
      [
        {
          convs: (defaultChannels || [])
            .filter(c => c.channelname !== 'general')
            .concat(channels)
            .map(c => c.conversationIDKey),
          teamID,
        },
      ],
      result => {
        setWaiting(false)
        setDefaultChannels([...defaultChannels, ...channels])
      },
      error => {
        console.error(error)
      }
    )
  }

  return (
    <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true}>
      {waiting && <Kb.ProgressIndicator />}
      <ChannelsWidget teamID={teamID} channels={defaultChannels} onAddChannel={onAdd} />
    </Kb.Box2>
  )
}

export default DefaultChannels
