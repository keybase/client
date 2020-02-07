import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import * as Container from '../../util/container'
import * as Chat2Gen from '../../actions/chat2-gen'
import TeamMenu from '../team/menu-container'
import {pluralize} from '../../util/string'

type Props = {
  firstItem: boolean
  showChat?: boolean // default true
  teamID: Types.TeamID
}

const TeamRow = (props: Props) => {
  const {firstItem, showChat = true, teamID} = props
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const teamMeta = Container.useSelector(s => Constants.getTeamMeta(s, teamID))

  const onViewTeam = () =>
    dispatch(nav.safeNavigateAppendPayload({path: [{props: {teamID}, selected: 'team'}]}))

  const activity = <Activity level={'extinct' /* TODO plumbing for this */} />

  const onChat = () =>
    dispatch(Chat2Gen.createPreviewConversation({reason: 'teamRow', teamname: teamMeta.teamname}))

  const popupRoot = React.useRef(null)
  const {popup, setShowingPopup, showingPopup} = Kb.usePopup(popupRoot, () => (
    <TeamMenu
      teamID={teamID}
      attachTo={() => popupRoot.current}
      onHidden={() => setShowingPopup(false)}
      visible={showingPopup}
    />
  ))

  return (
    <>
      <Kb.ListItem2
        type="Small"
        firstItem={firstItem}
        onClick={onViewTeam}
        icon={<Kb.Avatar size={32} teamname={teamMeta.teamname} isTeam={true} />}
        height={Styles.isMobile ? 90 : undefined}
        body={
          <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true} style={styles.bodyContainer}>
            <Kb.Box2 direction="horizontal" fullHeight={true} alignItems="center" style={styles.bodyLeft}>
              <Kb.Box2
                direction="vertical"
                fullHeight={true}
                alignItems="flex-start"
                style={styles.bodyLeftText}
              >
                <Kb.Box2 direction="horizontal" gap="xtiny" alignSelf="flex-start" alignItems="center">
                  <Kb.Text type="BodySemibold" lineClamp={1} ellipsizeMode="middle">
                    {teamMeta.teamname}
                  </Kb.Text>
                  {teamMeta.isOpen && (
                    <Kb.Meta
                      title="open"
                      backgroundColor={Styles.globalColors.green}
                      style={styles.openMeta}
                    />
                  )}
                </Kb.Box2>
                <Kb.Text type="BodySmall">
                  {teamMeta.memberCount.toLocaleString()} {pluralize('member', teamMeta.memberCount)}
                </Kb.Text>
                {Styles.isMobile && activity}
              </Kb.Box2>
            </Kb.Box2>
            {!Styles.isMobile && (
              <Kb.Box2 direction="horizontal" fullHeight={true} style={styles.bodyRight}>
                {activity}
              </Kb.Box2>
            )}
          </Kb.Box2>
        }
        action={
          <Kb.Box2 direction="horizontal" gap={Styles.isMobile ? 'tiny' : 'xtiny'}>
            {showChat && (
              <Kb.Button
                type="Dim"
                onClick={onChat}
                disabled={!teamMeta.isMember}
                mode="Secondary"
                small={true}
                icon="iconfont-chat"
                tooltip={!teamMeta.isMember ? 'You are not a member of this team.' : ''}
              />
            )}
            <Kb.Button
              type="Dim"
              onClick={() => setShowingPopup(true)}
              mode="Secondary"
              small={true}
              icon="iconfont-ellipsis"
              tooltip=""
              ref={popupRoot}
            />
          </Kb.Box2>
        }
        onlyShowActionOnHover="fade"
      />
      {popup}
    </>
  )
}

type ActivityLevel = 'active' | 'recently' | 'extinct'
const activityToIcon: {[key in ActivityLevel]: Kb.IconType} = {
  active: 'iconfont-fire',
  extinct: 'iconfont-rip',
  recently: 'iconfont-team-leave',
}
const activityToLabel = {
  active: 'Active',
  extinct: 'Extinct',
  recently: 'Recently active',
}
const Activity = ({level}: {level: ActivityLevel}) => (
  <Kb.Box2 direction="horizontal" gap="xtiny" alignItems="center" fullWidth={Styles.isMobile}>
    <Kb.Icon
      type={activityToIcon[level]}
      color={level === 'active' ? Styles.globalColors.greenDark : Styles.globalColors.black_50}
      sizeType="Small"
    />
    <Kb.Text type="BodySmall" style={level === 'active' && styles.activityActive}>
      {activityToLabel[level]}
    </Kb.Text>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(() => ({
  activityActive: {
    color: Styles.globalColors.greenDark,
  },
  bodyContainer: {
    paddingBottom: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.tiny,
  },
  bodyLeft: {
    flex: 1,
    paddingRight: Styles.globalMargins.tiny,
  },
  bodyLeftText: {justifyContent: 'center'},
  bodyRight: {
    flex: 0.7,
  },
  openMeta: {
    alignSelf: 'center',
  },
}))

export default TeamRow
