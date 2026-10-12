import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as RowSizes from './sizes'
import type * as T from '@/constants/types'
import TeamMenu from '@/chat/conversation/info-panel/menu'

type Props = {
  showBadge: boolean
  teamname: string
  teamID: T.Teams.TeamID
}

const BigTeamHeader = (props: Props) => {
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
  const {showBadge, teamID, teamname} = props
  const navigateAppend = C.Router2.navigateAppend
  const onClick = () => navigateAppend({name: 'team', params: {teamID}})

  const makePopup = (p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p
    return (
      <TeamMenu
        attachTo={attachTo}
        visible={true}
        onHidden={hidePopup}
        teamID={teamID}
        hasHeader={true}
        isSmallTeam={false}
      />
    )
  }
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  return (
    <Kb.Box2 fullWidth={true} direction="horizontal" noShrink={true} style={styles.teamRowContainer}>
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
        direction="vertical"
        className="hover_container"
        onClick={showPopup}
        ref={popupAnchor}
        style={styles.showMenu}
      >
        <Kb.Icon
          className="hover_contained_color_black"
          color={theme.black_35}
          type="iconfont-gear"
        />
        <Kb.Box2
          direction="vertical"
          style={Kb.Styles.collapseStyles([styles.badge, showBadge && styles.badgeVisible])}
        />
      </Kb.ClickableBox>
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      badge: {
        height: 10,
        position: 'absolute',
        right: isMobile ? 4 : -4,
        top: isMobile ? 7 : -2,
        width: 10,
      },
      badgeVisible: {
        backgroundColor: theme.blue,
        borderColor: theme.blueGrey,
        borderRadius: 5,
        borderStyle: `solid`,
        borderWidth: 2,
      },
      showMenu: Kb.Styles.platformStyles({
        isElectron: {
          alignSelf: 'center',
          position: 'relative',
        },
        isMobile: {
          marginRight: -6,
          padding: 6,
        },
      }),
      team: {
        alignSelf: 'center',
        color: theme.black_50,
        letterSpacing: 0.2,
        ...Kb.Styles.marginH(Kb.Styles.globalMargins.tiny),
      },
      teamRowContainer: Kb.Styles.platformStyles({
        common: {
          height: RowSizes.bigHeaderHeight,
        },
        isElectron: {
          ...Kb.Styles.desktopStyles.clickable,
          ...Kb.Styles.paddingH(Kb.Styles.globalMargins.xsmall),
        },
        isMobile: {
          ...Kb.Styles.paddingH(Kb.Styles.globalMargins.small),
        },
      }),
    }) as const
)

export default BigTeamHeader
