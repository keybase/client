import * as Container from '../../../util/container'
import * as TeamConstants from '../../../constants/teams'
import * as Constants from '../../../constants/chat2'
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Types from '../../../constants/types/chat2'
import * as ProfileGen from '../../../actions/profile-gen'
import * as Styles from '../../../styles'
import flags from '../../../util/feature-flags'
import Participant from './participant'

type Props = {
  conversationIDKey: Types.ConversationIDKey
  renderTabs: () => React.ReactNode
  commonSections: Array<unknown>
}

const auditingBannerItem = 'auditing banner'

export default (props: Props) => {
  const {conversationIDKey} = props
  const dispatch = Container.useDispatch()
  const meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const {teamID, channelname, teamname} = meta
  const teamMembers = Container.useSelector(state => state.teams.teamIDToMembers.get(teamID)) ?? new Map()
  const infoMap = Container.useSelector(state => state.users.infoMap)
  const isGeneral = channelname === 'general'
  const showAuditingBanner = isGeneral && !teamMembers
  const participantInfo = Container.useSelector(state =>
    Constants.getParticipantInfo(state, conversationIDKey)
  )
  let participants = participantInfo.all
  const adhocTeam = meta.teamType === 'adhoc'

  let botUsernames: Array<string> = []
  if (adhocTeam) {
    botUsernames = participants.filter(p => !participantInfo.name.includes(p))
  } else {
    botUsernames = [...teamMembers.values()]
      .filter(
        p =>
          TeamConstants.userIsRoleInTeamWithInfo(teamMembers, p.username, 'restrictedbot') ||
          TeamConstants.userIsRoleInTeamWithInfo(teamMembers, p.username, 'bot')
      )
      .map(p => p.username)
      .sort((l, r) => l.localeCompare(r))
  }

  if (teamMembers && isGeneral) {
    participants = [...teamMembers.values()].reduce<Array<string>>((l, mi) => {
      l.push(mi.username)
      return l
    }, [])

    if (flags.botUI) {
      participants = participants.filter(p => !botUsernames.includes(p))
    }
  } else {
    participants = flags.botUI ? participants.filter(p => !botUsernames.includes(p)) : participants
  }

  const participantsItems = participants
    .map(p => ({
      fullname: (infoMap.get(p) || {fullname: ''}).fullname || participantInfo.contactName.get(p) || '',
      isAdmin: teamname ? TeamConstants.userIsRoleInTeamWithInfo(teamMembers, p, 'admin') : false,
      isOwner: teamname ? TeamConstants.userIsRoleInTeamWithInfo(teamMembers, p, 'owner') : false,
      key: `user-${p}`,
      username: p,
    }))
    .sort((l, r) => {
      const leftIsAdmin = l.isAdmin || l.isOwner
      const rightIsAdmin = r.isAdmin || r.isOwner
      if (leftIsAdmin && !rightIsAdmin) {
        return -1
      } else if (!leftIsAdmin && rightIsAdmin) {
        return 1
      }
      return l.username.localeCompare(r.username)
    })

  const onShowProfile = (username: string) => dispatch(ProfileGen.createShowUserProfile({username}))

  const data = [...(showAuditingBanner ? [{key: auditingBannerItem}] : []), ...participantsItems]

  return (
    <Kb.SectionList
      stickySectionHeadersEnabled={true}
      keyboardShouldPersistTaps="handled"
      renderSectionHeader={({section}: any) => section?.renderSectionHeader?.({section}) ?? null}
      style={styles.sectionList}
      sections={[
        ...props.commonSections,
        {
          data,
          renderItem: ({index, item}: {index: number; item: Unpacked<typeof data>}) => {
            if (item.key === auditingBannerItem) {
              return (
                <Kb.Banner color="grey" small={true}>
                  Auditing team members...
                </Kb.Banner>
              )
            }
            if (!('username' in item) || !item.username) {
              return null
            }
            return (
              <Participant
                fullname={item.fullname}
                isAdmin={item.isAdmin}
                isOwner={item.isOwner}
                username={item.username}
                onShowProfile={onShowProfile}
                firstItem={index === 0}
              />
            )
          },
          renderSectionHeader: props.renderTabs,
        },
      ]}
    />
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      sectionList: Styles.platformStyles({
        isTablet: {
          alignSelf: 'center',
          maxWidth: 800,
          minWidth: 400,
        },
      }),
    } as const)
)
