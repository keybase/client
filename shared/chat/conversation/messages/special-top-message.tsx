import * as Chat2Gen from '../../../actions/chat2-gen'
import * as ConfigConstants from '../../../constants/config'
import * as Constants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import * as FsConstants from '../../../constants/fs'
import * as FsTypes from '../../../constants/types/fs'
import * as Kb from '../../../common-adapters'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import * as React from 'react'
import * as Styles from '../../../styles'
import Separator from './separator'
import {ConvoIDContext} from './ids-context'
import HelloBotCard from './cards/hello-bot'
import MakeTeamCard from './cards/make-team'
import NewChatCard from './cards/new-chat'
import ProfileResetNotice from './system-profile-reset-notice/container'
import RetentionNotice from './retention-notice/container'
import shallowEqual from 'shallowequal'
import {usingFlashList} from '../list-area/flashlist-config'

const ErrorMessage = () => {
  const createConversationError = Constants.useState(s => s.createConversationError)
  const createConversation = Constants.useState(s => s.dispatch.createConversation)
  const dispatch = Container.useDispatch()

  const _onCreateWithoutThem = React.useCallback(
    (allowedUsers: Array<string>) => {
      createConversation(allowedUsers)
    },
    [createConversation]
  )

  const _onBack = React.useCallback(() => {
    dispatch(Chat2Gen.createNavigateToInbox())
  }, [dispatch])

  const onBack = Styles.isMobile ? _onBack : null

  let createConversationDisallowedUsers: Array<string> = []
  let createConversationErrorDescription = ''
  let createConversationErrorHeader = ''
  let onCreateWithoutThem: (() => void) | undefined
  if (createConversationError) {
    const {allowedUsers, code, disallowedUsers, message} = createConversationError
    if (code === RPCTypes.StatusCode.scteamcontactsettingsblock) {
      if (disallowedUsers.length === 1 && allowedUsers.length === 0) {
        // One-on-one conversation.
        createConversationErrorHeader = `You cannot start a conversation with @${disallowedUsers[0]}.`
        createConversationErrorDescription = `@${disallowedUsers[0]}'s contact restrictions prevent you from getting in touch. Contact them outside Keybase to proceed.`
      } else {
        // Group conversation.
        createConversationDisallowedUsers = disallowedUsers
        createConversationErrorHeader = 'The following people cannot be added to the conversation:'
        createConversationErrorDescription =
          'Their contact restrictions prevent you from getting in touch. Contact them outside Keybase to proceed.'
        if (disallowedUsers.length > 0 && allowedUsers.length > 0) {
          onCreateWithoutThem = () => _onCreateWithoutThem(allowedUsers)
        }
      }
    } else {
      createConversationErrorHeader = 'There was an error creating the conversation.'
      createConversationErrorDescription = message
    }
  }

  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      fullHeight={true}
      gap="small"
      gapStart={true}
      centerChildren={true}
    >
      <Kb.Icon color={Styles.globalColors.black_20} sizeType="Huge" type="iconfont-warning" />
      <Kb.Text center={true} style={styles.errorText} type="Header">
        {createConversationErrorHeader}
      </Kb.Text>
      {createConversationDisallowedUsers.length > 0 && (
        <>
          {createConversationDisallowedUsers.map((username, idx) => (
            <Kb.ListItem2
              key={username}
              type={Styles.isMobile ? 'Large' : 'Small'}
              icon={<Kb.Avatar size={Styles.isMobile ? 48 : 32} username={username} />}
              firstItem={idx === 0}
              body={
                <Kb.Box2 direction="vertical" fullWidth={true}>
                  <Kb.Text type="BodySemibold">{username}</Kb.Text>
                </Kb.Box2>
              }
            />
          ))}
        </>
      )}
      <Kb.Text center={true} type="BodyBig" style={styles.errorText} selectable={true}>
        {createConversationErrorDescription}
      </Kb.Text>
      <Kb.ButtonBar direction={Styles.isMobile ? 'column' : 'row'} fullWidth={true} style={styles.buttonBar}>
        {onCreateWithoutThem && (
          <Kb.WaitingButton type="Default" label="Create without them" onClick={onCreateWithoutThem} />
        )}
        {onBack && (
          <Kb.WaitingButton
            type={onCreateWithoutThem ? 'Dim' : 'Default'}
            label={onCreateWithoutThem ? 'Cancel' : 'Okay'}
            onClick={onBack}
          />
        )}
      </Kb.ButtonBar>
    </Kb.Box2>
  )
}

