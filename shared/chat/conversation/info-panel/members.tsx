import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import {useProfileState} from '@/stores/profile'
import * as Teams from '@/stores/teams'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import Participant from './participant'
import {useUsersState} from '@/stores/users'

type Props = {
  commonSections: ReadonlyArray<Section>
}

type Item =
  | {type: 'header-item'}
  | {type: 'tabs'}
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

type Section = Kb.SectionType<Item>

const MembersTab = (props: Props) => {
  const conversationIDKey = Chat.useChatContext(s => s.id)
  const infoMap = useUsersState(s => s.infoMap)
  const {channelname, teamID, teamname} = Chat.useChatContext(
    C.useShallow(s => {
      const {meta} = s
      const {teamID, channelname, teamname} = meta
      return {channelname, teamID, teamname}
    })
  )

  const teamMembers = Teams.useTeamsState(s => s.teamIDToMembers.get(teamID))
  const isGeneral = channelname === 'general'
  const showAuditingBanner = isGeneral && !teamMembers
  const refreshParticipants = C.useRPC(T.RPCChat.localRefreshParticipantsRpcPromise)
  const participantInfo = Chat.useChatContext(s => s.participants)
  const participants = Chat.useChatContext(
    C.useShallow(s => Chat.getBotsAndParticipants(s.meta, s.participants).participants)
  )
  const [lastTeamName, setLastTeamName] = React.useState('')
  React.useEffect(() => {
    if (lastTeamName !== teamname) {
      setLastTeamName(teamname)
      if (teamname) {
        refreshParticipants(
          [{convID: T.Chat.keyToConversationID(conversationIDKey)}],
          () => {},
          () => {}
        )
      }
    }
  }, [conversationIDKey, lastTeamName, refreshParticipants, teamname])

  const showSpinner = !participants.length
  const participantsItems = participants
    .map(
      p =>
        ({
          fullname: (infoMap.get(p) || {fullname: ''}).fullname || participantInfo.contactName.get(p) || '',
          isAdmin:
            teamname && teamMembers ? Teams.userIsRoleInTeamWithInfo(teamMembers, p, 'admin') : false,
          isOwner:
            teamname && teamMembers ? Teams.userIsRoleInTeamWithInfo(teamMembers, p, 'owner') : false,
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

  const showUserProfile = useProfileState(s => s.dispatch.showUserProfile)
  const onShowProfile = showUserProfile

  const participantSection: Section = {
    data: showSpinner
      ? [{type: 'spinnerItem'} as const]
      : [...(showAuditingBanner ? [{type: 'auditingItem'} as const] : []), ...participantsItems],
    renderItem: ({index, item}: {index: number; item: Item}) => {
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
  }

  const sections = [...props.commonSections, participantSection]
  return (
    <Kb.SectionList
      stickySectionHeadersEnabled={true}
      keyboardShouldPersistTaps="handled"
      getItemHeight={item => {
        return item?.type === 'member' && item.username ? 56 : 0
      }}
      renderSectionHeader={({section}) => section.renderSectionHeader?.({section}) ?? null}
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
