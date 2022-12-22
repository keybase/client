import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import type {AllowedColors} from '../../../../common-adapters/text'
import * as Styles from '../../../../styles'
import {SimpleTopLine} from './top-line'
import {BottomLine} from './bottom-line'
import {Avatars, TeamAvatar} from '../../../avatars'
import * as RowSizes from '../sizes'
import type * as ChatTypes from '../../../../constants/types/chat2'
import SwipeConvActions from './swipe-conv-actions'
import type * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import './small-team.css'

export type Props = {
  backgroundColor?: string
  channelname?: string
  draft?: string
  hasUnread: boolean
  hasBottomLine: boolean
  hasResetUsers: boolean
  isDecryptingSnippet: boolean
  isFinalized: boolean
  isMuted: boolean
  isSelected: boolean
  isTypingSnippet: boolean
  isTeam: boolean
  layoutSnippet?: string
  onHideConversation: () => void
  onMuteConversation: () => void
  onSelectConversation?: () => void
  participantNeedToRekey: boolean
  participants: Array<string>
  snippet: string
  name: string
  snippetDecoration: RPCChatTypes.SnippetDecoration
  teamname: string
  conversationIDKey: ChatTypes.ConversationIDKey
  timestamp: string
  usernameColor: AllowedColors
  youAreReset: boolean
  youNeedToRekey: boolean
  isInWidget?: boolean
  swipeCloseRef?: React.MutableRefObject<(() => void) | null>
}

const SmallTeam = React.memo(function (p: Props) {
  const {backgroundColor, channelname, draft, hasBottomLine, hasResetUsers} = p
  const {isDecryptingSnippet, isFinalized, isMuted, isSelected} = p
  const {isTypingSnippet, layoutSnippet, onMuteConversation, onHideConversation} = p
  const {participants, snippet, teamname, conversationIDKey, hasUnread} = p
  const {timestamp, usernameColor, youAreReset, youNeedToRekey, isInWidget, swipeCloseRef} = p
  const {onSelectConversation, participantNeedToRekey, snippetDecoration, name, isTeam} = p

  const showBold = !isSelected && hasUnread

  const subColor = isSelected
    ? Styles.globalColors.white
    : hasUnread
    ? Styles.globalColors.black
    : Styles.globalColors.black_50

  return (
    <SwipeConvActions
      isMuted={isMuted}
      onHideConversation={onHideConversation}
      onMuteConversation={onMuteConversation}
      swipeCloseRef={swipeCloseRef}
    >
      <Kb.ClickableBox
        className={Styles.classNames('small-row', {selected: isSelected})}
        onClick={onSelectConversation}
        style={
          isInWidget
            ? Styles.collapseStyles([styles.container, {backgroundColor: backgroundColor}])
            : styles.container
        }
      >
        <Kb.Box style={Styles.collapseStyles([styles.rowContainer, styles.fastBlank] as const)}>
          {teamname ? (
            <TeamAvatar teamname={teamname} isMuted={isMuted} isSelected={isSelected} isHovered={false} />
          ) : (
            <Avatars
              backgroundColor={backgroundColor}
              isMuted={isMuted}
              isLocked={youNeedToRekey || participantNeedToRekey || isFinalized}
              isSelected={isSelected}
              participantOne={participants[0]}
              participantTwo={participants[1]}
            />
          )}
          <Kb.Box style={Styles.collapseStyles([styles.conversationRow, styles.fastBlank])}>
            <Kb.Box
              style={Styles.collapseStyles([
                Styles.globalStyles.flexBoxColumn,
                styles.flexOne,
                hasBottomLine ? styles.withBottomLine : styles.withoutBottomLine,
              ])}
            >
              <SimpleTopLine
                backgroundColor={backgroundColor}
                isSelected={isSelected}
                showGear={!isInWidget}
                timestamp={timestamp}
                usernameColor={usernameColor}
                name={name}
                isTeam={isTeam}
                conversationIDKey={conversationIDKey}
                {...(channelname ? {channelname: channelname} : {})}
              />
            </Kb.Box>
            {hasBottomLine && (
              <Kb.Box
                style={Styles.collapseStyles([
                  Styles.globalStyles.flexBoxColumn,
                  styles.flexOne,
                  {justifyContent: 'flex-start'},
                ])}
              >
                <BottomLine
                  backgroundColor={backgroundColor}
                  participantNeedToRekey={participantNeedToRekey}
                  youAreReset={youAreReset}
                  showBold={showBold}
                  snippet={snippet || layoutSnippet || ''}
                  snippetDecoration={snippetDecoration}
                  subColor={subColor}
                  hasResetUsers={hasResetUsers}
                  youNeedToRekey={youNeedToRekey}
                  isSelected={isSelected}
                  isDecryptingSnippet={isDecryptingSnippet}
                  isTypingSnippet={isTypingSnippet}
                  draft={draft}
                />
              </Kb.Box>
            )}
          </Kb.Box>
        </Kb.Box>
      </Kb.ClickableBox>
    </SwipeConvActions>
  )
})

const styles = Styles.styleSheetCreate(() => ({
  container: Styles.platformStyles({
    common: {
      flexShrink: 0,
      height: RowSizes.smallRowHeight,
    },
    isMobile: {
      marginLeft: Styles.globalMargins.xtiny,
      marginRight: Styles.globalMargins.xtiny,
    },
  }),
  conversationRow: {
    ...Styles.globalStyles.flexBoxColumn,
    flexGrow: 1,
    height: '100%',
    justifyContent: 'center',
    paddingLeft: Styles.globalMargins.tiny,
  },
  fastBlank: Styles.platformStyles({
    isPhone: {
      backgroundColor: Styles.globalColors.fastBlank,
    },
  }),
  flexOne: {
    flex: 1,
  },
  rowContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      height: '100%',
      paddingLeft: Styles.globalMargins.xsmall,
      paddingRight: Styles.globalMargins.xsmall,
    },
    isElectron: Styles.desktopStyles.clickable,
  }),
  withBottomLine: {
    justifyContent: 'flex-end',
    paddingBottom: Styles.globalMargins.xxtiny,
  },
  withoutBottomLine: {justifyContent: 'center'},
}))

export {SmallTeam}
