import './team-row.css'
import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import TeamMenu from '../team/menu-container'
import {pluralize} from '@/util/string'
import {Activity} from '../common'
import * as Teams from '@/stores/teams'
import {useTeamsState} from '@/stores/teams'

type Props = {
  showChat?: boolean // default true
  teamID: T.Teams.TeamID
}

const TeamRow = function TeamRow(props: Props) {
  const {showChat = true, teamID} = props
  const navigateAppend = C.Router2.navigateAppend
  const data = useTeamsState(
    C.useShallow(s => {
      const teamMeta = Teams.getTeamMeta(s, teamID)
      const activityLevel = s.activityLevels.teams.get(teamID) || 'none'
      const badgeCount = Teams.getTeamRowBadgeCount(s.newTeamRequests, s.teamIDToResetUsers, teamID)
      const isNew = s.newTeams.has(teamID)
      return {activityLevel, badgeCount, isNew, teamMeta}
    })
  )
  const {activityLevel, badgeCount, isNew, teamMeta} = data

  const onViewTeam = () => navigateAppend({name: 'team', params: {teamID}})

  const activity = <Activity level={activityLevel} />

  const previewConversation = Chat.useChatState(s => s.dispatch.previewConversation)
  const onChat = () => previewConversation({reason: 'teamRow', teamname: teamMeta.teamname})

  const makePopup = (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p
      return <TeamMenu teamID={teamID} attachTo={attachTo} onHidden={hidePopup} visible={true} />
    }
  const {popup, popupAnchor, showPopup} = Kb.usePopup2(makePopup)

  const crownIconType: Kb.IconType | undefined =
    teamMeta.role === 'owner'
      ? 'iconfont-crown-owner'
      : teamMeta.role === 'admin'
        ? 'iconfont-crown-admin'
        : undefined
  const crownIcon = crownIconType ? (
    <Kb.Box2 direction="vertical" style={styles.crownIconBox} centerChildren={true}>
      <Kb.Icon
        type={crownIconType}
        sizeType="Tiny"
        color={teamMeta.role === 'owner' ? Kb.Styles.globalColors.yellowDark : Kb.Styles.globalColors.black_35}
        style={styles.crownIcon}
      />
    </Kb.Box2>
  ) : null

  if (Kb.Styles.isMobile) {
    return (
      <>
        <Kb.ClickableBox onClick={onViewTeam} style={styles.clickableBox}>
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.row} alignItems="center">
            <Kb.Divider style={styles.divider} />
            <Kb.Box2 direction="vertical" centerChildren={true} style={styles.avatarContainer}>
              <Kb.Box2 direction="vertical" style={styles.avatarInner} centerChildren={true}>
                <Kb.Avatar size={32} teamname={teamMeta.teamname} isTeam={true} />
                {!!badgeCount && <Kb.Badge badgeNumber={badgeCount} badgeStyle={styles.badge} />}
                {crownIcon}
              </Kb.Box2>
            </Kb.Box2>
            <Kb.Box2 direction="vertical" flex={1} justifyContent="center" style={styles.bodyMobile}>
              <Kb.Box2 direction="horizontal" gap="xtiny" alignSelf="flex-start" alignItems="center">
                <Kb.Text type="BodySemibold" lineClamp={1} ellipsizeMode="middle">
                  {teamMeta.teamname}
                </Kb.Text>
                {teamMeta.isOpen && (
                  <Kb.Meta title="open" backgroundColor={Kb.Styles.globalColors.green} style={styles.alignSelfCenter} />
                )}
              </Kb.Box2>
              <Kb.Box2 direction="horizontal" alignItems="center" gap="tiny" alignSelf="flex-start">
                {isNew && (
                  <Kb.Meta title="new" backgroundColor={Kb.Styles.globalColors.orange} style={styles.alignSelfCenter} />
                )}
                <Kb.Text type="BodySmall">
                  {teamMeta.memberCount.toLocaleString()} {pluralize('member', teamMeta.memberCount)}
                </Kb.Text>
              </Kb.Box2>
              {activity}
            </Kb.Box2>
            <Kb.Box2 direction="horizontal" gap="tiny" alignItems="center" style={styles.actionMobile}>
              {showChat && (
                <Kb.IconButton
                  type="Dim"
                  onClick={onChat}
                  disabled={!teamMeta.isMember}
                  mode="Secondary"
                  small={true}
                  icon="iconfont-chat"
                />
              )}
              <Kb.IconButton
                type="Dim"
                onClick={showPopup}
                mode="Secondary"
                small={true}
                icon="iconfont-ellipsis"
                ref={popupAnchor}
              />
            </Kb.Box2>
          </Kb.Box2>
        </Kb.ClickableBox>
        {popup}
      </>
    )
  }

  return (
    <>
      <Kb.ClickableBox onClick={onViewTeam} style={styles.clickableBox}>
        <Kb.Box2 className="teamRow" direction="horizontal" fullWidth={true} style={styles.row} alignItems="center">
          <Kb.Divider style={styles.divider} />
          <Kb.Box2 direction="vertical" centerChildren={true} style={styles.avatarContainer}>
            <Kb.Box2 direction="vertical" style={styles.avatarInner} centerChildren={true}>
              <Kb.Avatar size={32} teamname={teamMeta.teamname} isTeam={true} />
              {!!badgeCount && <Kb.Badge badgeNumber={badgeCount} badgeStyle={styles.badge} />}
              {crownIcon}
            </Kb.Box2>
          </Kb.Box2>
          <Kb.Box2 direction="horizontal" flex={1} alignItems="center" style={styles.bodyDesktop}>
            <Kb.Box2 direction="vertical" flex={1} justifyContent="center" style={styles.bodyLeft}>
              <Kb.Box2 direction="horizontal" gap="xtiny" alignSelf="flex-start" alignItems="center">
                <Kb.Text type="BodySemibold" lineClamp={1} ellipsizeMode="middle">
                  {teamMeta.teamname}
                </Kb.Text>
                {teamMeta.isOpen && (
                  <Kb.Meta title="open" backgroundColor={Kb.Styles.globalColors.green} style={styles.alignSelfCenter} />
                )}
              </Kb.Box2>
              <Kb.Box2 direction="horizontal" alignItems="center" gap="tiny" alignSelf="flex-start">
                {isNew && (
                  <Kb.Meta title="new" backgroundColor={Kb.Styles.globalColors.orange} style={styles.alignSelfCenter} />
                )}
                <Kb.Text type="BodySmall">
                  {teamMeta.memberCount.toLocaleString()} {pluralize('member', teamMeta.memberCount)}
                </Kb.Text>
              </Kb.Box2>
            </Kb.Box2>
            <Kb.Box2 direction="horizontal" alignItems="center" style={styles.bodyRight}>
              {activity}
            </Kb.Box2>
          </Kb.Box2>
          <Kb.Box2 direction="horizontal" className="fade" gap="xtiny" alignItems="center" style={styles.action}>
            {showChat && (
              <Kb.IconButton
                type="Dim"
                onClick={onChat}
                disabled={!teamMeta.isMember}
                mode="Secondary"
                small={true}
                icon="iconfont-chat"
                tooltip={!teamMeta.isMember ? 'You are not a member of this team.' : ''}
              />
            )}
            <Kb.IconButton
              type="Dim"
              onClick={showPopup}
              mode="Secondary"
              small={true}
              icon="iconfont-ellipsis"
              ref={popupAnchor}
            />
          </Kb.Box2>
        </Kb.Box2>
      </Kb.ClickableBox>
      {popup}
    </>
  )
}

