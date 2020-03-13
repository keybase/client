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
  React.useEffect(() => {
    getDefaultChannelsRPC(
      [{teamID}],
      result =>
        setDefaultChannels(
          result.convs?.map(conv => ({channelname: conv.channel, conversationIDKey: conv.convID})) ?? [
            {channelname: 'general', conversationIDKey: 'unused'},
          ]
        ),
      _ => {}
    )
  }, [getDefaultChannelsRPC, teamID])
  const onAdd = (channelName: string) => {}

  return <ChannelsWidget teamID={teamID} channels={defaultChannels} />
}

export default DefaultChannels
