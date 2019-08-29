import * as React from 'react'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'
import DesktopStyle from '../common-adapters/desktop-style'
import {serviceIdToIconFont} from './shared'
import {ServiceIdWithContact} from '../constants/types/team-building'

export type Props = {
  username: string
  prettyName: string
  service: ServiceIdWithContact
  onRemove: () => void
}

const removeSize = Styles.isMobile ? 22 : 16

const UserBubble = (props: Props) => {
  const realCSS = `
    .hoverContainer { position: relative; }
    .hoverContainer .hoverComponent { visibility: hidden; }
    .hoverContainer:hover .hoverComponent { visibility: visible; }
    `
  const showAvatar = ['keybase', 'contact', 'phone', 'email'].includes(props.service)
  return (
    <Kb.Box2 direction="vertical" className="hoverContainer" style={styles.bubbleContainer}>
      <DesktopStyle style={realCSS} />
      <Kb.Box2 className="user" direction="horizontal" style={styles.bubble}>
        <Kb.ConnectedNameWithIcon
          colorFollowing={true}
          hideFollowingOverlay={true}
          horizontal={false}
          icon={showAvatar ? undefined : serviceIdToIconFont(props.service)}
          iconBoxStyle={showAvatar ? undefined : styles.iconBox}
          size="smaller"
          username={props.username}
        />
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" className="hoverComponent" style={styles.remove}>
        <RemoveBubble prettyName={props.prettyName} onRemove={props.onRemove} />
      </Kb.Box2>
    </Kb.Box2>
  )
}

const RemoveBubble = ({onRemove, prettyName}: {onRemove: () => void; prettyName: string}) => (
  <Kb.WithTooltip text={prettyName} position="top center">
    <Kb.ClickableBox onClick={() => onRemove()}>
      <Kb.Icon
        type="iconfont-close"
        color={Styles.globalColors.black_50_on_white}
        fontSize={Styles.isMobile ? 14 : 12}
        style={Kb.iconCastPlatformStyles(styles.removeIcon)}
      />
    </Kb.ClickableBox>
  </Kb.WithTooltip>
)

const styles = Styles.styleSheetCreate(() => ({
  bubble: Styles.platformStyles({
    common: {
      marginLeft: Styles.globalMargins.tiny,
      marginRight: Styles.globalMargins.tiny,
    },
    isElectron: {
      flexShrink: 1,
    },
  }),
  bubbleContainer: Styles.platformStyles({common: {position: 'relative'}, isMobile: {width: 91}}),
  container: Styles.platformStyles({
    common: {
      marginBottom: Styles.globalMargins.xtiny,
      marginLeft: Styles.globalMargins.tiny,
      marginTop: Styles.globalMargins.xtiny,
    },
  }),
  generalService: Styles.platformStyles({
    isElectron: {
      lineHeight: '35px',
    },
  }),
  // TODO: the service icons are too high without this - are they right?
  iconBox: Styles.platformStyles({
    isElectron: {
      marginBottom: -3,
      marginTop: 3,
    },
  }),
  remove: Styles.platformStyles({
    common: {
      alignItems: 'center',
      backgroundColor: Styles.globalColors.white,
      borderRadius: 100,
      height: removeSize,
      justifyContent: 'center',
      position: 'absolute',
      top: 0,
      width: removeSize,
    },
    isElectron: {
      cursor: 'pointer',
      marginRight: Styles.globalMargins.tiny,
      right: -4,
    },
    isMobile: {
      right: 12,
    },
  }),
  removeIcon: {
    position: 'relative',
    top: 1,
  },
}))

export default UserBubble
