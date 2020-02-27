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

  const onViewTeam = () =>
    dispatch(nav.safeNavigateAppendPayload({path: [{props: {teamID}, selected: 'team'}]}))

  const activity = <Activity level={'recently' /* TODO plumbing for this */} />

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
