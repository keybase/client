import * as C from '../../../constants'
import * as Constants from '../../../constants/chat2'
import * as Kb from '../../../common-adapters'
import * as React from 'react'
import * as RowSizes from './sizes'
import * as Styles from '../../../styles'
import * as TeamConstants from '../../../constants/teams'
import type * as TeamTypes from '../../../constants/types/teams'
import TeamMenu from '../../conversation/info-panel/menu/container'

type Props = {
  navKey: string
  teamname: string
  teamID: TeamTypes.TeamID
}

const BigTeamHeader = React.memo(function BigTeamHeader(props: Props) {
  const {navKey, teamID, teamname} = props
  const badgeSubscribe = TeamConstants.useState(s => !TeamConstants.isTeamWithChosenChannels(s, teamname))
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onClick = () => navigateAppend({props: {teamID}, selected: 'team'}, false, navKey)

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, toggleShowingPopup} = p
      return (
        <Constants.Provider id={Constants.dummyConversationIDKey}>
          <TeamMenu
            attachTo={attachTo}
            visible={true}
            onHidden={toggleShowingPopup}
            teamID={teamID}
            hasHeader={true}
            isSmallTeam={false}
          />
        </Constants.Provider>
      )
    },
    [teamID]
  )
  const {toggleShowingPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  return (
    <Kb.Box2 fullWidth={true} direction="horizontal" style={styles.teamRowContainer}>
      {popup}
      <Kb.Avatar onClick={onClick} teamname={teamname} size={32} />
      <Kb.BoxGrow2>
        <Kb.Text
          ellipsizeMode="middle"
          onClick={onClick}
          type="BodySmallSemibold"
          style={styles.team}
          lineClamp={1}
        >
          {teamname}
        </Kb.Text>
      </Kb.BoxGrow2>
      <Kb.ClickableBox
        className="hover_container"
        onClick={toggleShowingPopup}
        ref={popupAnchor}
        style={styles.showMenu}
      >
        <Kb.Icon
          className="hover_contained_color_black"
          fixOverdraw={!Styles.isTablet}
          color={Styles.globalColors.black_35}
          type="iconfont-gear"
        />
        <Kb.Box style={Styles.collapseStyles([styles.badge, badgeSubscribe && styles.badgeVisible])} />
      </Kb.ClickableBox>
    </Kb.Box2>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      badge: {
        height: 10,
        position: 'absolute',
        right: Styles.isMobile ? 4 : -4,
        top: Styles.isMobile ? 7 : -2,
        width: 10,
      },
      badgeVisible: {
        backgroundColor: Styles.globalColors.blue,
        borderColor: Styles.globalColors.blueGrey,
        borderRadius: 5,
        borderStyle: `solid`,
        borderWidth: 2,
      },
      showMenu: Styles.platformStyles({
        common: {
          ...Styles.globalStyles.flexBoxRow,
        },
        isElectron: {
          position: 'relative',
          top: Styles.globalMargins.xxtiny,
        },
        isMobile: {
          marginRight: -6,
          padding: 6,
        },
      }),
      team: Styles.platformStyles({
        common: {
          alignSelf: 'center',
          color: Styles.globalColors.black_50,
          letterSpacing: 0.2,
          marginLeft: Styles.globalMargins.tiny,
          marginRight: Styles.globalMargins.tiny,
        },
        isPhone: {backgroundColor: Styles.globalColors.fastBlank},
      }),
      teamRowContainer: Styles.platformStyles({
        common: {
          flexShrink: 0,
          height: RowSizes.bigHeaderHeight,
        },
        isElectron: {
          ...Styles.desktopStyles.clickable,
          paddingLeft: Styles.globalMargins.xsmall,
          paddingRight: Styles.globalMargins.xsmall,
        },
        isMobile: {
          paddingLeft: Styles.globalMargins.small,
          paddingRight: Styles.globalMargins.small,
        },
      }),
    }) as const
)

export default BigTeamHeader
