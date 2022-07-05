import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import * as Types from '../../constants/types/teams'
import * as ChatTypes from '../../constants/types/chat2'
import * as Styles from '../../styles'
import * as Constants from '../../constants/teams'
import * as ChatConstants from '../../constants/chat2'
import * as TeamsGen from '../../actions/teams-gen'
import * as RPCChatGen from '../../constants/types/rpc-chat-gen'

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

  const [waiting, setWaiting] = React.useState(false)
  const [error, setError] = React.useState('')
  const channelInfo = Container.useSelector(state =>
    Constants.getTeamChannelInfo(state, teamID, conversationIDKey)
  )
  const {channelname} = channelInfo

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onCancel = React.useCallback(() => dispatch(nav.safeNavigateUpPayload()), [dispatch, nav])

  const removeFromChannel = Container.useRPC(RPCChatGen.localRemoveFromConversationLocalRpcPromise)

  const onRemove = () => {
    setWaiting(true)
    setTimeout(() => setWaiting(false), 1000)
    removeFromChannel(
      [{convID: ChatTypes.keyToConversationID(conversationIDKey), usernames: members}],
      _ => {
        setWaiting(false)
        dispatch(
          TeamsGen.createChannelSetMemberSelected({
            clearAll: true,
            conversationIDKey,
            selected: false,
            username: '',
          })
        )
        dispatch(nav.safeNavigateUpPayload())
        dispatch(TeamsGen.createLoadTeamChannelList({teamID}))
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
