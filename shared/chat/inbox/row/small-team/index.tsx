import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import {SimpleTopLine} from './top-line'
import {BottomLine} from './bottom-line'
import {Avatars, TeamAvatar} from '../../../avatars'
import * as RowSizes from '../sizes'
import type * as ChatTypes from '../../../../constants/types/chat2'
import SwipeConvActions from './swipe-conv-actions'
import './small-team.css'

export type Props = {
  hasUnread: boolean
  hasBottomLine: boolean
  isFinalized: boolean
  isMuted: boolean
  isSelected: boolean
  isTeam: boolean
  layoutSnippet?: string
  onHideConversation: () => void
  onMuteConversation: () => void
  onSelectConversation?: () => void
  participantNeedToRekey: boolean
  participants: Array<string>
  snippet: string
  name: string
  teamname: string
  conversationIDKey: ChatTypes.ConversationIDKey
  youNeedToRekey: boolean
  isInWidget: boolean
  time: number
  swipeCloseRef?: React.MutableRefObject<(() => void) | null>
}

const SmallTeam = React.memo(function (p: Props) {
  const {teamname, hasBottomLine, isFinalized, isMuted, isSelected, time} = p
  const {participants, layoutSnippet, onMuteConversation, onHideConversation} = p
  const {conversationIDKey, youNeedToRekey, isInWidget, swipeCloseRef} = p
  const {onSelectConversation, participantNeedToRekey, name, isTeam} = p

  const backgroundColor = isInWidget
    ? Styles.globalColors.white
    : isSelected
    ? Styles.globalColors.blue
    : Styles.isPhone
    ? Styles.globalColors.fastBlank
    : Styles.globalColors.blueGrey

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
            <Kb.Box2
              direction="vertical"
              style={hasBottomLine ? styles.withBottomLine : styles.withoutBottomLine}
              fullWidth={true}
            >
              <SimpleTopLine
                isSelected={isSelected}
                isInWidget={isInWidget}
                showGear={!isInWidget}
                name={name}
                isTeam={isTeam}
                time={time}
                conversationIDKey={conversationIDKey}
              />
            </Kb.Box2>
            {hasBottomLine && (
              <Kb.Box2 direction="vertical" style={styles.bottom} fullWidth={true}>
                <BottomLine
                  isInWidget={isInWidget}
                  conversationIDKey={conversationIDKey}
                  backgroundColor={backgroundColor}
                  layoutSnippet={layoutSnippet}
                  isSelected={isSelected}
                />
              </Kb.Box2>
            )}
          </Kb.Box>
        </Kb.Box>
      </Kb.ClickableBox>
    </SwipeConvActions>
  )
})

const styles = Styles.styleSheetCreate(() => ({
  bottom: {justifyContent: 'flex-start'},
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
  }),
  withBottomLine: {
    justifyContent: 'flex-end',
    paddingBottom: Styles.globalMargins.xxtiny,
  },
  withoutBottomLine: {justifyContent: 'center'},
}))

export {SmallTeam}
