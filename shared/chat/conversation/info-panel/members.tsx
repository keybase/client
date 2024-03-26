import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import type {Section} from '@/common-adapters/section-list'
import Participant from './participant'

type Props = {
  renderTabs: () => React.ReactElement | null
  commonSections: Array<Section<unknown, {type: 'header-section'}>>
}

type ParticipantSectionData =
  | {type: 'auditingItem'}
  | {type: 'spinnerItem'}
  | {key: string; type: 'common'}
  | {
      fullname: string
      isAdmin: boolean
      isOwner: boolean
      key: string
      username: string
      type: 'member'
    }
type ParticipantSectionType = Section<ParticipantSectionData, {type: 'participant'}>

const MembersTab = (props: Props) => {
  const conversationIDKey = C.useChatContext(s => s.id)
  const infoMap = C.useUsersState(s => s.infoMap)
  const {channelname, teamID, teamname} = C.useChatContext(
    C.useShallow(s => {
      const {meta} = s
      const {teamID, channelname, teamname} = meta
      return {channelname, teamID, teamname}
    })
  )

  const teamMembers = C.useTeamsState(s => s.teamIDToMembers.get(teamID))
  const isGeneral = channelname === 'general'
  const showAuditingBanner = isGeneral && !teamMembers
  const refreshParticipants = C.useRPC(T.RPCChat.localRefreshParticipantsRpcPromise)
  const participantInfo = C.useChatContext(s => s.participants)
  const participants = C.useChatContext(
    s => C.Chat.getBotsAndParticipants(s.meta, s.participants).participants
  )
  const cidChanged = C.Chat.useCIDChanged(conversationIDKey)
  const [lastTeamName, setLastTeamName] = React.useState('')
  if (lastTeamName !== teamname || cidChanged) {
    setLastTeamName(teamname)
    if (teamname) {
      refreshParticipants(
        [{convID: T.Chat.keyToConversationID(conversationIDKey)}],
        () => {},
        () => {}
      )
    }
  }

  const showSpinner = !participants.length
  const participantsItems = participants
    .map(
      p =>
        ({
          fullname: (infoMap.get(p) || {fullname: ''}).fullname || participantInfo.contactName.get(p) || '',
          isAdmin:
            teamname && teamMembers ? C.Teams.userIsRoleInTeamWithInfo(teamMembers, p, 'admin') : false,
          isOwner:
            teamname && teamMembers ? C.Teams.userIsRoleInTeamWithInfo(teamMembers, p, 'owner') : false,
          key: `user-${p}`,
          type: 'member',
          username: p,
        }) as const
    )
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

  const showUserProfile = C.useProfileState(s => s.dispatch.showUserProfile)
  const onShowProfile = showUserProfile

  const participantSection: ParticipantSectionType = {
    data: showSpinner
      ? [{type: 'spinnerItem'} as const]
      : [...(showAuditingBanner ? [{type: 'auditingItem'} as const] : []), ...participantsItems],
    renderItem: ({index, item}: {index: number; item: ParticipantSectionData}) => {
      if (item.type === 'auditingItem') {
        return (
          <Kb.Banner color="grey" small={true}>
            Auditing team members...
          </Kb.Banner>
        )
      } else if (item.type === 'spinnerItem') {
        return <Kb.ProgressIndicator type="Large" style={styles.membersSpinner} />
      } else if (item.type === 'member') {
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
      }
      return null
    },
    type: 'participant',
  }

  const sections = [...props.commonSections, participantSection]

  return (
    <Kb.SectionList
      stickySectionHeadersEnabled={true}
      keyboardShouldPersistTaps="handled"
      desktopReactListTypeOverride="variable"
      desktopItemSizeEstimatorOverride={() => 56}
      getItemHeight={(item, secIdx) => {
        if (sections[secIdx]?.type === 'participant') {
          const i = item as ParticipantSectionData
          return i.type === 'member' && i.username ? 56 : 0
        }
        return 0
      }}
      renderSectionHeader={({section}) => (section.type === 'participant' ? props.renderTabs() : null)}
      sections={sections}
    />
  )
}
export default MembersTab

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      membersSpinner: {marginTop: Kb.Styles.globalMargins.small},
    }) as const
)
