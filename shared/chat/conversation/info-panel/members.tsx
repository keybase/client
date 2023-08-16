import * as C from '../../../constants'
import * as Container from '../../../util/container'
import * as TeamConstants from '../../../constants/teams'
import * as Constants from '../../../constants/chat2'
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Types from '../../../constants/types/chat2'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import Participant from './participant'
import * as Styles from '../../../styles'
import shallowEqual from 'shallowequal'

type Props = {
  renderTabs: () => React.ReactNode
  commonSections: Array<unknown>
}

const auditingBannerItem = 'auditing banner'
const spinnerItem = 'spinner item'

const MembersTab = (props: Props) => {
  const conversationIDKey = C.useChatContext(s => s.id)
  const infoMap = C.useUsersState(s => s.infoMap)
  const {channelname, teamID, teamname} = C.useChatContext(s => {
    const {meta} = s
    const {teamID, channelname, teamname} = meta
    return {channelname, teamID, teamname}
  }, shallowEqual)

  const teamMembers = C.useTeamsState(s => s.teamIDToMembers.get(teamID))
  const isGeneral = channelname === 'general'
  const showAuditingBanner = isGeneral && !teamMembers
  const refreshParticipants = Container.useRPC(RPCChatTypes.localRefreshParticipantsRpcPromise)
  const participantInfo = C.useChatContext(s => s.participants)
  const participants = C.useChatContext(
    s => Constants.getBotsAndParticipants(s.meta, s.participants).participants
  )
  const cidChanged = C.useCIDChanged(conversationIDKey)
  const [lastTeamName, setLastTeamName] = React.useState('')
  if (lastTeamName !== teamname || cidChanged) {
    setLastTeamName(teamname)
    if (teamname) {
      refreshParticipants(
        [{convID: Types.keyToConversationID(conversationIDKey)}],
        () => {},
        () => {}
      )
    }
  }

  const showSpinner = !participants.length
  const participantsItems = participants
    .map(p => ({
      fullname: (infoMap.get(p) || {fullname: ''}).fullname || participantInfo.contactName.get(p) || '',
      isAdmin:
        teamname && teamMembers ? TeamConstants.userIsRoleInTeamWithInfo(teamMembers, p, 'admin') : false,
      isOwner:
        teamname && teamMembers ? TeamConstants.userIsRoleInTeamWithInfo(teamMembers, p, 'owner') : false,
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

  const showUserProfile = C.useProfileState(s => s.dispatch.showUserProfile)
  const onShowProfile = showUserProfile

  const sections = showSpinner
    ? [{key: spinnerItem}]
    : [...(showAuditingBanner ? [{key: auditingBannerItem}] : []), ...participantsItems]
  return (
    <Kb.SectionList
      stickySectionHeadersEnabled={true}
      keyboardShouldPersistTaps="handled"
      desktopReactListTypeOverride="variable"
      desktopItemSizeEstimatorOverride={() => 56}
      getItemHeight={(item: any) => (item?.username ? 56 : 0)}
      renderSectionHeader={({section}: any) => section?.renderSectionHeader?.({section}) ?? null}
      sections={[
        ...props.commonSections,
        {
          data: sections,
          renderItem: ({index, item}: {index: number; item: Container.Unpacked<typeof sections>}) => {
            if (item.key === auditingBannerItem) {
              return (
                <Kb.Banner color="grey" small={true}>
                  Auditing team members...
                </Kb.Banner>
              )
            } else if (item.key === spinnerItem) {
              return <Kb.ProgressIndicator type="Large" style={styles.membersSpinner} />
            } else {
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
            }
          },
          renderSectionHeader: props.renderTabs,
        },
      ]}
    />
  )
}
export default MembersTab

const styles = Styles.styleSheetCreate(
  () =>
    ({
      membersSpinner: {marginTop: Styles.globalMargins.small},
    }) as const
)
