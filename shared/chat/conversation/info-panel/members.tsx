import * as C from '@/constants'
import {getBotsAndParticipants} from '@/constants/chat/helpers'
import * as Teams from '@/constants/teams'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import Participant from './participant'
import {useUsersState} from '@/stores/users'
import {navToProfile} from '@/constants/router'
import {useChatTeamMembers} from '../team-hooks'
import {useConversationMetadata} from '../data-hooks'
import {useRefreshParticipantsOnTeamMembershipChange} from '@/chat/inbox/refresh-participants'

type Props = {
  commonSections: ReadonlyArray<Section>
  conversationIDKey: T.Chat.ConversationIDKey
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

type MemberItem = Extract<Item, {type: 'member'}>

// The list the info panel renders, and everything that keeps it current. Extracted so the
// refresh wiring can be exercised without standing up the whole section list.
export const useChannelMembers = (conversationIDKey: T.Chat.ConversationIDKey) => {
  const infoMap = useUsersState(s => s.infoMap)
  const {meta, participants: participantInfo} = useConversationMetadata(conversationIDKey)
  const {channelname, teamID, teamname} = meta

  const {loading: loadingTeamMembers, members: teamMembers} = useChatTeamMembers(teamID)
  const isGeneral = channelname === 'general'
  const showAuditingBanner = isGeneral && loadingTeamMembers
  const refreshParticipants = C.useRPC(T.RPCChat.localRefreshParticipantsRpcPromise)
  const participants = getBotsAndParticipants(meta, participantInfo, teamMembers).participants
  const lastTeamNameRef = React.useRef('')
  React.useEffect(() => {
    if (lastTeamNameRef.current === teamname) {
      return
    }
    lastTeamNameRef.current = teamname
    if (teamname) {
      refreshParticipants(
        [{convID: T.Chat.keyToConversationID(conversationIDKey)}],
        () => {},
        () => {}
      )
    }
  }, [conversationIDKey, refreshParticipants, teamname])

  // a kick, an add-to-team or a reset user let back in changes this channel's members
  // too, including when another client does it
  useRefreshParticipantsOnTeamMembershipChange(teamID, conversationIDKey)

  const showSpinner = !participants.length
  const participantsItems: ReadonlyArray<MemberItem> = participants
    .map(
      p =>
        ({
          fullname:
            (infoMap.get(p) || {fullname: ''}).fullname ||
            teamMembers.get(p)?.fullName ||
            participantInfo.contactName.get(p) ||
            '',
          isAdmin: teamname ? Teams.userIsRoleInTeamWithInfo(teamMembers, p, 'admin') : false,
          isOwner: teamname ? Teams.userIsRoleInTeamWithInfo(teamMembers, p, 'owner') : false,
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

  return {participantsItems, showAuditingBanner, showSpinner}
}

const MembersTab = (props: Props) => {
  const styles = useStyles()
  const {conversationIDKey} = props
  const {participantsItems, showAuditingBanner, showSpinner} = useChannelMembers(conversationIDKey)

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
            onShowProfile={navToProfile}
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
      sections={sections}
    />
  )
}
export default MembersTab

const useStyles = Kb.Styles.createStyleHook(
  () =>
    ({
      membersSpinner: {marginTop: Kb.Styles.globalMargins.small},
    }) as const
)
