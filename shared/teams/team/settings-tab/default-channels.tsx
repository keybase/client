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
  const [defaultChannels, setDefaultChannels] = React.useState<Array<string>>([])
  React.useEffect(() => {
    getDefaultChannelsRPC(
      [{teamID}],
      result => setDefaultChannels(result.convs?.map(conv => conv.channel) ?? ['general']),
      _ => {}
    )
  }, [getDefaultChannelsRPC, teamID])

  return <ChannelsWidget teamID={teamID} channels={defaultChannel} />
}

export default DefaultChannels
