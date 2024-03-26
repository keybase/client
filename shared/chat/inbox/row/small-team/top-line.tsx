import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import TeamMenu from '@/chat/conversation/info-panel/menu/container'
import {formatTimeForConversationList} from '@/util/timestamp'
import {TimeContext, ParticipantsContext} from './contexts'

type Props = {
  isSelected: boolean
  layoutName?: string
  layoutIsTeam?: boolean
  isInWidget: boolean
  layoutTime?: number
}

const Timestamp = React.memo(function Timestamp() {
  const layoutTime = React.useContext(TimeContext)
  const timeNum = C.useChatContext(s => s.meta.timestamp || layoutTime)
  const timestamp = timeNum ? formatTimeForConversationList(timeNum) : ''
  return <>{timestamp}</>
})

const Names = React.memo(function Names(p: {isSelected?: boolean; showBold: boolean; isInWidget: boolean}) {
  const participants = React.useContext(ParticipantsContext)
  const {isSelected, isInWidget, showBold} = p
  const usernameColor = isSelected ? Kb.Styles.globalColors.white : Kb.Styles.globalColors.black
  const backgroundColor = isInWidget
    ? Kb.Styles.globalColors.white
    : isSelected
      ? Kb.Styles.globalColors.blue
      : Kb.Styles.isPhone
        ? Kb.Styles.globalColors.fastBlank
        : Kb.Styles.globalColors.blueGrey
  const nameContainerStyle = React.useMemo(
    () =>
      Kb.Styles.collapseStyles([
        styles.name,
        showBold && styles.bold,
        {color: usernameColor},
        Kb.Styles.isMobile && {backgroundColor},
      ]),
    [showBold, usernameColor, backgroundColor]
  )

  const teamContainerStyle = React.useMemo(
    () => Kb.Styles.collapseStyles([styles.teamTextStyle, showBold && styles.bold, {color: usernameColor}]),
    [showBold, usernameColor]
  )
  return typeof participants === 'string' ? (
    <Kb.Box2 direction="horizontal" fullWidth={true}>
      <Kb.Text type="BodySemibold" style={teamContainerStyle}>
        {participants}
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
  )
})

const SimpleTopLine = React.memo(function SimpleTopLine(p: Props) {
  const {isSelected, isInWidget} = p
  const hasUnread = C.useChatContext(s => s.unread > 0)
  const hasBadge = C.useChatContext(s => s.badge > 0)
  const props = {
    hasBadge,
    hasUnread,
    isInWidget,
    isSelected,
  }
  return <SimpleTopLineImpl {...props} />
})

type IProps = {
  isSelected?: boolean
  isInWidget: boolean
  hasBadge: boolean
  hasUnread: boolean
}
const SimpleTopLineImpl = React.memo(function SimpleTopLineImpl(p: IProps) {
  const {isSelected, isInWidget, hasBadge, hasUnread} = p
  const showGear = !isInWidget
  const showBold = !isSelected && hasUnread
  const subColor = isSelected
    ? Kb.Styles.globalColors.white
    : hasUnread
      ? Kb.Styles.globalColors.black
      : Kb.Styles.globalColors.black_50

  const iconHoverColor = isSelected ? Kb.Styles.globalColors.white_75 : Kb.Styles.globalColors.black

  const makePopup = React.useCallback((p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p
    return (
      <TeamMenu visible={true} attachTo={attachTo} onHidden={hidePopup} hasHeader={true} isSmallTeam={true} />
    )
  }, [])
  const {showingPopup, showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  const tssubColor = (!hasBadge || isSelected) && subColor
  const timestampStyle = React.useMemo(
    () =>
      Kb.Styles.collapseStyles([
        showBold && styles.bold,
        styles.timestamp,
        tssubColor !== false && ({color: tssubColor} as any),
      ]),
    [showBold, tssubColor]
  )

  return (
    <Kb.Box style={styles.container}>
      {showGear && showingPopup && popup}
      <Kb.Box style={styles.insideContainer}>
        <Kb.Box style={styles.nameContainer}>
          <Names isSelected={isSelected} showBold={showBold} isInWidget={isInWidget} />
        </Kb.Box>
      </Kb.Box>
      <Kb.Text2 key="timestamp" type="BodyTiny" className="conversation-timestamp" style={timestampStyle}>
        <Timestamp />
      </Kb.Text2>
      {!Kb.Styles.isMobile && showGear && (
        <Kb.Icon
          type="iconfont-gear"
          className="conversation-gear"
          onClick={showPopup}
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      bold: {...Kb.Styles.globalStyles.fontBold},
      container: {
        ...Kb.Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
      },
      icon: {position: 'relative'},
      insideContainer: {
        ...Kb.Styles.globalStyles.flexBoxRow,
        flexGrow: 1,
        height: Kb.Styles.isMobile ? 21 : 17,
        position: 'relative',
      },
      name: {paddingRight: Kb.Styles.globalMargins.tiny},
      nameContainer: {
        ...Kb.Styles.globalStyles.flexBoxRow,
        ...Kb.Styles.globalStyles.fillAbsolute,
        alignItems: 'center',
      },
      teamTextStyle: Kb.Styles.platformStyles({
        isElectron: {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
      }),
      timestamp: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.fastBlank,
          color: Kb.Styles.globalColors.blueDark,
        },
        isTablet: {backgroundColor: undefined},
      }),
      unreadDotStyle: {
        backgroundColor: Kb.Styles.globalColors.orange,
        borderRadius: 6,
        height: 8,
        marginLeft: 4,
        width: 8,
      },
    }) as const
)

export {SimpleTopLine}
