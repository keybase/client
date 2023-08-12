import * as C from '../../../constants'
import * as Constants from '../../../constants/teams'
import * as ChatConstants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import type * as ChatTypes from '../../../constants/types/chat2'
import type * as Types from '../../../constants/types/teams'

type Props = {
  type: 'channelsEmpty' | 'channelsFew' | 'members' | 'subteams'
  teamID: Types.TeamID
  conversationIDKey?: ChatTypes.ConversationIDKey
  notChannelMember?: boolean
}
const icon: {[K in Props['type']]: Kb.IconType} = {
  channelsEmpty: 'icon-empty-team-small-96',
  channelsFew: 'icon-empty-channels-103-96',
  members: 'icon-empty-people-search-112-96',
  subteams: 'icon-empty-subteams-164-96',
}

const buttonLabel = {
  channelsEmpty: 'Create channels',
  channelsFew: 'Create a channel',
  members: 'Add/Invite people',
  subteams: 'Create a subteam',
}

const useSecondaryAction = (props: Props) => {
  const {teamID, conversationIDKey} = props
  const nav = Container.useSafeNavigation()
  const startAddMembersWizard = C.useTeamsState(s => s.dispatch.startAddMembersWizard)
  const launchNewTeamWizardOrModal = C.useTeamsState(s => s.dispatch.launchNewTeamWizardOrModal)
  const onSecondaryAction = () => {
    switch (props.type) {
      case 'members':
        if (conversationIDKey) {
          nav.safeNavigateAppend({
            props: {conversationIDKey: conversationIDKey, teamID},
            selected: 'chatAddToChannel',
          })
        } else {
          startAddMembersWizard(teamID)
        }
        break
      case 'subteams':
        launchNewTeamWizardOrModal(teamID)
        break
      case 'channelsFew':
        nav.safeNavigateAppend({props: {teamID}, selected: 'chatCreateChannel'})
        break
      case 'channelsEmpty':
        nav.safeNavigateAppend({props: {teamID}, selected: 'teamCreateChannels'})
        break
    }
  }
  return onSecondaryAction
}

const getFirstText = (
  type: Props['type'],
  teamOrChannel: string,
  teamOrChannelName: string,
  notIn?: boolean
) => {
  switch (type) {
    case 'members':
      return notIn
        ? `${teamOrChannelName} doesn't have any members`
        : `You are the only member in this ${teamOrChannel}.`
    case 'channelsEmpty':
      return `${teamOrChannelName} is a small team.
Make it a big team by creating chat channels.`
    case 'channelsFew':
      return 'Channels can be joined by anyone, unlike subteams.'
    case 'subteams':
      return 'Subteams are cryptographically distinct, and can welcome people who aren’t elsewhere in your team hierarchy.'
  }
}

const EmptyRow = (props: Props) => {
  const {conversationIDKey, teamID} = props
  const teamMeta = C.useTeamsState(s => Constants.getTeamMeta(s, teamID))
  const notIn = teamMeta.role === 'none' || props.notChannelMember
  const you = C.useCurrentUserState(s => s.username)
  const onSecondaryAction = useSecondaryAction(props)
  const addToTeam = C.useTeamsState(s => s.dispatch.addToTeam)
  const joinConversation = ChatConstants.useConvoState(
    conversationIDKey ?? ChatConstants.noConversationIDKey,
    s => s.dispatch.joinConversation
  )
  const onAddSelf = () => {
    if (conversationIDKey) {
      joinConversation()
    } else {
      addToTeam(teamID, [{assertion: you, role: 'admin'}], false)
    }
  }
  const waiting = Container.useAnyWaiting(Constants.addMemberWaitingKey(teamID, you))

  const teamOrChannel = props.conversationIDKey ? 'channel' : 'team'
  const teamOrChannelName = props.conversationIDKey ? 'This channel' : teamMeta.teamname
  return (
    <Kb.Box2 direction="vertical" gap="small" alignItems="center" style={styles.container} fullWidth={true}>
      <Kb.Box2 direction="horizontal">
        <Kb.Icon type={icon[props.type]} style={styles.iconHeight} />
      </Kb.Box2>
      <Kb.Text type="BodySmall" center={true} style={styles.text}>
        {getFirstText(props.type, teamOrChannel, teamOrChannelName, notIn)}
      </Kb.Text>
      {props.type === 'subteams' && ( // Subteams has a second paragraph, putting it in a separate text so we get the Box2 gap
        <Kb.Text type="BodySmall" center={true} style={styles.text}>
          Examples: {teamMeta.teamname}.legal, {teamMeta.teamname}.management, {teamMeta.teamname}
          .istanbul, ...
        </Kb.Text>
      )}
      <Kb.Box2 direction={Styles.isMobile ? 'vertical' : 'horizontal'} gap="tiny">
        {props.type === 'members' && notIn && (
          <Kb.Button small={true} mode="Primary" label="Add yourself" onClick={onAddSelf} waiting={waiting} />
        )}
        <Kb.Button
          small={true}
          mode="Secondary"
          label={conversationIDKey ? 'Add people' : buttonLabel[props.type]}
          onClick={onSecondaryAction}
        />
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Styles.padding(40, 0),
        backgroundColor: Styles.globalColors.blueGrey,
        justifyContent: 'flex-start',
      },
      iconHeight: {height: 96},
      text: Styles.platformStyles({
        isElectron: {maxWidth: 272},
      }),
    }) as const
)

export default EmptyRow
