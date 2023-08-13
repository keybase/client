import * as C from '../../constants'
import * as Kb from '../../common-adapters'
import * as React from 'react'
import * as Styles from '../../styles'
import * as Constants from '../../constants/teams'
import * as Container from '../../util/container'
import type * as Types from '../../constants/types/teams'
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
  const nav = Container.useSafeNavigation()
  const teamMeta = C.useTeamsState(s => Constants.getTeamMeta(s, teamID))
  // useActivityLevels in ../container ensures these are loaded
  const activityLevel = C.useTeamsState(s => s.activityLevels.teams.get(teamID) || 'none')

  const onViewTeam = () => nav.safeNavigateAppend({props: {teamID}, selected: 'team'})

  const activity = <Activity level={activityLevel} />

  const previewConversation = C.useChatState(s => s.dispatch.previewConversation)
  const onChat = () => previewConversation({reason: 'teamRow', teamname: teamMeta.teamname})

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, toggleShowingPopup} = p
      return <TeamMenu teamID={teamID} attachTo={attachTo} onHidden={toggleShowingPopup} visible={true} />
    },
    [teamID]
  )
  const {popup, popupAnchor, toggleShowingPopup} = Kb.usePopup2(makePopup)

  const teamIDToResetUsers = C.useTeamsState(s => s.teamIDToResetUsers)
  const badgeCount = C.useTeamsState(s =>
    Constants.getTeamRowBadgeCount(s.newTeamRequests, teamIDToResetUsers, teamID)
  )
  const isNew = C.useTeamsState(s => s.newTeams.has(teamID))

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
        style={Styles.collapseStyles([styles.crownIcon, teamMeta.role === 'admin' && styles.darkerAdminIcon])}
      />
    </Kb.Box2>
  ) : null

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
            style={styles.avatarContainer}
          >
            <Kb.Avatar size={32} teamname={teamMeta.teamname} isTeam={true} />
            {!!badgeCount && <Kb.Badge badgeNumber={badgeCount} badgeStyle={styles.badge} />}
            {crownIcon}
          </Kb.Box2>
        }
        style={styles.white}
        innerStyle={styles.white}
        height={Styles.isPhone ? 72 : undefined}
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
                  <Kb.Text fixOverdraw={true} type="BodySemibold" lineClamp={1} ellipsizeMode="middle">
                    {teamMeta.teamname}
                  </Kb.Text>
                  {teamMeta.isOpen && (
                    <Kb.Meta
                      title="open"
                      backgroundColor={Styles.globalColors.green}
                      style={styles.alignSelfCenter}
                    />
                  )}
                </Kb.Box2>
                <Kb.Box2 direction="horizontal" alignItems="center" gap="tiny" alignSelf="flex-start">
                  {isNew && (
                    <Kb.Meta
                      title="new"
                      backgroundColor={Styles.globalColors.orange}
                      style={styles.alignSelfCenter}
                    />
                  )}
                  <Kb.Text fixOverdraw={true} type="BodySmall">
                    {teamMeta.memberCount.toLocaleString()} {pluralize('member', teamMeta.memberCount)}
                  </Kb.Text>
                </Kb.Box2>
                {Styles.isPhone && activity}
              </Kb.Box2>
            </Kb.Box2>
            {!Styles.isPhone && (
              <Kb.Box2 direction="horizontal" fullHeight={true} alignItems="center" style={styles.bodyRight}>
                {activity}
              </Kb.Box2>
            )}
          </Kb.Box2>
        }
        action={
          <Kb.Box2 direction="horizontal" gap={Styles.isPhone ? 'tiny' : 'xtiny'}>
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
              onClick={toggleShowingPopup}
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
  alignSelfCenter: {
    alignSelf: 'center',
  },
  avatarContainer: Styles.platformStyles({
    common: {
      marginTop: Styles.globalMargins.xxtiny,
      position: 'relative',
    },
    isPhone: {marginTop: Styles.globalMargins.small},
  }),
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
  crownIcon: Styles.platformStyles({common: {fontSize: 10}, isMobile: {left: 0.5, position: 'relative'}}),
  crownIconBox: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white,
      borderRadius: 100,
      height: 17,
      position: 'absolute',
      width: 17,
    },
    isElectron: {bottom: -5, right: -5},
    isMobile: {bottom: 4, right: -5},
  }),
  darkerAdminIcon: {color: Styles.globalColors.greyDark},
  openMeta: {
    alignSelf: 'center',
  },
  white: {backgroundColor: Styles.globalColors.white},
}))

export default TeamRow