const smallHeight = Kb.Styles.isMobile ? 56 : 48
const smallIconWidth = 64

const styles = Kb.Styles.styleSheetCreate(() => ({
  action: {
    flexShrink: 0,
    marginRight: 8,
    minHeight: smallHeight,
  },
  actionMobile: {
    flexShrink: 0,
    marginRight: 8,
  },
  alignSelfCenter: {
    alignSelf: 'center',
  },
  avatarContainer: Kb.Styles.platformStyles({
    common: {
      minHeight: smallHeight,
      width: smallIconWidth,
    },
    isPhone: {minHeight: 72},
  }),
  avatarInner: {
    height: 32,
    position: 'relative',
    width: 32,
  },
  badge: {
    position: 'absolute',
    right: -5,
    top: -5,
  },
  bodyDesktop: {
    flexGrow: 1,
    minHeight: smallHeight,
    paddingBottom: Kb.Styles.globalMargins.tiny,
    paddingTop: Kb.Styles.globalMargins.tiny,
  },
  bodyLeft: {
    paddingRight: Kb.Styles.globalMargins.tiny,
  },
  bodyMobile: {
    minHeight: 72,
    paddingBottom: Kb.Styles.globalMargins.tiny,
    paddingTop: Kb.Styles.globalMargins.tiny,
  },
  bodyRight: {
    flex: 0.7,
  },
  clickableBox: Kb.Styles.platformStyles({
    common: {
      backgroundColor: Kb.Styles.globalColors.white,
      flexShrink: 0,
      width: '100%',
    },
    isElectron: {minHeight: smallHeight},
    isPhone: {minHeight: 72},
  }),
  crownIcon: Kb.Styles.platformStyles({common: {fontSize: 10}, isMobile: {left: 0.5, position: 'relative'}}),
  crownIconBox: Kb.Styles.platformStyles({
    common: {
      backgroundColor: Kb.Styles.globalColors.white,
      borderRadius: 100,
      height: 17,
      position: 'absolute',
      width: 17,
    },
    isElectron: {bottom: -5, right: -5},
    isMobile: {bottom: -5, right: -5},
  }),
  divider: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  row: Kb.Styles.platformStyles({
    common: {
      backgroundColor: Kb.Styles.globalColors.white,
      position: 'relative',
    },
    isElectron: {minHeight: smallHeight},
    isPhone: {minHeight: 72},
  }),
}) as const)

export default TeamRow
