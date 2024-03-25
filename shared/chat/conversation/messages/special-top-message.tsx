import * as C from '@/constants'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import Separator from './separator'
import HelloBotCard from './cards/hello-bot'
import MakeTeamCard from './cards/make-team'
import NewChatCard from './cards/new-chat'
import ProfileResetNotice from './system-profile-reset-notice/container'
import RetentionNotice from './retention-notice/container'
import {usingFlashList} from '../list-area/flashlist-config'

const ErrorMessage = () => {
  const createConversationError = C.useChatState(s => s.createConversationError)
  const createConversation = C.useChatState(s => s.dispatch.createConversation)

  const _onCreateWithoutThem = React.useCallback(
    (allowedUsers: ReadonlyArray<string>) => {
      createConversation(allowedUsers)
    },
    [createConversation]
  )

  const navigateToInbox = C.useChatState(s => s.dispatch.navigateToInbox)
  const _onBack = React.useCallback(() => {
    navigateToInbox()
  }, [navigateToInbox])
  const onBack = Kb.Styles.isMobile ? _onBack : undefined

  let createConversationDisallowedUsers: ReadonlyArray<string> = []
  let createConversationErrorDescription = ''
  let createConversationErrorHeader = ''
  let onCreateWithoutThem: (() => void) | undefined
  if (createConversationError) {
    const {allowedUsers, code, disallowedUsers, message} = createConversationError
    if (code === (T.RPCGen.StatusCode.scteamcontactsettingsblock as number)) {
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
      <Kb.Icon color={Kb.Styles.globalColors.black_20} sizeType="Huge" type="iconfont-warning" />
      <Kb.Text center={true} style={styles.errorText} type="Header">
        {createConversationErrorHeader}
      </Kb.Text>
      {createConversationDisallowedUsers.length > 0 && (
        <>
          {createConversationDisallowedUsers.map((username, idx) => (
            <Kb.ListItem2
              key={username}
              type={Kb.Styles.isMobile ? 'Large' : 'Small'}
              icon={<Kb.Avatar size={Kb.Styles.isMobile ? 48 : 32} username={username} />}
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
      <Kb.ButtonBar
        direction={Kb.Styles.isMobile ? 'column' : 'row'}
        fullWidth={true}
        style={styles.buttonBar}
      >
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
  const username = C.useCurrentUserState(s => s.username)
  const loadMoreType = C.useChatContext(s => (s.moreToLoad ? 'moreToLoad' : 'noMoreToLoad'))
  const ordinals = C.useChatContext(s => s.messageOrdinals)
  const data = C.useChatContext(
    C.useShallow(s => {
      const hasLoadedEver = ordinals !== undefined
      const ordinal = ordinals?.[0] ?? T.Chat.numberToOrdinal(0)
      const meta = s.meta
      const {teamType, supersedes, retentionPolicy, teamRetentionPolicy} = meta
      return {
        hasLoadedEver,
        ordinal,
        retentionPolicy,
        supersedes,
        teamRetentionPolicy,
        teamType,
      }
    })
  )
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
  const participantInfoAll = C.useChatContext(s => s.participants.all)

  const pendingState = C.useChatContext(s => {
    switch (s.id) {
      case C.Chat.pendingWaitingConversationIDKey:
        return 'waiting'
      case C.Chat.pendingErrorConversationIDKey:
        return 'error'
      default:
        return 'done'
    }
  })

  const showTeamOffer =
    hasLoadedEver && loadMoreType === 'noMoreToLoad' && teamType === 'adhoc' && participantInfoAll.length > 2
  const hasOlderResetConversation = supersedes !== C.Chat.noConversationIDKey
  // don't show default header in the case of the retention notice being visible
  const showRetentionNotice =
    retentionPolicy.type !== 'retain' &&
    !(retentionPolicy.type === 'inherit' && teamRetentionPolicy.type === 'retain')
  const isHelloBotConversation =
    teamType === 'adhoc' && participantInfoAll.length === 2 && participantInfoAll.includes('hellobot')
  const isSelfConversation =
    teamType === 'adhoc' && participantInfoAll.length === 1 && participantInfoAll.includes(username)

  const openPrivateFolder = React.useCallback(() => {
    C.FS.makeActionForOpenPathInFilesTab(T.FS.stringToPath(`/keybase/private/${username}`))
  }, [username])

  return (
    <Kb.Box>
      {loadMoreType === 'noMoreToLoad' && showRetentionNotice && <RetentionNotice />}
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
          <MakeTeamCard />
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
      {!Kb.Styles.isMobile || usingFlashList ? null : (
        // special case here with the sep. The flatlist and flashlist invert the leading-trailing, see useStateFast
        <Separator trailingItem={T.Chat.numberToOrdinal(0)} leadingItem={ordinal} />
      )}
    </Kb.Box>
  )
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      buttonBar: {padding: Kb.Styles.globalMargins.small},
      errorText: {padding: Kb.Styles.globalMargins.small},
      more: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        paddingBottom: Kb.Styles.globalMargins.medium,
        width: '100%',
      },
      spacer: {height: Kb.Styles.globalMargins.small},
    }) as const
)

export default SpecialTopMessage
