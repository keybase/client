import * as React from 'react'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Kb from '../../../../common-adapters'
import * as Container from '../../../../util/container'
import * as Styles from '../../../../styles'
import {SimpleTopLine} from './top-line'
import {BottomLine} from './bottom-line'
import {Avatars, TeamAvatar} from '../../../avatars'
import * as RowSizes from '../sizes'
import type * as Types from '../../../../constants/types/chat2'
import SwipeConvActions from './swipe-conv-actions'
import shallowEqual from 'shallowequal'
import './small-team.css'

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
  const {isSelected, layoutTime} = p
  const {layoutSnippet} = p
  const {conversationIDKey, isInWidget, swipeCloseRef} = p
  const {layoutName, layoutIsTeam} = p

  const isMuted = Container.useSelector(state => state.chat2.mutedMap.get(conversationIDKey) ?? false)
  const dispatch = Container.useDispatch()
  const onHideConversation = React.useCallback(() => {
    dispatch(Chat2Gen.createHideConversation({conversationIDKey}))
  }, [dispatch, conversationIDKey])
  const onMuteConversation = React.useCallback(() => {
    dispatch(Chat2Gen.createMuteConversation({conversationIDKey, muted: !isMuted}))
  }, [dispatch, conversationIDKey, isMuted])
  const _onSelectConversation = React.useCallback(() => {
    if (isInWidget) {
      dispatch(Chat2Gen.createOpenChatFromWidget({conversationIDKey}))
    } else {
      dispatch(Chat2Gen.createNavigateToThread({conversationIDKey, reason: 'inboxSmall'}))
    }
  }, [dispatch, conversationIDKey, isInWidget])

  const onSelectConversation = isSelected ? undefined : _onSelectConversation

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
      extraData={conversationIDKey}
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
          <RowAvatars
            layoutName={layoutName}
            layoutIsTeam={layoutIsTeam}
            conversationIDKey={conversationIDKey}
            backgroundColor={backgroundColor}
            isMuted={isMuted}
            isSelected={isSelected}
          />
          <Kb.Box style={Styles.collapseStyles([styles.conversationRow, styles.fastBlank])}>
            <Kb.Box2 direction="vertical" style={styles.withBottomLine} fullWidth={true}>
              <SimpleTopLine
                isSelected={isSelected}
                isInWidget={isInWidget}
                showGear={!isInWidget}
                layoutName={layoutName}
                layoutIsTeam={layoutIsTeam}
                layoutTime={layoutTime}
                conversationIDKey={conversationIDKey}
              />
            </Kb.Box2>
            <Kb.Box2 direction="vertical" style={styles.bottom} fullWidth={true}>
              <BottomLine
                isInWidget={isInWidget}
                conversationIDKey={conversationIDKey}
                backgroundColor={backgroundColor}
                layoutSnippet={layoutSnippet}
                isSelected={isSelected}
              />
            </Kb.Box2>
          </Kb.Box>
        </Kb.Box>
      </Kb.ClickableBox>
    </SwipeConvActions>
  )
})

type RowAvatarProps = {
  conversationIDKey: Types.ConversationIDKey
  backgroundColor?: string
  isMuted: boolean
  isSelected: boolean
  layoutName?: string
  layoutIsTeam?: boolean
}
const RowAvatars = React.memo(function RowAvatars(p: RowAvatarProps) {
  const {conversationIDKey, backgroundColor, isMuted, isSelected, layoutName, layoutIsTeam} = p

  const partOneTwo = Container.useSelector(state => {
    const participantInfo = state.chat2.participantMap.get(conversationIDKey)
    let part: Array<string>
    if (participantInfo?.name.length) {
      // Filter out ourselves unless it's our 1:1 conversation
      part = participantInfo.name.filter((participant, _, list) =>
        list.length === 1 ? true : participant !== state.config.username
      )
    } else if (layoutIsTeam && layoutName) {
      part = [layoutName]
    } else {
      part = layoutName?.split(',') ?? []
    }
    return part
  }, shallowEqual)
  const participantOne = partOneTwo[0]
  const participantTwo = partOneTwo[1]
  const teamname = Container.useSelector(state =>
    state.chat2.metaMap.get(conversationIDKey)?.teamname ?? layoutIsTeam ? layoutName : ''
  )
  const isLocked = Container.useSelector(state => {
    const meta = state.chat2.metaMap.get(conversationIDKey)
    return (
      meta?.rekeyers?.has(state.config.username) || (meta?.rekeyers.size ?? 0) > 0 || !!meta?.wasFinalizedBy
    )
  })

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
    isPhone: {backgroundColor: Styles.globalColors.fastBlank},
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
