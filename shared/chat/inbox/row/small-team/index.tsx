import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {SimpleTopLine} from './top-line'
import {BottomLine} from './bottom-line'
import {Avatars, TeamAvatar} from '@/chat/avatars'
import * as RowSizes from '../sizes'
import * as T from '@/constants/types'
import SwipeConvActions from './swipe-conv-actions'
import './small-team.css'
import {
  IsTeamContext,
  ParticipantsContext,
  TimeContext,
  SnippetContext,
  SnippetDecorationContext,
} from './contexts'

export type Props = {
  conversationIDKey: T.Chat.ConversationIDKey
  isInWidget: boolean
  isSelected: boolean
  layoutIsTeam?: boolean
  layoutName?: string
  layoutSnippet?: string
  layoutTime?: number
  layoutSnippetDecoration?: T.RPCChat.SnippetDecoration
  swipeCloseRef?: React.MutableRefObject<(() => void) | null>
  onSelectConversation?: () => void
}

const SmallTeam = React.memo(function SmallTeam(p: Props) {
  const {layoutName, layoutIsTeam, layoutSnippet, isSelected, layoutTime, layoutSnippetDecoration} = p
  const {isInWidget, swipeCloseRef} = p

  const {snippet, snippetDecoration} = C.useChatContext(
    C.useShallow(s => {
      const typingSnippet = (() => {
        const typers = !isInWidget ? s.typing : undefined
        if (!typers?.size) return undefined
        if (typers.size === 1) {
          const [t] = typers
          return `${t} is typing...`
        } else {
          return 'Multiple people typing...'
        }
      })()

      const {meta} = s
      // only use layout if we don't have the meta at all
      const maybeLayoutSnippet =
        meta.conversationIDKey === C.Chat.noConversationIDKey ? layoutSnippet : undefined
      const snippet = typingSnippet ?? meta.snippetDecorated ?? maybeLayoutSnippet ?? ''
      const snippetDecoration =
        meta.conversationIDKey === C.Chat.noConversationIDKey
          ? layoutSnippetDecoration ?? T.RPCChat.SnippetDecoration.none
          : meta.snippetDecoration
      return {snippet, snippetDecoration}
    })
  )
  const you = C.useCurrentUserState(s => s.username)
  const navigateToThread = C.useChatContext(s => s.dispatch.navigateToThread)
  const participants = C.useChatContext(
    C.useShallow(s => {
      const {meta} = s
      const participantInfo = s.participants
      const teamname = (meta.teamname || layoutIsTeam ? layoutName : '') || ''
      const channelname = isInWidget ? meta.channelname : ''
      if (teamname && channelname) {
        return `${teamname}#${channelname}`
      }
      if (participantInfo.name.length) {
        // Filter out ourselves unless it's our 1:1 conversation
        return participantInfo.name.filter((participant, _, list) =>
          list.length === 1 ? true : participant !== you
        )
      }
      if (layoutIsTeam && layoutName) {
        return [layoutName]
      }
      return (
        layoutName
          ?.split(',')
          .filter((participant, _, list) => (list.length === 1 ? true : participant !== you)) ?? []
      )
    })
  )

  const _onSelectConversation = React.useCallback(() => {
    navigateToThread('inboxSmall')
  }, [navigateToThread])

  const onSelectConversation = isSelected ? undefined : p.onSelectConversation ?? _onSelectConversation

  const backgroundColor = isInWidget
    ? Kb.Styles.globalColors.white
    : isSelected
      ? Kb.Styles.globalColors.blue
      : Kb.Styles.isPhone && !Kb.Styles.isTablet
        ? Kb.Styles.globalColors.fastBlank
        : Kb.Styles.globalColors.blueGrey

  const children = React.useMemo(() => {
    return (
      <SwipeConvActions swipeCloseRef={swipeCloseRef} onClick={onSelectConversation}>
        <Kb.ClickableBox
          className={Kb.Styles.classNames('small-row', {selected: isSelected})}
          style={
            isInWidget || Kb.Styles.isTablet
              ? Kb.Styles.collapseStyles([styles.container, {backgroundColor: backgroundColor}])
              : styles.container
          }
        >
          <Kb.Box style={Kb.Styles.collapseStyles([styles.rowContainer, styles.fastBlank] as const)}>
            <RowAvatars backgroundColor={backgroundColor} isSelected={isSelected} />
            <Kb.Box style={Kb.Styles.collapseStyles([styles.conversationRow, styles.fastBlank])}>
              <Kb.Box2 direction="vertical" style={styles.withBottomLine} fullWidth={true}>
                <SimpleTopLine isSelected={isSelected} isInWidget={isInWidget} />
              </Kb.Box2>
              <BottomLine
                layoutSnippet={layoutSnippet}
                isInWidget={isInWidget}
                backgroundColor={backgroundColor}
                isSelected={isSelected}
              />
            </Kb.Box>
          </Kb.Box>
        </Kb.ClickableBox>
      </SwipeConvActions>
    )
  }, [backgroundColor, isInWidget, isSelected, onSelectConversation, swipeCloseRef, layoutSnippet])

  return (
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
  )
})

type RowAvatarProps = {
  backgroundColor?: string
  isSelected: boolean
}
const RowAvatars = React.memo(function RowAvatars(p: RowAvatarProps) {
  const {backgroundColor, isSelected} = p
  const layoutIsTeam = React.useContext(IsTeamContext)
  const participants = React.useContext(ParticipantsContext)
  const isMuted = C.useChatContext(s => s.meta.isMuted)
  const you = C.useCurrentUserState(s => s.username)
  const isLocked = C.useChatContext(s => {
    const {meta} = s
    const isLocked = meta.rekeyers.has(you) || meta.rekeyers.size > 0 || !!meta.wasFinalizedBy
    return isLocked
  })

  let participantOne = ''
  let participantTwo = ''
  let teamname = ''

  if (typeof participants === 'string') {
    teamname = participants.split('#')[0] ?? ''
  } else if (layoutIsTeam) {
    teamname = participants[0] ?? ''
  } else {
    participantOne = participants[0] ?? ''
    participantTwo = participants[1] ?? ''
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    flexShrink: 0,
    height: RowSizes.smallRowHeight,
  },
  conversationRow: {
    ...Kb.Styles.globalStyles.flexBoxColumn,
    flexGrow: 1,
    height: '100%',
    justifyContent: 'center',
    paddingLeft: Kb.Styles.globalMargins.tiny,
  },
  fastBlank: Kb.Styles.platformStyles({
    isPhone: {backgroundColor: Kb.Styles.globalColors.fastBlank},
    isTablet: {backgroundColor: undefined},
  }),
  flexOne: {flex: 1},
  rowContainer: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      height: '100%',
      paddingLeft: Kb.Styles.globalMargins.xsmall,
      paddingRight: Kb.Styles.globalMargins.xsmall,
    },
    isElectron: Kb.Styles.desktopStyles.clickable,
    isMobile: {
      paddingLeft: Kb.Styles.globalMargins.small,
      paddingRight: Kb.Styles.globalMargins.small,
    },
  }),
  withBottomLine: {
    justifyContent: 'flex-end',
    paddingBottom: Kb.Styles.globalMargins.xxtiny,
  },
  withoutBottomLine: {justifyContent: 'center'},
}))

export {SmallTeam}
