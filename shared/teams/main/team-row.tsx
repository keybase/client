import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import * as Container from '../../util/container'
import * as Chat2Gen from '../../actions/chat2-gen'
import TeamMenu from '../team/menu-container'
import {pluralize} from '../../util/string'
import {Activity} from '../common'

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
  const activityLevel = Container.useSelector(s => s.teams.activityLevels.teams.get(teamID) || 'none')

  const onViewTeam = () =>
    dispatch(nav.safeNavigateAppendPayload({path: [{props: {teamID}, selected: 'team'}]}))

  const activity = <Activity level={activityLevel} />

  const onChat = () =>
    dispatch(Chat2Gen.createPreviewConversation({reason: 'teamRow', teamname: teamMeta.teamname}))

  const {popup, popupAnchor, setShowingPopup, showingPopup} = Kb.usePopup(getAttachmentRef => (
    <TeamMenu
      teamID={teamID}
      attachTo={getAttachmentRef}
      onHidden={() => setShowingPopup(false)}
      visible={showingPopup}
    />
  ))

  const badgeCount = Container.useSelector(s => s.teams.newTeamRequests.get(teamID)?.size ?? 0)

  return (
    <>
      <Kb.ListItem2
        type="Small"
        firstItem={firstItem}
        onClick={onViewTeam}
        icon={
          <Kb.Box2
            direction="vertical"
            fullHeight={true}
            centerChildren={true}
            style={Styles.globalStyles.positionRelative}
          >
            <Kb.Avatar size={32} teamname={teamMeta.teamname} isTeam={true} />
            {!!badgeCount && <Kb.Badge badgeNumber={badgeCount} badgeStyle={styles.badge} />}
          </Kb.Box2>
        }
        height={Styles.isMobile ? 72 : undefined}
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
              <Kb.Box2 direction="horizontal" fullHeight={true} alignItems="center" style={styles.bodyRight}>
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
              ref={popupAnchor}
            />
          </Kb.Box2>
        }
        onlyShowActionOnHover="fade"
      />
      {popup}
    </>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  badge: {
    position: 'absolute',
    right: -5,
    top: -5,
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
