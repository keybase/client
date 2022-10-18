import * as Container from '../../../util/container'
import * as TeamConstants from '../../../constants/teams'
import * as Constants from '../../../constants/chat2'
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Types from '../../../constants/types/chat2'
import * as ProfileGen from '../../../actions/profile-gen'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import Participant from './participant'
import * as Styles from '../../../styles'

type Props = {
  conversationIDKey: Types.ConversationIDKey
  renderTabs: () => React.ReactNode
  commonSections: Array<unknown>
}

const auditingBannerItem = 'auditing banner'
const spinnerItem = 'spinner item'

const MembersTab = (props: Props) => {
  const {conversationIDKey} = props
  const dispatch = Container.useDispatch()
  const meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const {teamID, channelname, teamname} = meta
  const teamMembers = Container.useSelector(state => state.teams.teamIDToMembers.get(teamID)) ?? new Map()
  const infoMap = Container.useSelector(state => state.users.infoMap)
  const isGeneral = channelname === 'general'
  const showAuditingBanner = isGeneral && !teamMembers
  const refreshParticipants = Container.useRPC(RPCChatTypes.localRefreshParticipantsRpcPromise)
  const participantInfo = Container.useSelector(state =>
    Constants.getParticipantInfo(state, conversationIDKey)
  )
  const participants = Container.useSelector(
    state => Constants.getBotsAndParticipants(state, conversationIDKey).participants
  )
  React.useEffect(() => {
    if (teamname) {
      refreshParticipants(
        [{convID: Types.keyToConversationID(conversationIDKey)}],
        () => {},
        () => {}
      )
    }
  }, [conversationIDKey, refreshParticipants, teamname])

  const showSpinner = !participants.length
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
          renderItem: ({index, item}: {index: number; item: Unpacked<typeof sections>}) => {
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
    } as const)
)
