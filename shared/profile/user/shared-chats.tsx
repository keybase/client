import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {useTrackerState} from '@/constants/tracker2'
import {useCurrentUserState} from '@/constants/current-user'
import {storeRegistry} from '@/constants/store-registry'
import {useConfigState} from '@/constants/config'

type ItemProps = {
  conv: T.RPCChat.UnverifiedInboxUIItem
  you: string
  showMain: () => void
}

const SharedChatItem = ({conv, you, showMain}: ItemProps) => {
  const isTeam = conv.membersType === T.RPCChat.ConversationMembersType.team
  const channelName = conv.localMetadata?.channelName ?? ''
  const others = isTeam ? [] : conv.name.split(',').filter(p => p !== you)

  const label = isTeam ? (channelName ? `${conv.name}#${channelName}` : conv.name) : others.join(', ')

  const onPress = () => {
    showMain()
    storeRegistry.getConvoState(conv.convID).dispatch.navigateToThread('misc')
  }

  const avatar = isTeam ? (
    <Kb.Avatar size={40} teamname={conv.name} isTeam={true} />
  ) : (
    <Kb.Avatar size={40} username={others[0] ?? conv.name} />
  )

  return (
    <Kb.ClickableBox onClick={onPress} style={styles.item}>
      <Kb.Box2 direction="vertical" alignItems="center" gap="xtiny">
        {avatar}
        <Kb.Text type="BodyTiny" style={styles.label} lineClamp={1}>
          {label}
        </Kb.Text>
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}

type Props = {username: string}

const SharedChats = ({username}: Props) => {
  const sharedConversations = useTrackerState(s => s.getDetails(username).sharedConversations)
  const showMain = useConfigState(s => s.dispatch.showMain)
  const you = useCurrentUserState(s => s.username)

  if (!sharedConversations?.length) return null

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
      <Kb.Text type="BodyTinySemibold" style={styles.header}>
        Chats in common
      </Kb.Text>
      <Kb.ScrollView horizontal={true} showsHorizontalScrollIndicator={false}>
        <Kb.Box2 direction="horizontal" gap="tiny" style={styles.row}>
          {sharedConversations.map(conv => (
            <SharedChatItem key={conv.convID} conv={conv} you={you} showMain={showMain} />
          ))}
        </Kb.Box2>
      </Kb.ScrollView>
    </Kb.Box2>
  )
}

export default SharedChats

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    paddingBottom: Kb.Styles.globalMargins.tiny,
    paddingTop: Kb.Styles.globalMargins.small,
  },
  header: {
    color: Kb.Styles.globalColors.black_50,
    paddingBottom: Kb.Styles.globalMargins.xtiny,
    paddingLeft: Kb.Styles.globalMargins.small,
  },
  item: {
    alignItems: 'center',
    paddingHorizontal: Kb.Styles.globalMargins.tiny,
    width: 72,
  },
  label: {
    maxWidth: 68,
    textAlign: 'center',
  },
  row: {
    paddingLeft: Kb.Styles.globalMargins.small,
    paddingRight: Kb.Styles.globalMargins.small,
  },
}))
