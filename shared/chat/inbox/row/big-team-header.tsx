import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as RowSizes from './sizes'
import type * as T from '@/constants/types'
import TeamMenu from '@/chat/conversation/info-panel/menu/container'

type Props = {
  navKey: string
  teamname: string
  teamID: T.Teams.TeamID
}

const BigTeamHeader = React.memo(function BigTeamHeader(props: Props) {
  const {teamID, teamname} = props
  const badgeSubscribe = C.useTeamsState(s => !C.Teams.isTeamWithChosenChannels(s, teamname))
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onClick = () => navigateAppend({props: {teamID}, selected: 'team'})

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p
      return (
        <C.ChatProvider id="" canBeNull={true}>
          <TeamMenu
            attachTo={attachTo}
            visible={true}
            onHidden={hidePopup}
            teamID={teamID}
            hasHeader={true}
            isSmallTeam={false}
          />
        </C.ChatProvider>
      )
    },
    [teamID]
  )
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

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
        onClick={showPopup}
        ref={popupAnchor}
        style={styles.showMenu}
      >
        <Kb.Icon
          className="hover_contained_color_black"
          fixOverdraw={!Kb.Styles.isTablet}
          color={Kb.Styles.globalColors.black_35}
          type="iconfont-gear"
        />
        <Kb.Box style={Kb.Styles.collapseStyles([styles.badge, badgeSubscribe && styles.badgeVisible])} />
      </Kb.ClickableBox>
    </Kb.Box2>
  )
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      badge: {
        height: 10,
        position: 'absolute',
        right: Kb.Styles.isMobile ? 4 : -4,
        top: Kb.Styles.isMobile ? 7 : -2,
        width: 10,
      },
      badgeVisible: {
        backgroundColor: Kb.Styles.globalColors.blue,
        borderColor: Kb.Styles.globalColors.blueGrey,
        borderRadius: 5,
        borderStyle: `solid`,
        borderWidth: 2,
      },
      showMenu: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.globalStyles.flexBoxRow,
        },
        isElectron: {
          alignSelf: 'center',
          position: 'relative',
        },
        isMobile: {
          marginRight: -6,
          padding: 6,
        },
      }),
      team: Kb.Styles.platformStyles({
        common: {
          alignSelf: 'center',
          color: Kb.Styles.globalColors.black_50,
          letterSpacing: 0.2,
          marginLeft: Kb.Styles.globalMargins.tiny,
          marginRight: Kb.Styles.globalMargins.tiny,
        },
        isPhone: {backgroundColor: Kb.Styles.globalColors.fastBlank},
      }),
      teamRowContainer: Kb.Styles.platformStyles({
        common: {
          flexShrink: 0,
          height: RowSizes.bigHeaderHeight,
        },
        isElectron: {
          ...Kb.Styles.desktopStyles.clickable,
          paddingLeft: Kb.Styles.globalMargins.xsmall,
          paddingRight: Kb.Styles.globalMargins.xsmall,
        },
        isMobile: {
          paddingLeft: Kb.Styles.globalMargins.small,
          paddingRight: Kb.Styles.globalMargins.small,
        },
      }),
    }) as const
)

export default BigTeamHeader
