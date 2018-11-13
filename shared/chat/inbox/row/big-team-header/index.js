// @flow
import React from 'react'
import * as Kb from '../../../../common-adapters'
import TeamMenu from '../../../conversation/info-panel/menu/container'
import * as Styles from '../../../../styles'
import * as RowSizes from '../sizes'

type Props = {
  badgeSubscribe: boolean,
  onClick: () => void,
  teamname: string,
} & Kb.OverlayParentProps

class _BigTeamHeader extends React.PureComponent<Props> {
  render() {
    const props = this.props

    return (
      <Kb.Box style={styles.teamRowContainer}>
        <TeamMenu
          attachTo={props.getAttachmentRef}
          visible={props.showingMenu}
          onHidden={props.toggleShowingMenu}
          teamname={props.teamname}
          isSmallTeam={false}
        />
        <Kb.Avatar onClick={props.onClick} teamname={props.teamname} size={32} />
        <Kb.BoxGrow style={styles.teamnameContainer}>
          <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true} style={{alignItems: 'center'}}>
            <Kb.Text
              ellipsizeMode="middle"
              onClick={props.onClick}
              type="BodySmallSemibold"
              style={styles.team}
              lineClamp={1}
            >
              {props.teamname}
            </Kb.Text>
          </Kb.Box2>
        </Kb.BoxGrow>
        <Kb.ClickableBox
          onClick={props.toggleShowingMenu}
          ref={props.setAttachmentRef}
          style={styles.showMenu}
        >
          <Kb.Icon
            className="Kb.icon"
            type="iconfont-gear"
            fontSize={iconFontSize}
            color={Styles.globalColors.black_20}
          />
          <Kb.Box
            style={Styles.collapseStyles([
              styles.badge,
              props.badgeSubscribe && {backgroundColor: Styles.globalColors.blue},
            ])}
          />
        </Kb.ClickableBox>
      </Kb.Box>
    )
  }
}

const BigTeamHeader = Kb.OverlayParentHOC(_BigTeamHeader)
const iconFontSize = Styles.isMobile ? 20 : 16

const styles = Styles.styleSheetCreate({
  badge: {
    borderRadius: 6,
    height: 8,
    position: 'absolute',
    right: Styles.isMobile ? -1 : -3,
    top: -1,
    width: 8,
  },
  showMenu: {
    ...Styles.globalStyles.flexBoxRow,
    padding: 6,
    position: 'relative',
    right: Styles.globalMargins.xtiny,
  },
  team: Styles.platformStyles({
    common: {
      color: Styles.globalColors.black_60,
      marginLeft: Styles.globalMargins.tiny,
      marginRight: Styles.globalMargins.tiny,
    },
    isElectron: {display: 'inline'},
    isMobile: {backgroundColor: Styles.globalColors.fastBlank},
  }),
  teamnameContainer: Styles.platformStyles({
    isMobile: {
      height: '100%',
    },
  }),
  teamRowContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      flexShrink: 0,
      height: RowSizes.bigHeaderHeight,
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
    },
    isElectron: Styles.desktopStyles.clickable,
  }),
})

export {BigTeamHeader}
