import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import type * as T from '@/constants/types'
import {useTeamsState} from '@/stores/teams'
import {pluralize} from '@/util/string'
import {useAllChannelMetas} from '@/teams/common/channel-hooks'

type Props = {
  teamID: T.Teams.TeamID
  // undefined means use the currently selected channels in the store (under the channel tab of the team page)
  conversationIDKey?: T.Chat.ConversationIDKey
}

const Header = () => (
  <>
    <Kb.Icon type="icon-teams-channel-64" />
    <Kb.Icon type="icon-team-delete-28" style={{marginRight: -60, marginTop: -20}} />
  </>
)

const DeleteChannel = (props: Props) => {
  const teamID = props.teamID
  const routePropChannel = props.conversationIDKey
  const storeSelectedChannels = useTeamsState(s => s.teamSelectedChannels.get(teamID))

  // When the channels get deleted, the values in the store are gone but we should keep displaying the same thing.
  const [channelIDs] = React.useState<T.Chat.ConversationIDKey[]>(
    routePropChannel ? [routePropChannel] : storeSelectedChannels ? [...storeSelectedChannels] : []
  )

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

  const setChannelSelected = useTeamsState(s => s.dispatch.setChannelSelected)
  const deleteMultiChannelsConfirmed = useTeamsState(s => s.dispatch.deleteMultiChannelsConfirmed)

  const onDelete = () => {
    deleteMultiChannelsConfirmed(teamID, Array.from(channelIDs.values()))
    setChannelSelected(teamID, '', false, true)
  }

  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    navigateUp()
  }

  return (
    <Kb.ConfirmModal
      confirmText={`Delete ${pluralize('channel', channelnames.length)}`}
      description="This cannot be undone. All messages in the channel will be lost."
      header={<Header />}
      onConfirm={onDelete}
      onCancel={onCancel}
      prompt={
        <Kb.Text type="Header" center={true} style={styles.prompt}>
          Delete {deleteMsg}?
        </Kb.Text>
      }
      waitingKey={C.waitingKeyTeamsDeleteChannel(teamID)}
    />
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  prompt: Kb.Styles.padding(0, Kb.Styles.globalMargins.small),
}))

export default DeleteChannel
