import * as React from 'react'
import * as Types from '../../../../constants/types/teams'
import * as ChatTypes from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/teams'
import * as Kb from '../../../../common-adapters'
import * as Container from '../../../../util/container'
import * as TeamsGen from '../../../../actions/teams-gen'
import * as Styles from '../../../../styles'
import {Activity} from '../../../common'
import {pluralize} from '../../../../util/string'

type ChannelRowProps = {
  channel: Types.ChannelInfo
  teamID: Types.TeamID
  conversationIDKey: ChatTypes.ConversationIDKey
}
const ChannelRow = (props: ChannelRowProps) => {
  const {channel, teamID, conversationIDKey} = props
  const isGeneral = channel.channelname === 'general'

  const selected = Container.useSelector(
    state => !!state.teams.selectedChannels.get(teamID)?.has(channel.channelname)
  )
  const canPerform = Container.useSelector(state => Constants.getCanPerformByID(state, teamID))
  const canDelete = canPerform.deleteChannel

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onSelect = (selected: boolean) => {
    dispatch(TeamsGen.createSetChannelSelected({channel: channel.channelname, selected, teamID}))
  }
  const onEditChannel = () =>
    dispatch(nav.safeNavigateAppendPayload({path: [{props, selected: 'teamEditChannel'}]}))
  const onDeleteChannel = () => dispatch(TeamsGen.createDeleteChannelConfirmed({conversationIDKey, teamID}))

  const checkCircle = (
    <Kb.CheckCircle
      checked={selected}
      disabled={isGeneral}
      onCheck={onSelect}
      key={`check-${channel.channelname}`}
      selectedColor={Styles.isDarkMode() ? Styles.globalColors.black : undefined}
    />
  )
  const membersText = channel.hasAllMembers
    ? `All members (${channel.numParticipants.toLocaleString()})`
    : `${channel.numParticipants.toLocaleString()} ${pluralize('member', channel.numParticipants)}`
  const body = (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Text type="BodySemibold" lineClamp={1}>
        #{channel.channelname}
      </Kb.Text>
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Text type="BodySmall" lineClamp={1}>
          {channel.description}{' '}
        </Kb.Text>
        <Kb.Box2 direction={Styles.isMobile ? 'vertical' : 'horizontal'} alignSelf="flex-start" gap="xtiny">
          <Kb.Text type="BodySmall">{membersText}</Kb.Text>
          {!Styles.isMobile && <Kb.Text type="BodySmall">·</Kb.Text>}
          <Activity level="active" />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )

  const menuItems: Array<Kb.MenuItem> = [
    {onClick: () => {}, title: 'Audience stats'},
    {onClick: () => {}, title: 'Settings'},
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

  const actions = (
    <Kb.Box2 direction="horizontal" gap="tiny" style={styles.mobileMarginsHack}>
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
  )
  return (
    <Kb.ListItem2
      action={actions}
      onlyShowActionOnHover="fade"
      height={Styles.isMobile ? 90 : 64}
      icon={checkCircle}
      iconStyleOverride={styles.checkCircle}
      containerStyleOverride={styles.listItemMargin}
      type="Large"
      body={body}
      firstItem={isGeneral}
      style={selected ? styles.selected : undefined}
      onClick={isGeneral ? undefined : () => onSelect(!selected)}
    />
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      checkCircle: Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
      listItemMargin: {marginLeft: 0},
      mobileMarginsHack: Styles.platformStyles({isMobile: {marginRight: 48}}), // ListItem2 is malfunctioning because the checkbox width is unusual
      selected: {backgroundColor: Styles.globalColors.blueLighterOrBlueDarker},
    } as const)
)

export default ChannelRow
