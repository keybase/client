import * as T from '../../constants/types'
import * as C from '../../constants'
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import * as Styles from '../../styles'
import * as Constants from '../../constants/teams'

type Props = {
  members: string[]
  conversationIDKey: T.Chat.ConversationIDKey
  teamID: T.Teams.TeamID
}

const ConfirmRemoveFromChannel = (props: Props) => {
  const members = props.members
  const teamID = props.teamID ?? T.Teams.noTeamID
  const conversationIDKey = props.conversationIDKey ?? C.noConversationIDKey

  const [waiting, setWaiting] = React.useState(false)
  const [error, setError] = React.useState('')
  const channelInfo = C.useTeamsState(s => Constants.getTeamChannelInfo(s, teamID, conversationIDKey))
  const {channelname} = channelInfo

  const nav = Container.useSafeNavigation()
  const onCancel = React.useCallback(() => nav.safeNavigateUp(), [nav])

  const loadTeamChannelList = C.useTeamsState(s => s.dispatch.loadTeamChannelList)
  const channelSetMemberSelected = C.useTeamsState(s => s.dispatch.channelSetMemberSelected)
  const removeFromChannel = Container.useRPC(T.RPCChat.localRemoveFromConversationLocalRpcPromise)

  const onRemove = () => {
    setWaiting(true)
    setTimeout(() => setWaiting(false), 1000)
    removeFromChannel(
      [{convID: T.Chat.keyToConversationID(conversationIDKey), usernames: members}],
      _ => {
        setWaiting(false)
        channelSetMemberSelected(conversationIDKey, '', false, true)
        nav.safeNavigateUp()
        loadTeamChannelList(teamID)
      },
      err => {
        setWaiting(false)
        setError(err.message)
      }
    )
  }

  const prompt = `Remove ${Constants.stringifyPeople(members)} from #${channelname}?`
  const header = (
    <Kb.Box style={styles.positionRelative}>
      <Kb.AvatarLine usernames={members} size={64} layout="horizontal" maxShown={5} />
      <Kb.Icon
        boxStyle={members.length <= 5 ? styles.iconContainerSingle : styles.iconContainer}
        type="iconfont-block"
        style={styles.headerIcon}
        sizeType="Small"
      />
    </Kb.Box>
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

const styles = Styles.styleSheetCreate(() => ({
  headerIcon: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.red,
      borderColor: Styles.globalColors.white,
      borderStyle: 'solid',
      borderWidth: 3,
      color: Styles.globalColors.white,
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
  positionRelative: {
    position: 'relative',
  },
}))
