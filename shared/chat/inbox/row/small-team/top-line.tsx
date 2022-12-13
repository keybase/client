import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import TeamMenu from '../../../conversation/info-panel/menu/container'
import type * as ChatTypes from '../../../../constants/types/chat2'
import type {AllowedColors} from '../../../../common-adapters/text'

type Props = {
  channelname?: string
  teamname?: string
  conversationIDKey: ChatTypes.ConversationIDKey
  forceShowMenu: boolean
  hasUnread: boolean
  iconHoverColor: string
  isSelected: boolean
  onForceHideMenu: () => void
  participants: Array<string> | string
  showBold: boolean
  showGear: boolean
  backgroundColor?: string
  subColor: string
  timestamp?: string
  usernameColor?: AllowedColors
  hasBadge: boolean
}

const SimpleTopLine = React.memo(function SimpleTopLine(props: Props) {
  const {backgroundColor, channelname, teamname, conversationIDKey, forceShowMenu, iconHoverColor} = props
  const {isSelected, onForceHideMenu, participants, showBold, showGear, subColor, timestamp} = props
  const {usernameColor, hasBadge} = props

  const {showingPopup, toggleShowingPopup, popup, popupAnchor} = Kb.usePopup(attachTo => (
    <TeamMenu
      visible={showingPopup || forceShowMenu}
      attachTo={attachTo}
      onHidden={onHidden}
      hasHeader={true}
      isSmallTeam={true}
      conversationIDKey={conversationIDKey}
    />
  ))

  const onHidden = React.useCallback(() => {
    toggleShowingPopup()
    onForceHideMenu()
  }, [toggleShowingPopup, onForceHideMenu])

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
      {showGear && (showingPopup || forceShowMenu) && popup}
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
      icon: {
        position: 'relative',
      },
      insideContainer: {
        ...Styles.globalStyles.flexBoxRow,
        flexGrow: 1,
        height: Styles.isMobile ? 21 : 17,
        position: 'relative',
      },
      name: {
        paddingRight: Styles.globalMargins.tiny,
      },
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
        isTablet: {
          backgroundColor: undefined,
        },
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
