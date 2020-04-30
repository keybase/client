import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import * as Types from '../../constants/types/teams'
import * as ChatTypes from '../../constants/types/chat2'
import * as Styles from '../../styles'
import * as Constants from '../../constants/teams'
import * as ChatConstants from '../../constants/chat2'
import * as TeamsGen from '../../actions/teams-gen'

type Props = Container.RouteProps<{
  members: string[]
  conversationIDKey: ChatTypes.ConversationIDKey
  teamID: Types.TeamID
}>

const ConfirmRemoveFromChannel = (props: Props) => {
  const members = Container.getRouteProps(props, 'members', [])
  const teamID = Container.getRouteProps(props, 'teamID', Types.noTeamID)
  const conversationIDKey = Container.getRouteProps(
    props,
    'conversationIDKey',
    ChatConstants.noConversationIDKey
  )

  const waitingKeys = members.map(member => Constants.removeFromChannelWaitingKey(conversationIDKey, member))
  const waiting = Container.useAnyWaiting(...waitingKeys)
  const channelInfo = Container.useSelector(state =>
    Constants.getTeamChannelInfo(state, teamID, conversationIDKey)
  )
  const {channelname} = channelInfo

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onCancel = React.useCallback(() => dispatch(nav.safeNavigateUpPayload()), [dispatch, nav])

  // TODO(Y2K-1592): do this in one RPC
  const onRemove = () => {
    dispatch(
      TeamsGen.createChannelSetMemberSelected({
        clearAll: true,
        conversationIDKey,
        selected: false,
        username: '',
      })
    )

    members.forEach(member => console.log(`TODO: ${member} wants to leave channel, not implemented yet`))
  }

  const wasWaiting = Container.usePrevious(waiting)
  React.useEffect(() => {
    // TODO: refactor to `useRPC`
    if (wasWaiting && !waiting) {
      onCancel()
    }
  }, [waiting, wasWaiting, onCancel])

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
      waitingKey={waitingKeys}
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
