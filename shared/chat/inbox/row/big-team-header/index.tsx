import React from 'react'
import * as Kb from '../../../../common-adapters'
import TeamMenu from '../../../conversation/info-panel/menu/container'
import * as Styles from '../../../../styles'
import * as RowSizes from '../sizes'
import * as ChatTypes from '../../../../constants/types/chat2'
import * as TeamTypes from '../../../../constants/types/teams'

type Props = {
  badgeSubscribe: boolean
  onClick: () => void
  teamname: string
  teamID: TeamTypes.TeamID
  conversationIDKey: ChatTypes.ConversationIDKey
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
          conversationIDKey={props.conversationIDKey}
          teamID={props.teamID}
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
          className="hover_container"
          onClick={props.toggleShowingMenu}
          ref={props.setAttachmentRef}
          style={styles.showMenu}
        >
          <Kb.Icon
            className="hover_contained_color_black"
            color={Styles.globalColors.black_35}
            type="iconfont-gear"
          />
          <Kb.Box
            style={Styles.collapseStyles([styles.badge, props.badgeSubscribe && styles.badgeVisible])}
          />
        </Kb.ClickableBox>
      </Kb.Box>
    )
  }
}

const BigTeamHeader = Kb.OverlayParentHOC(_BigTeamHeader)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      badge: {
        height: 8,
        position: 'absolute',
        right: Styles.isMobile ? 4 : 2,
        top: Styles.isMobile ? 7 : 4,
        width: 8,
      },
      badgeVisible: {
        backgroundColor: Styles.globalColors.blue,
        borderColor: Styles.globalColors.blueGrey,
        borderRadius: Styles.borderRadius,
        borderStyle: `solid`,
        borderWidth: 1,
      },
      showMenu: {
        ...Styles.globalStyles.flexBoxRow,
        padding: 6,
        position: 'relative',
        top: Styles.globalMargins.xxtiny,
      },
      team: Styles.platformStyles({
        common: {
          color: Styles.globalColors.black_50,
          letterSpacing: 0.2,
          marginLeft: Styles.globalMargins.tiny,
          marginRight: Styles.globalMargins.tiny,
        },
        isMobile: {backgroundColor: Styles.globalColors.fastBlank},
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
      teamnameContainer: Styles.platformStyles({
        isMobile: {
          height: '100%',
        },
      }),
    } as const)
)

export {BigTeamHeader}
