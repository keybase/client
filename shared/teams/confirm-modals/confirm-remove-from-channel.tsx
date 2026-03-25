import * as T from '@/constants/types'
import * as C from '@/constants'
import * as React from 'react'
import * as Teams from '@/stores/teams'
import {useTeamsState} from '@/stores/teams'
import * as Kb from '@/common-adapters'
import {useRouteNavigation} from '@/constants/router'

type Props = {
  members: string[]
  conversationIDKey: T.Chat.ConversationIDKey
  teamID: T.Teams.TeamID
}

const ConfirmRemoveFromChannel = (props: Props) => {
  const members = props.members
  const teamID = props.teamID
  const conversationIDKey = props.conversationIDKey

  const [waiting, setWaiting] = React.useState(false)
  const [error, setError] = React.useState('')
  const channelInfo = useTeamsState(s => Teams.getTeamChannelInfo(s, teamID, conversationIDKey))
  const {channelname} = channelInfo

  const nav = useRouteNavigation()
  const onCancel = () => nav.navigateUp()

  const loadTeamChannelList = useTeamsState(s => s.dispatch.loadTeamChannelList)
  const channelSetMemberSelected = useTeamsState(s => s.dispatch.channelSetMemberSelected)
  const removeFromChannel = C.useRPC(T.RPCChat.localRemoveFromConversationLocalRpcPromise)

  const onRemove = () => {
    setWaiting(true)
    setTimeout(() => setWaiting(false), 1000)
    removeFromChannel(
      [{convID: T.Chat.keyToConversationID(conversationIDKey), usernames: members}],
      _ => {
        setWaiting(false)
        channelSetMemberSelected(conversationIDKey, '', false, true)
        nav.navigateUp()
        loadTeamChannelList(teamID)
      },
      err => {
        setWaiting(false)
        setError(err.message)
      }
    )
  }

  const prompt = `Remove ${Teams.stringifyPeople(members)} from #${channelname}?`
  const header = (
    <Kb.Box2 direction="vertical" relative={true}>
      <Kb.AvatarLine usernames={members} size={64} layout="horizontal" maxShown={5} />
      <Kb.Icon
        type="iconfont-block"
        style={Kb.Styles.collapseStyles([styles.headerIcon, members.length <= 5 ? styles.iconContainerSingle : styles.iconContainer])}
        sizeType="Small"
      />
    </Kb.Box2>
  )
  return (
    <Kb.ConfirmModal
      header={header}
      prompt={prompt}
      onCancel={onCancel}
      onConfirm={onRemove}
      confirmText="Remove from channel"
      waiting={waiting}
      error={error}
    />
  )
}
export default ConfirmRemoveFromChannel

const styles = Kb.Styles.styleSheetCreate(() => ({
  headerIcon: Kb.Styles.platformStyles({
    common: {
      backgroundColor: Kb.Styles.globalColors.red,
      borderColor: Kb.Styles.globalColors.white,
      borderStyle: 'solid',
      borderWidth: 3,
      color: Kb.Styles.globalColors.white,
      padding: 3,
    },
    isElectron: {
      backgroundClip: 'padding-box',
      borderRadius: 50,
    },
    isMobile: {
      borderRadius: 18,
      marginRight: -20,
      marginTop: -30,
    },
  }),
  iconContainer: {
    bottom: -3,
    position: 'absolute',
    right: 20,
  },
  iconContainerSingle: {
    bottom: -3,
    position: 'absolute',
    right: 0,
  },
}))
