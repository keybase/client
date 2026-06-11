import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import * as React from 'react'
import logger from '@/logger'
import {formatTimeForTeamMember} from '@/util/timestamp'
import {useCurrentUserState} from '@/stores/current-user'
import {useSafeNavigation} from '@/util/safe-navigation'
import {navToProfile} from '@/constants/router'
import {useLoadedTeam} from '../use-loaded-team'

type Props = {
  teamID: T.Teams.TeamID
  username: string
}

const useNavUpIfRemovedFromTeam = (teamID: T.Teams.TeamID, username: string) => {
  const nav = useSafeNavigation()
  const waitingKey = C.waitingKeyTeamsRemoveMember(teamID, username)
  const waiting = C.Waiting.useAnyWaiting(waitingKey)
  const wasWaitingRef = React.useRef(waiting)
  const [leaving, setLeaving] = React.useState(false)

  React.useEffect(() => {
    if (wasWaitingRef.current && !waiting) {
      setLeaving(true)
      nav.safeNavigateUp()
    } else {
      setLeaving(false)
    }
    wasWaitingRef.current = waiting
  }, [waiting, nav])

  return leaving
}

export const TeamMemberHeader = (props: Props) => {
  const {teamID, username} = props
  const nav = useSafeNavigation()
  const leaving = useNavUpIfRemovedFromTeam(teamID, username)

  const {teamDetails, teamMeta} = useLoadedTeam(teamID)
  const yourUsername = useCurrentUserState(s => s.username)
  const previewConversation = C.Router2.previewConversation
  const onChat = () => previewConversation({participants: [username], reason: 'memberView'})
  const onViewProfile = () => navToProfile(username)
  const onViewTeam = () => nav.safeNavigateAppend({name: 'team', params: {teamID}})

  const member = teamDetails.members.get(username)
  if (!member) {
    if (!leaving) {
      // loading? should never happen.
      logger.error('[team member view] no data! this should never happen.')
    }
    return null
  }

  const buttons = (
    <Kb.Box2 direction="horizontal" gap="tiny" alignSelf={Kb.Styles.isPhone ? 'flex-start' : 'flex-end'}>
      <Kb.Button small={true} label="Chat" onClick={onChat} />
      <Kb.Button small={true} label="View profile" onClick={onViewProfile} mode="Secondary" />
      {username !== yourUsername && <BlockDropdown username={username} />}
    </Kb.Box2>
  )

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.headerContainer}>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.headerContent}>
        <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true}>
          <Kb.Box2
            direction="horizontal"
            alignItems="center"
            gap={Kb.Styles.isPhone ? 'tiny' : 'xtiny'}
            alignSelf="flex-start"
          >
            <Kb.Avatar size={16} teamname={teamMeta.teamname} />
            <Kb.Text
              type={Kb.Styles.isPhone ? 'BodySmallSemibold' : 'BodySmallSemiboldSecondaryLink'}
              onClick={onViewTeam}
            >
              {teamMeta.teamname}
            </Kb.Text>
          </Kb.Box2>

          <Kb.Box2
            direction="horizontal"
            gap="large"
            fullWidth={true}
            alignItems="flex-end"
            style={styles.headerTextContainer}
          >
            <Kb.Box2 direction="horizontal" gap="small">
              <Kb.Avatar size={64} username={username} onClick={onViewProfile} />
              <Kb.Box2 direction="vertical" alignItems="flex-start" style={styles.headerText}>
                <Kb.ConnectedUsernames type="Header" usernames={username} onUsernameClicked={onViewProfile} />
                {!!member.fullName && (
                  <Kb.Text type="BodySemibold" lineClamp={1}>
                    {member.fullName}
                  </Kb.Text>
                )}
                <Kb.Text type="BodySmall">
                  Joined {member.joinTime ? formatTimeForTeamMember(member.joinTime) : 'this team'}
                </Kb.Text>
              </Kb.Box2>
            </Kb.Box2>
            {!Kb.Styles.isPhone && buttons}
          </Kb.Box2>
          {Kb.Styles.isPhone && buttons}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const BlockDropdown = (props: {username: string}) => {
  const {username} = props
  const nav = useSafeNavigation()
  const makePopup = (p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p
    const onBlock = () => nav.safeNavigateAppend({name: 'chatBlockingModal', params: {username}})
    return (
      <Kb.FloatingMenu
        attachTo={attachTo}
        visible={true}
        onHidden={hidePopup}
        closeOnSelect={true}
        items={[{danger: true, icon: 'iconfont-remove', onClick: onBlock, title: 'Block'}]}
      />
    )
  }
  const {popup, popupAnchor, showPopup} = Kb.usePopup2(makePopup)
  return (
    <>
      <Kb.IconButton
        small={true}
        icon="iconfont-ellipsis"
        onClick={showPopup}
        mode="Secondary"
        ref={popupAnchor}
      />
      {popup}
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  headerContainer: Kb.Styles.platformStyles({
    common: {
      backgroundColor: Kb.Styles.globalColors.white,
      paddingBottom: Kb.Styles.globalMargins.small,
    },
    isElectron: {...Kb.Styles.desktopStyles.windowDraggingClickable},
    isPhone: {paddingTop: Kb.Styles.globalMargins.small},
    isTablet: {paddingTop: Kb.Styles.globalMargins.small},
  }),
  headerContent: {...Kb.Styles.padding(0, Kb.Styles.globalMargins.small)},
  headerText: Kb.Styles.platformStyles({
    common: {width: 127},
    isPhone: {flex: 1},
  }),
  headerTextContainer: Kb.Styles.platformStyles({
    isPhone: {paddingBottom: Kb.Styles.globalMargins.tiny},
  }),
}))
