import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Container from '../../../../util/container'
import * as Styles from '../../../../styles'
import TeamMenu from '../../../conversation/info-panel/menu/container'
import type * as Types from '../../../../constants/types/chat2'
import shallowEqual from 'shallowequal'
import {formatTimeForConversationList} from '../../../../util/timestamp'

type Props = {
  conversationIDKey: Types.ConversationIDKey
  isSelected: boolean
  showGear: boolean
  layoutName?: string
  layoutIsTeam?: boolean
  isInWidget: boolean
  layoutTime?: number
}

const getMeta = (state: Container.TypedState, conversationIDKey: Types.ConversationIDKey) =>
  state.chat2.metaMap.get(conversationIDKey)

const SimpleTopLine = React.memo(function SimpleTopLine(props: Props) {
  const {conversationIDKey, isSelected, showGear, layoutTime, layoutIsTeam, layoutName, isInWidget} = props

  const {hasUnread, teamname, channelname, timeNum, hasBadge} = Container.useSelector(state => {
    const hasUnread = (state.chat2.unreadMap.get(conversationIDKey) ?? 0) > 0
    const teamname = (getMeta(state, conversationIDKey)?.teamname || layoutIsTeam ? layoutName : '') || ''
    const channelname = isInWidget ? getMeta(state, conversationIDKey)?.channelname ?? '' : ''
    const timeNum = (getMeta(state, conversationIDKey)?.timestamp ?? layoutTime) || 0
    const hasBadge = (state.chat2.badgeMap.get(conversationIDKey) ?? 0) > 0
    return {
      channelname,
      hasBadge,
      hasUnread,
      teamname,
      timeNum,
    }
  }, shallowEqual)

  const timestamp = React.useMemo(() => (timeNum ? formatTimeForConversationList(timeNum) : ''), [timeNum])

  const usernameColor = isSelected ? Styles.globalColors.white : Styles.globalColors.black
  const backgroundColor = isInWidget
    ? Styles.globalColors.white
    : isSelected
    ? Styles.globalColors.blue
    : Styles.isPhone
    ? Styles.globalColors.fastBlank
    : Styles.globalColors.blueGrey
  const showBold = !isSelected && hasUnread
  const subColor = isSelected
    ? Styles.globalColors.white
    : hasUnread
    ? Styles.globalColors.black
    : Styles.globalColors.black_50

  const participants = Container.useSelector(state => {
    const participantInfo = state.chat2.participantMap.get(conversationIDKey)
    if (participantInfo?.name.length) {
      const you = state.config.username
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

  const iconHoverColor = isSelected ? Styles.globalColors.white_75 : Styles.globalColors.black

  const {showingPopup, toggleShowingPopup, popup, popupAnchor} = Kb.usePopup(attachTo => (
    <TeamMenu
      visible={showingPopup}
      attachTo={attachTo}
      onHidden={toggleShowingPopup}
      hasHeader={true}
      isSmallTeam={true}
      conversationIDKey={conversationIDKey}
    />
  ))

  const nameContainerStyle = React.useMemo(
    () =>
      Styles.collapseStyles([
        styles.name,
        showBold && styles.bold,
        {color: usernameColor},
        Styles.isMobile && {backgroundColor},
      ]) as Styles.StylesCrossPlatform,
    [showBold, usernameColor, backgroundColor]
  )

  const teamContainerStyle = React.useMemo(
    () =>
      Styles.collapseStyles([
        styles.teamTextStyle,
        showBold && styles.bold,
        {color: usernameColor},
      ]) as Styles.StylesCrossPlatform,
    [showBold, usernameColor]
  )

  const tssubColor = (!hasBadge || isSelected) && subColor
  const timestampStyle = React.useMemo(
    () =>
      Styles.collapseStyles([
        showBold && styles.bold,
        styles.timestamp,
        tssubColor !== false && ({color: tssubColor} as any),
      ]) as Styles.StylesCrossPlatform,
    [showBold, tssubColor]
  )

  return (
    <Kb.Box style={styles.container}>
      {showGear && showingPopup && popup}
      <Kb.Box style={styles.insideContainer}>
        <Kb.Box style={styles.nameContainer}>
          {teamname && channelname ? (
            <Kb.Box2 direction="horizontal" fullWidth={true}>
              <Kb.Text type="BodySemibold" style={teamContainerStyle}>
                {teamname + '#' + channelname}
              </Kb.Text>
            </Kb.Box2>
          ) : (
            <Kb.ConnectedUsernames
              backgroundMode={isSelected ? 'Terminal' : 'Normal'}
              type={showBold ? 'BodyBold' : 'BodySemibold'}
              inline={true}
              withProfileCardPopup={false}
              underline={false}
              colorBroken={false}
              colorFollowing={false}
              colorYou={false}
              commaColor={usernameColor}
              containerStyle={nameContainerStyle}
              usernames={participants}
              title={typeof participants === 'string' ? participants : participants.join(', ')}
            />
          )}
        </Kb.Box>
      </Kb.Box>
      <Kb.Text
        key="timestamp"
        type="BodyTiny"
        className={Styles.classNames({'conversation-timestamp': showGear})}
        style={timestampStyle}
      >
        {timestamp}
      </Kb.Text>
      {!Styles.isMobile && showGear && (
        <Kb.Icon
          type="iconfont-gear"
          className="conversation-gear"
          onClick={toggleShowingPopup}
          // @ts-ignore icon typing is bad
          ref={popupAnchor}
          color={subColor}
          hoverColor={iconHoverColor}
          style={styles.icon}
        />
      )}
      {hasBadge ? <Kb.Box key="unreadDot" style={styles.unreadDotStyle} /> : null}
    </Kb.Box>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      bold: {...Styles.globalStyles.fontBold},
      container: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
      },
      icon: {position: 'relative'},
      insideContainer: {
        ...Styles.globalStyles.flexBoxRow,
        flexGrow: 1,
        height: Styles.isMobile ? 21 : 17,
        position: 'relative',
      },
      name: {paddingRight: Styles.globalMargins.tiny},
      nameContainer: {
        ...Styles.globalStyles.flexBoxRow,
        ...Styles.globalStyles.fillAbsolute,
        alignItems: 'center',
      },
      teamTextStyle: Styles.platformStyles({
        isElectron: {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
      }),
      timestamp: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.fastBlank,
          color: Styles.globalColors.blueDark,
        },
        isTablet: {backgroundColor: undefined},
      }),
      unreadDotStyle: {
        backgroundColor: Styles.globalColors.orange,
        borderRadius: 6,
        height: 8,
        marginLeft: 4,
        width: 8,
      },
    } as const)
)

export {SimpleTopLine}
