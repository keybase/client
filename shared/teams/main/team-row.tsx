import * as Chat from '@/stores/chat2'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import type * as T from '@/constants/types'
import TeamMenu from '../team/menu-container'
import {pluralize} from '@/util/string'
import {Activity} from '../common'
import {useSafeNavigation} from '@/util/safe-navigation'
import * as Teams from '@/stores/teams'
import {useTeamsState} from '@/stores/teams'

type Props = {
  firstItem: boolean
  showChat?: boolean // default true
  teamID: T.Teams.TeamID
}

const TeamRow = React.memo(function TeamRow(props: Props) {
  const {firstItem, showChat = true, teamID} = props
  const nav = useSafeNavigation()
  const teamMeta = useTeamsState(s => Teams.getTeamMeta(s, teamID))
  // useActivityLevels in ../container ensures these are loaded
  const activityLevel = useTeamsState(s => s.activityLevels.teams.get(teamID) || 'none')

  const onViewTeam = () => nav.safeNavigateAppend({props: {teamID}, selected: 'team'})

  const activity = <Activity level={activityLevel} />

  const previewConversation = Chat.useChatState(s => s.dispatch.previewConversation)
  const onChat = () => previewConversation({reason: 'teamRow', teamname: teamMeta.teamname})

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p
      return <TeamMenu teamID={teamID} attachTo={attachTo} onHidden={hidePopup} visible={true} />
    },
    [teamID]
  )
  const {popup, popupAnchor, showPopup} = Kb.usePopup2(makePopup)

  const teamIDToResetUsers = useTeamsState(s => s.teamIDToResetUsers)
  const badgeCount = useTeamsState(s =>
    Teams.getTeamRowBadgeCount(s.newTeamRequests, teamIDToResetUsers, teamID)
  )
  const isNew = useTeamsState(s => s.newTeams.has(teamID))

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
        style={Kb.Styles.collapseStyles([
          styles.crownIcon,
          teamMeta.role === 'admin' && styles.darkerAdminIcon,
        ])}
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
        height={Kb.Styles.isPhone ? 72 : undefined}
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
                  <Kb.Text2 type="BodySemibold" lineClamp={1} ellipsizeMode="middle">
                    {teamMeta.teamname}
                  </Kb.Text2>
                  {teamMeta.isOpen && (
                    <Kb.Meta
                      title="open"
                      backgroundColor={Kb.Styles.globalColors.green}
                      style={styles.alignSelfCenter}
                    />
                  )}
                </Kb.Box2>
                <Kb.Box2 direction="horizontal" alignItems="center" gap="tiny" alignSelf="flex-start">
                  {isNew && (
                    <Kb.Meta
                      title="new"
                      backgroundColor={Kb.Styles.globalColors.orange}
                      style={styles.alignSelfCenter}
                    />
                  )}
                  <Kb.Text fixOverdraw={true} type="BodySmall">
                    {teamMeta.memberCount.toLocaleString()} {pluralize('member', teamMeta.memberCount)}
                  </Kb.Text>
                </Kb.Box2>
                {Kb.Styles.isPhone && activity}
              </Kb.Box2>
            </Kb.Box2>
            {!Kb.Styles.isPhone && (
              <Kb.Box2 direction="horizontal" fullHeight={true} alignItems="center" style={styles.bodyRight}>
                {activity}
              </Kb.Box2>
            )}
          </Kb.Box2>
        }
        action={
          <Kb.Box2 direction="horizontal" gap={Kb.Styles.isPhone ? 'tiny' : 'xtiny'}>
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
              onClick={showPopup}
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
})

const styles = Kb.Styles.styleSheetCreate(() => ({
  alignSelfCenter: {
    alignSelf: 'center',
  },
  avatarContainer: Kb.Styles.platformStyles({
    common: {
      marginTop: Kb.Styles.globalMargins.xxtiny,
      position: 'relative',
    },
    isPhone: {marginTop: Kb.Styles.globalMargins.small},
  }),
  badge: {
    position: 'absolute',
    right: -5,
    top: -5,
  },
  bodyContainer: {
    paddingBottom: Kb.Styles.globalMargins.tiny,
    paddingTop: Kb.Styles.globalMargins.tiny,
  },
  bodyLeft: {
    flex: 1,
    paddingRight: Kb.Styles.globalMargins.tiny,
  },
  bodyLeftText: {justifyContent: 'center'},
  bodyRight: {
    flex: 0.7,
  },
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
    isMobile: {bottom: 4, right: -5},
  }),
  darkerAdminIcon: {color: Kb.Styles.globalColors.greyDark},
  openMeta: {
    alignSelf: 'center',
  },
  white: {backgroundColor: Kb.Styles.globalColors.white},
}))

export default TeamRow
