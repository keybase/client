import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import {useTeamsState} from '@/stores/teams'
import {pluralize} from '@/util/string'
import {useAllChannelMetas} from '@/teams/common/channel-hooks'

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
  const loadTeamChannelList = useTeamsState(s => s.dispatch.loadTeamChannelList)
  const clearModals = C.Router2.clearModals

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
      for (const channelID of channelIDs) {
        await deleteChannel(channelID)
      }
      loadTeamChannelList(teamID)
      clearModals()
    }
    C.ignorePromise(f())
  }, [channelIDs, clearModals, deleteChannel, loadTeamChannelList, teamID])

  const navigateUp = C.Router2.navigateUp
  const onCancel = () => {
    navigateUp()
  }

  return (
    <Kb.ConfirmModal
      confirmText={`Delete ${pluralize('channel', channelnames.length)}`}
      description="This cannot be undone. All messages in the channel will be lost."
      error={waitingError?.message ?? ''}
      header={<Header />}
      onConfirm={onDelete}
      onCancel={onCancel}
      prompt={
        <Kb.Text type="Header" center={true} style={styles.prompt}>
          Delete {deleteMsg}?
        </Kb.Text>
      }
      waitingKey={waitingKey}
    />
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  prompt: Kb.Styles.padding(0, Kb.Styles.globalMargins.small),
}))

export default DeleteChannel
