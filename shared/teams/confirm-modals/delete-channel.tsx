import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import {useNavigation} from '@react-navigation/native'
import {pluralize} from '@/util/string'
import setRouteParamsIfPresent from './set-route-params-if-present'
import {useAllChannelMetas} from '@/teams/common/channel-hooks'
import {invalidateTeamChannels} from '@/teams/common/use-loaded-team-channels'

type Props = {
  conversationIDKeys?: Array<T.Chat.ConversationIDKey>
  teamID: T.Teams.TeamID
  conversationIDKey?: T.Chat.ConversationIDKey
}

const Header = () => (
  <>
    <Kb.ImageIcon type="icon-teams-channel-64" />
    <Kb.ImageIcon type="icon-team-delete-28" style={{marginRight: -60, marginTop: -20}} />
  </>
)

const deleteChannels = async (
  teamID: T.Teams.TeamID,
  channelIDs: ReadonlyArray<T.Chat.ConversationIDKey>,
  deleteChannel: (conversationIDKey: T.Chat.ConversationIDKey) => Promise<void>
) => {
  try {
    for (const channelID of channelIDs) {
      await deleteChannel(channelID)
    }
  } finally {
    // the service only sends its notice for a delete when its local inbox knows
    // the channel's team, so do not rely on it alone; a failure part way through
    // still deleted the channels before it
    invalidateTeamChannels(teamID)
  }
}

const DeleteChannel = (props: Props) => {
  const teamID = props.teamID
  const routePropChannel = props.conversationIDKey

  const [channelIDs] = React.useState(
    routePropChannel ? [routePropChannel] : props.conversationIDKeys ?? []
  )
  const deleteChannelRPC = C.useRPC(T.RPCChat.localDeleteConversationLocalRpcPromise)

  const {channelMetas} = useAllChannelMetas(teamID)
  const channelnames: string[] = []

  channelIDs.forEach(channelID => {
    const conversationMeta = channelMetas.get(channelID)
    const channelname = conversationMeta ? conversationMeta.channelname : ''
    channelnames.push(channelname)
  })

  let deleteMsg: string
  if (channelnames.length === 1) {
    deleteMsg = `#${channelnames[0]}`
  } else if (channelnames.length === 2) {
    deleteMsg = `#${channelnames[0]} and #${channelnames[1]}`
  } else {
    const numOtherChans = channelnames.length - 2
    deleteMsg = `#${channelnames[0]}, #${channelnames[1]} and ${numOtherChans} other ${pluralize(
      'channel',
      numOtherChans
    )}`
  }
  const waitingKey = C.waitingKeyTeamsDeleteChannel(teamID)
  const waitingError = C.Waiting.useAnyErrors(waitingKey)
  const navigation = useNavigation()

  const deleteChannel = React.useCallback(
    async (conversationIDKey: T.Chat.ConversationIDKey) =>
      await new Promise<void>((resolve, reject) => {
        deleteChannelRPC(
          [
            {
              channelName: '',
              confirmed: true,
              convID: T.Chat.keyToConversationID(conversationIDKey),
            },
            waitingKey,
          ],
          () => resolve(),
          reject
        )
      }),
    [deleteChannelRPC, waitingKey]
  )
  const onDelete = React.useCallback(() => {
    const f = async () => {
      await deleteChannels(teamID, channelIDs, deleteChannel)
      setRouteParamsIfPresent(navigation, 'team', {selectedChannels: undefined})
      C.Router2.clearModals()
    }
    C.ignorePromise(f())
  }, [channelIDs, deleteChannel, navigation, teamID])

  return (
    <Kb.ConfirmModal
      confirmText={`Delete ${pluralize('channel', channelnames.length)}`}
      description="This cannot be undone. All messages in the channel will be lost."
      error={waitingError?.message ?? ''}
      header={<Header />}
      onConfirm={onDelete}
      onCancel={C.Router2.navigateUp}
      prompt={`Delete ${deleteMsg}?`}
      waitingKey={waitingKey}
    />
  )
}

export default DeleteChannel
