import * as React from 'react'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Kb from '../../../../common-adapters'
import * as Container from '../../../../util/container'
import * as ConfigConstants from '../../../../constants/config'
import * as Styles from '../../../../styles'
import {SimpleTopLine} from './top-line'
import {BottomLine} from './bottom-line'
import {Avatars, TeamAvatar} from '../../../avatars'
import * as RowSizes from '../sizes'
import type * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import SwipeConvActions from './swipe-conv-actions'
import shallowEqual from 'shallowequal'
import './small-team.css'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import {
  IsTeamContext,
  ParticipantsContext,
  TimeContext,
  ConversationIDKeyContext,
  SnippetContext,
  SnippetDecorationContext,
} from './contexts'

export type Props = {
  conversationIDKey: Types.ConversationIDKey
  isInWidget: boolean
  isSelected: boolean
  layoutIsTeam?: boolean
  layoutName?: string
  layoutSnippet?: string
  layoutTime?: number
  swipeCloseRef?: React.MutableRefObject<(() => void) | null>
}

const SmallTeam = React.memo(function SmallTeam(p: Props) {
  const {layoutName, layoutIsTeam, layoutSnippet, isSelected, layoutTime} = p
  const {conversationIDKey, isInWidget, swipeCloseRef} = p

  const typingSnippet = Constants.useChatState(s => {
    const typers = !isInWidget ? s.typingMap.get(conversationIDKey) : undefined
    if (!typers?.size) return undefined
    return typers.size === 1
      ? `${typers.values().next().value as string} is typing...`
      : 'Multiple people typing...'
  })

  const {isDecryptingSnippet, snippet, snippetDecoration} = Container.useSelector(state => {
    const meta = state.chat2.metaMap.get(conversationIDKey)
    // only use layout if we don't have the meta at all
    const maybeLayoutSnippet = meta === undefined ? layoutSnippet : undefined
    const snippet = typingSnippet ?? meta?.snippetDecorated ?? maybeLayoutSnippet ?? ''
    const trustedState = meta?.trustedState
    const isDecryptingSnippet =
      conversationIDKey && !snippet
        ? !trustedState || trustedState === 'requesting' || trustedState === 'untrusted'
        : false
    const snippetDecoration = meta?.snippetDecoration ?? RPCChatTypes.SnippetDecoration.none
    return {isDecryptingSnippet, snippet, snippetDecoration}
  }, shallowEqual)

  const you = ConfigConstants.useCurrentUserState(s => s.username)
  const participants = Container.useSelector(state => {
    const meta = state.chat2.metaMap.get(conversationIDKey)
    const teamname = (meta?.teamname || layoutIsTeam ? layoutName : '') || ''
    const channelname = isInWidget ? meta?.channelname ?? '' : ''
    if (teamname && channelname) {
      return `${teamname}#${channelname}`
    }
    const participantInfo = state.chat2.participantMap.get(conversationIDKey)
    if (participantInfo?.name.length) {
      // Filter out ourselves unless it's our 1:1 conversation
      return participantInfo.name.filter((participant, _, list) =>
        list.length === 1 ? true : participant !== you
      )
    }
    if (layoutIsTeam && layoutName) {
      return [layoutName]
    }
    return layoutName?.split(',') ?? []
  }, shallowEqual)

  const dispatch = Container.useDispatch()
  const _onSelectConversation: () => void = Container.useEvent(() => {
    if (isInWidget) {
      dispatch(Chat2Gen.createOpenChatFromWidget({conversationIDKey}))
    } else {
      dispatch(Chat2Gen.createNavigateToThread({conversationIDKey, reason: 'inboxSmall'}))
    }
  })

  const onSelectConversation = isSelected ? undefined : _onSelectConversation

  const backgroundColor = isInWidget
    ? Styles.globalColors.white
    : isSelected
    ? Styles.globalColors.blue
    : Styles.isPhone && !Styles.isTablet
    ? Styles.globalColors.fastBlank
    : Styles.globalColors.blueGrey

  const children = React.useMemo(() => {
    return (
      <SwipeConvActions swipeCloseRef={swipeCloseRef} onClick={onSelectConversation}>
        <Kb.ClickableBox
          className={Styles.classNames('small-row', {selected: isSelected})}
          style={
            isInWidget || Styles.isTablet
              ? Styles.collapseStyles([styles.container, {backgroundColor: backgroundColor}])
              : styles.container
          }
        >
          <Kb.Box style={Styles.collapseStyles([styles.rowContainer, styles.fastBlank] as const)}>
            <RowAvatars backgroundColor={backgroundColor} isSelected={isSelected} />
            <Kb.Box style={Styles.collapseStyles([styles.conversationRow, styles.fastBlank])}>
              <Kb.Box2 direction="vertical" style={styles.withBottomLine} fullWidth={true}>
                <SimpleTopLine isSelected={isSelected} isInWidget={isInWidget} />
              </Kb.Box2>
              <BottomLine
                isDecryptingSnippet={isDecryptingSnippet}
                isInWidget={isInWidget}
                backgroundColor={backgroundColor}
                isSelected={isSelected}
              />
            </Kb.Box>
          </Kb.Box>
        </Kb.ClickableBox>
      </SwipeConvActions>
    )
  }, [backgroundColor, isDecryptingSnippet, isInWidget, isSelected, onSelectConversation, swipeCloseRef])

  return (
    <ConversationIDKeyContext.Provider value={conversationIDKey}>
      <IsTeamContext.Provider value={!!layoutIsTeam}>
        <ParticipantsContext.Provider value={participants}>
          <TimeContext.Provider value={layoutTime ?? 0}>
            <SnippetContext.Provider value={snippet}>
              <SnippetDecorationContext.Provider value={snippetDecoration}>
                {children}
              </SnippetDecorationContext.Provider>
            </SnippetContext.Provider>
          </TimeContext.Provider>
        </ParticipantsContext.Provider>
      </IsTeamContext.Provider>
    </ConversationIDKeyContext.Provider>
  )
})