const SpecialTopMessage = React.memo(function SpecialTopMessage() {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const username = ConfigConstants.useCurrentUserState(s => s.username)
  const loadMoreType = Constants.useContext(s => (s.moreToLoad ? 'moreToLoad' : 'noMoreToLoad'))
  const ordinals = Constants.useContext(s => s.messageOrdinals)
  const data = Constants.useContext(s => {
    const hasLoadedEver = ordinals !== undefined
    const ordinal = ordinals?.[0] ?? 0

    const meta = s.meta
    const {teamType, supersedes, retentionPolicy, teamRetentionPolicy} = meta

    return {
      hasLoadedEver,
      loadMoreType,
      ordinal,
      retentionPolicy,
      supersedes,
      teamRetentionPolicy,
      teamType,
      username,
    }
  }, shallowEqual)
  const {hasLoadedEver, ordinal, retentionPolicy} = data
  const {supersedes, teamType, teamRetentionPolicy} = data
  // we defer showing this so it doesn't flash so much
  const [allowDigging, setAllowDigging] = React.useState(false)
  const [lastOrdinal, setLastOrdinal] = React.useState(ordinal)

  const digTimerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>()
  if (ordinal !== lastOrdinal) {
    setAllowDigging(false)
    setLastOrdinal(ordinal)
    digTimerRef.current && clearTimeout(digTimerRef.current)
    digTimerRef.current = setTimeout(() => {
      setAllowDigging(true)
    }, 3000)
  }

  React.useEffect(() => {
    return () => {
      digTimerRef.current && clearTimeout(digTimerRef.current)
    }
  }, [])

  // could not expose this and just return an enum for the is*convos
  const participantInfoAll = Constants.useContext(s => s.participants.all)

  let pendingState: 'waiting' | 'error' | 'done'
  switch (conversationIDKey) {
    case Constants.pendingWaitingConversationIDKey:
      pendingState = 'waiting'
      break
    case Constants.pendingErrorConversationIDKey:
      pendingState = 'error'
      break
    default:
      pendingState = 'done'
      break
  }
  const showTeamOffer =
    hasLoadedEver && loadMoreType === 'noMoreToLoad' && teamType === 'adhoc' && participantInfoAll.length > 2
  const hasOlderResetConversation = supersedes !== Constants.noConversationIDKey
  // don't show default header in the case of the retention notice being visible
  const showRetentionNotice =
    retentionPolicy.type !== 'retain' &&
    !(retentionPolicy.type === 'inherit' && teamRetentionPolicy.type === 'retain')
  const isHelloBotConversation =
    teamType === 'adhoc' && participantInfoAll.length === 2 && participantInfoAll.includes('hellobot')
  const isSelfConversation =
    teamType === 'adhoc' && participantInfoAll.length === 1 && participantInfoAll.includes(username)

  const openPrivateFolder = React.useCallback(() => {
    FsConstants.makeActionForOpenPathInFilesTab(FsTypes.stringToPath(`/keybase/private/${username}`))
  }, [username])

  return (
    <Kb.Box>
      {loadMoreType === 'noMoreToLoad' && showRetentionNotice && (
        <RetentionNotice conversationIDKey={conversationIDKey} />
      )}
      <Kb.Box style={styles.spacer} />
      {hasOlderResetConversation && <ProfileResetNotice />}
      {pendingState === 'waiting' && (
        <Kb.Box style={styles.more}>
          <Kb.Text type="BodySmall">Loading...</Kb.Text>
        </Kb.Box>
      )}
      {pendingState === 'error' && <ErrorMessage />}
      {loadMoreType === 'noMoreToLoad' && !showRetentionNotice && pendingState === 'done' && (
        <Kb.Box style={styles.more}>
          {isHelloBotConversation ? (
            <HelloBotCard />
          ) : (
            <NewChatCard self={isSelfConversation} openPrivateFolder={openPrivateFolder} />
          )}
        </Kb.Box>
      )}
      {showTeamOffer && (
        <Kb.Box style={styles.more}>
          <MakeTeamCard conversationIDKey={conversationIDKey} />
        </Kb.Box>
      )}
      {allowDigging && loadMoreType === 'moreToLoad' && pendingState === 'done' && (
        <Kb.Box style={styles.more}>
          <Kb.Text type="BodyBig">
            <Kb.Emoji size={16} emojiName=":moyai:" />
          </Kb.Text>
          <Kb.Text type="BodySmallSemibold">Digging ancient messages...</Kb.Text>
        </Kb.Box>
      )}
      {!Styles.isMobile || usingFlashList ? (
        <Separator trailingItem={ordinal} leadingItem={undefined} />
      ) : (
        // special case here with the sep. The flatlist and flashlist invert the leading-trailing, see useReduxFast
        <Separator trailingItem={0} leadingItem={ordinal} />
      )}
    </Kb.Box>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      buttonBar: {padding: Styles.globalMargins.small},
      errorText: {padding: Styles.globalMargins.small},
      more: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        paddingBottom: Styles.globalMargins.medium,
        width: '100%',
      },
      spacer: {height: Styles.globalMargins.small},
    }) as const
)

export default SpecialTopMessage
