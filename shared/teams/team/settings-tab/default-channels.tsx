import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Container from '../../../util/container'
import * as RPCChatGen from '../../../constants/types/rpc-chat-gen'
import * as Types from '../../../constants/types/teams'
import * as Constants from '../../../constants/teams'
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
  // TODO TRIAGE-2474
  // Implicit admins should be able to set this, but chat stuff doesnt know about them.
  // For now limit to people who are admins in this team.
  // const canEdit = Container.useSelector(s => Constants.getCanPerformByID(s, teamID).manageMembers)
  const canEdit = Container.useSelector(s => ['admin', 'owner'].includes(Constants.getRole(s, teamID)))

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
        setWaiting(false)
        console.error(error)
      })
    }
  }

  return (
    <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true} alignItems="flex-start">
      <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true}>
        <Kb.Text type="BodySmallSemibold">Default join channels</Kb.Text>
        {waiting && <Kb.ProgressIndicator />}
      </Kb.Box2>
      {canEdit ? (
        <>
          <Kb.Text type="BodySmall">Define which channels new members will be added to.</Kb.Text>
          <ChannelsWidget
            teamID={teamID}
            channels={defaultChannels}
            disableGeneral={true}
            onAddChannel={onAdd}
            onRemoveChannel={onRemove}
          />
        </>
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
