import * as ChatTypes from '../../../constants/types/chat2'
import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters'
import * as React from 'react'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as RowSizes from './sizes'
import * as Styles from '../../../styles'
import * as TabsContants from '../../../constants/tabs'
import * as TeamConstants from '../../../constants/teams'
import * as TeamTypes from '../../../constants/types/teams'
import TeamMenu from '../../conversation/info-panel/menu/container'

type Props = {
  conversationIDKey: ChatTypes.ConversationIDKey
  navKey: string
  teamname: string
  teamID: TeamTypes.TeamID
}

const BigTeamHeader = React.memo((props: Props) => {
  const {navKey, teamID, teamname, conversationIDKey} = props
  const dispatch = Container.useDispatch()

  const badgeSubscribe = Container.useSelector(
    state => !TeamConstants.isTeamWithChosenChannels(state, teamname)
  )

  const onClick = () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        fromKey: navKey,
        path: [TabsContants.teamsTab, {props: {teamID}, selected: 'team'}],
      })
    )

  const {showingPopup, setShowingPopup, popup, popupAnchor} = Kb.usePopup(attachTo => (
    <TeamMenu
      attachTo={attachTo}
      visible={showingPopup}
      onHidden={() => setShowingPopup(false)}
      conversationIDKey={conversationIDKey}
      teamID={teamID}
      hasHeader={true}
      isSmallTeam={false}
    />
  ))

  return (
    <Kb.Box style={styles.teamRowContainer}>
      {popup}
      <Kb.Avatar onClick={onClick} teamname={teamname} size={32} />
      <Kb.BoxGrow style={styles.teamnameContainer}>
        <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true} style={{alignItems: 'center'}}>
          <Kb.Text
            ellipsizeMode="middle"
            onClick={onClick}
            type="BodySmallSemibold"
            style={styles.team}
            lineClamp={1}
          >
            {teamname}
          </Kb.Text>
        </Kb.Box2>
      </Kb.BoxGrow>
      <Kb.ClickableBox
        className="hover_container"
        onClick={() => setShowingPopup(!showingPopup)}
        ref={popupAnchor}
        style={styles.showMenu}
      >
        <Kb.Icon
          className="hover_contained_color_black"
          color={Styles.globalColors.black_35}
          type="iconfont-gear"
        />
        <Kb.Box style={Styles.collapseStyles([styles.badge, badgeSubscribe && styles.badgeVisible])} />
      </Kb.ClickableBox>
    </Kb.Box>
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
          color: Styles.globalColors.black_50,
          letterSpacing: 0.2,
          marginLeft: Styles.globalMargins.tiny,
          marginRight: Styles.globalMargins.tiny,
        },
        isPhone: {backgroundColor: Styles.globalColors.fastBlank},
      }),
      teamRowContainer: Styles.platformStyles({
        common: {
          ...Styles.globalStyles.flexBoxRow,
          alignItems: 'center',
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
      teamnameContainer: Styles.platformStyles({
        isMobile: {
          height: '100%',
        },
      }),
    } as const)
)

export default BigTeamHeader