type RowAvatarProps = {
  backgroundColor?: string
  isSelected: boolean
}
const RowAvatars = React.memo(function RowAvatars(p: RowAvatarProps) {
  const {backgroundColor, isSelected} = p
  const conversationIDKey = React.useContext(ConversationIDKeyContext)
  const layoutIsTeam = React.useContext(IsTeamContext)
  const participants = React.useContext(ParticipantsContext)
  const you = ConfigConstants.useCurrentUserState(s => s.username)
  const {isLocked, isMuted} = Container.useSelector(state => {
    const meta = state.chat2.metaMap.get(conversationIDKey)
    const isLocked = meta?.rekeyers?.has(you) || (meta?.rekeyers.size ?? 0) > 0 || !!meta?.wasFinalizedBy
    const isMuted = state.chat2.mutedMap.get(conversationIDKey) ?? false
    return {isLocked, isMuted}
  }, shallowEqual)

  let participantOne = ''
  let participantTwo = ''
  let teamname = ''

  if (typeof participants === 'string') {
    teamname = participants.split('#')[0] ?? ''
  } else {
    if (layoutIsTeam) {
      teamname = participants[0] ?? ''
    } else {
      participantOne = participants[0] ?? ''
      participantTwo = participants[1] ?? ''
    }
  }

  return teamname ? (
    <TeamAvatar teamname={teamname} isMuted={isMuted} isSelected={isSelected} isHovered={false} />
  ) : (
    <Avatars
      backgroundColor={backgroundColor}
      isMuted={isMuted}
      isLocked={isLocked}
      isSelected={isSelected}
      participantOne={participantOne}
      participantTwo={participantTwo}
    />
  )
})

const styles = Styles.styleSheetCreate(() => ({
  container: {
    flexShrink: 0,
    height: RowSizes.smallRowHeight,
  },
  conversationRow: {
    ...Styles.globalStyles.flexBoxColumn,
    flexGrow: 1,
    height: '100%',
    justifyContent: 'center',
    paddingLeft: Styles.globalMargins.tiny,
  },
  fastBlank: Styles.platformStyles({
    isPhone: {backgroundColor: Styles.globalColors.fastBlank},
    isTablet: {backgroundColor: undefined},
  }),
  flexOne: {flex: 1},
  rowContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      height: '100%',
      paddingLeft: Styles.globalMargins.xsmall,
      paddingRight: Styles.globalMargins.xsmall,
    },
    isElectron: Styles.desktopStyles.clickable,
    isMobile: {
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    },
  }),
  withBottomLine: {
    justifyContent: 'flex-end',
    paddingBottom: Styles.globalMargins.xxtiny,
  },
  withoutBottomLine: {justifyContent: 'center'},
}))

export {SmallTeam}
