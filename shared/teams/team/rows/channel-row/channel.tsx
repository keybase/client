import type * as Types from '../../../../constants/types/teams'
import type * as ChatTypes from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/teams'
import * as Kb from '../../../../common-adapters'
import * as Container from '../../../../util/container'
import * as TeamsGen from '../../../../actions/teams-gen'
import * as Styles from '../../../../styles'
import {Activity, useChannelParticipants} from '../../../common'
import {pluralize} from '../../../../util/string'

type ChannelRowProps = {
  conversationIDKey: ChatTypes.ConversationIDKey
  teamID: Types.TeamID
}
const ChannelRow = (props: ChannelRowProps) => {
  const {conversationIDKey, teamID} = props
  const channel = Container.useSelector(s => Constants.getTeamChannelInfo(s, teamID, conversationIDKey))
  const isGeneral = channel.channelname === 'general'

  const selected = Container.useSelector(
    state => !!state.teams.teamSelectedChannels.get(teamID)?.has(channel.conversationIDKey)
  )
  const canPerform = Container.useSelector(state => Constants.getCanPerformByID(state, teamID))
  const canDelete = canPerform.deleteChannel && !isGeneral

  const numParticipants = useChannelParticipants(teamID, conversationIDKey).length
  const details = Container.useSelector(state => Constants.getTeamDetails(state, teamID))
  const hasAllMembers = details.members.size === numParticipants
  const activityLevel = Container.useSelector(
    state => state.teams.activityLevels.channels.get(channel.conversationIDKey) || 'none'
  )

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onSelect = (newSelected: boolean) => {
    dispatch(
      TeamsGen.createSetChannelSelected({channel: channel.conversationIDKey, selected: newSelected, teamID})
    )
  }
  const navPropsForAction = {
    conversationIDKey: channel.conversationIDKey,
    teamID,
  }
  const editChannelProps = {
    ...navPropsForAction,
    afterEdit: () => {
      dispatch(TeamsGen.createLoadTeamChannelList({teamID}))
    },
    channelname: channel.channelname,
    description: channel.description,
  }
  const onEditChannel = () =>
    dispatch(nav.safeNavigateAppendPayload({path: [{props: editChannelProps, selected: 'teamEditChannel'}]}))
  const onNavToChannel = () =>
    dispatch(nav.safeNavigateAppendPayload({path: [{props: navPropsForAction, selected: 'teamChannel'}]}))
  const onNavToSettings = () =>
    dispatch(
      nav.safeNavigateAppendPayload({
        path: [
          {
            props: {
              ...props,
              conversationIDKey: channel.conversationIDKey,
              selectedTab: 'settings' as const,
            },
            selected: 'teamChannel',
          },
        ],
      })
    )

  const onDeleteChannel = () =>
    dispatch(TeamsGen.createDeleteChannelConfirmed({conversationIDKey: channel.conversationIDKey, teamID}))
  const checkCircle = (
    <Kb.CheckCircle
      checked={selected}
      disabled={isGeneral}
      onCheck={onSelect}
      key={`check-${channel.channelname}`}
      style={styles.widenClickableArea}
    />
  )
  const membersText = hasAllMembers
    ? `All members (${numParticipants.toLocaleString()})`
    : `${numParticipants.toLocaleString()} ${pluralize('member', numParticipants)}`
  const body = (
    <Kb.Box2 direction="vertical" fullWidth={true} alignSelf="flex-start" style={styles.row}>
      <Kb.Text type="BodySemibold" lineClamp={1}>
        #{channel.channelname}
      </Kb.Text>
      <Kb.Text type="BodySmall" lineClamp={1}>
        {channel.description}
      </Kb.Text>
      <Kb.Box2 direction={Styles.isMobile ? 'vertical' : 'horizontal'} alignSelf="flex-start" gap="xtiny">
        <Kb.Text type="BodySmall">{membersText}</Kb.Text>
        {!Styles.isMobile && activityLevel !== 'none' && <Kb.Text type="BodySmall">·</Kb.Text>}
        <Activity level={activityLevel} />
      </Kb.Box2>
    </Kb.Box2>
  )

  const menuItems: Array<Kb.MenuItem> = [
    {onClick: onNavToSettings, title: 'Settings'},
    ...(canDelete ? [{danger: true, onClick: onDeleteChannel, title: 'Delete channel'}] : []),
  ]
  const {showingPopup, toggleShowingPopup, popupAnchor, popup} = Kb.usePopup(attachTo => (
    <Kb.FloatingMenu
      attachTo={attachTo}
      closeOnSelect={true}
      items={menuItems}
      onHidden={toggleShowingPopup}
      visible={showingPopup}
    />
  ))

  const actions = canPerform.deleteChannel ? (
    <Kb.Box2
      direction="horizontal"
      gap="tiny"
      style={Styles.collapseStyles([
        styles.actionButtons,
        canPerform.deleteChannel ? styles.mobileMarginsHack : undefined,
      ])}
      alignSelf="flex-start"
    >
      {popup}
      <Kb.Button
        icon="iconfont-edit"
        iconColor={Styles.globalColors.black_50}
        mode="Secondary"
        onClick={onEditChannel}
        small={true}
        tooltip="Edit channel"
      />
      <Kb.Button
        icon="iconfont-ellipsis"
        iconColor={Styles.globalColors.black_50}
        mode="Secondary"
        onClick={toggleShowingPopup}
        ref={popupAnchor}
        small={true}
        tooltip="More actions"
      />
    </Kb.Box2>
  ) : undefined
  const massActionsProps = canPerform.deleteChannel
    ? {
        containerStyleOverride: styles.listItemMargin,
        icon: checkCircle,
        iconStyleOverride: styles.checkCircle,
      }
    : {}
  return (
    <Kb.ListItem2
      {...massActionsProps}
      action={actions}
      onlyShowActionOnHover="fade"
      height={Styles.isMobile ? 90 : 64}
      type="Large"
      body={body}
      firstItem={isGeneral}
      style={selected ? styles.selected : styles.unselected}
      onClick={onNavToChannel}
    />
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      actionButtons: {
        paddingTop: Styles.globalMargins.tiny,
      },
      checkCircle: Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
      listItemMargin: {marginLeft: 0},
      mobileMarginsHack: Styles.platformStyles({isMobile: {marginRight: 48}}), // ListItem2 is malfunctioning because the checkbox width is unusual
      row: {
        paddingTop: Styles.globalMargins.xtiny,
      },
      selected: {backgroundColor: Styles.globalColors.blueLighterOrBlueDarker},
      unselected: {backgroundColor: Styles.globalColors.white},
      widenClickableArea: {margin: -5, padding: 5},
    } as const)
)

export default ChannelRow
