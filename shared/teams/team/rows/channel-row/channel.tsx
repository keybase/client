import * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {useInboxMetadataState} from '@/chat/inbox/metadata'
import {Activity, useActivityLevels, useChannelParticipants} from '@/teams/common'
import {useTeamSelectionState} from '@/teams/common/selection-state'
import {selectionStyles} from '../common'
import {useLoadedTeam} from '../../use-loaded-team'
import {pluralize} from '@/util/string'
import {useSafeNavigation} from '@/util/safe-navigation'

type ChannelRowProps = {
  channel: T.Teams.TeamChannelInfo
  teamID: T.Teams.TeamID
}
const ChannelRow = (props: ChannelRowProps) => {
  const {channel, teamID} = props
  const conversationIDKey = channel.conversationIDKey
  const isGeneral = channel.channelname === 'general'

  const {selectedChannels, setChannelSelected} = useTeamSelectionState()
  const selected = selectedChannels.has(channel.conversationIDKey)
  const {teamDetails, yourOperations: canPerform} = useLoadedTeam(teamID)
  const canDelete = canPerform.deleteChannel && !isGeneral
  const {channels: activityByChannel} = useActivityLevels()

  const inboxParticipants = useInboxMetadataState(s => s.participants.get(conversationIDKey))
  const numParticipants = useChannelParticipants(teamID, conversationIDKey, inboxParticipants).length
  const hasAllMembers = teamDetails.members.size === numParticipants
  const activityLevel = activityByChannel.get(channel.conversationIDKey) || 'none'

  const nav = useSafeNavigation()
  const onSelect = (newSelected: boolean) => {
    setChannelSelected(channel.conversationIDKey, newSelected)
  }

  const onEditChannel = () => {
    nav.safeNavigateAppend({
      name: 'teamEditChannel',
      params: {
        channelname: channel.channelname,
        conversationIDKey: channel.conversationIDKey,
        description: channel.description,
        teamID,
      },
    })
  }
  const onNavToChannel = () => {
    nav.safeNavigateAppend({
      name: 'teamChannel',
      params: {
        conversationIDKey: channel.conversationIDKey,
        teamID,
      },
    })
  }
  const onNavToSettings = () => {
    nav.safeNavigateAppend({
      name: 'teamChannel',
      params: {
        conversationIDKey: channel.conversationIDKey,
        selectedTab: 'settings' as const,
        teamID,
      },
    })
  }

  const onDeleteChannel = () => {
    nav.safeNavigateAppend({
      name: 'teamDeleteChannel',
      params: {conversationIDKey: channel.conversationIDKey, teamID},
    })
  }
  const checkCircle = (
    <Kb.CheckCircle
      checked={selected}
      disabled={isGeneral}
      onCheck={onSelect}
      key={`check-${channel.channelname}`}
      style={selectionStyles.widenClickableArea}
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
      <Kb.Box2 direction={isMobile ? 'vertical' : 'horizontal'} alignSelf="flex-start" gap="xtiny">
        <Kb.Text type="BodySmall">{membersText}</Kb.Text>
        {!isMobile && activityLevel !== 'none' && <Kb.Text type="BodySmall">·</Kb.Text>}
        <Activity level={activityLevel} />
      </Kb.Box2>
    </Kb.Box2>
  )

  const makePopup = (p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p
    const menuItems: Array<Kb.MenuItem> = [
      {onClick: onNavToSettings, title: 'Settings'},
      ...(canDelete ? [{danger: true, onClick: onDeleteChannel, title: 'Delete channel'}] : []),
    ]
    return (
      <Kb.FloatingMenu
        attachTo={attachTo}
        closeOnSelect={true}
        items={menuItems}
        onHidden={hidePopup}
        visible={true}
      />
    )
  }
  const {showPopup, popupAnchor, popup} = Kb.usePopup2(makePopup)

  const actions = canPerform.deleteChannel ? (
    <Kb.Box2
      direction="horizontal"
      gap="tiny"
      style={Kb.Styles.collapseStyles([styles.actionButtons, selectionStyles.mobileMarginsHack])}
      alignSelf="flex-start"
    >
      {popup}
      <Kb.IconButton
        icon="iconfont-edit"
        iconColor={Kb.Styles.globalColors.black_50}
        mode="Secondary"
        onClick={onEditChannel}
        small={true}
        tooltip="Edit channel"
      />
      <Kb.IconButton
        icon="iconfont-ellipsis"
        iconColor={Kb.Styles.globalColors.black_50}
        mode="Secondary"
        onClick={showPopup}
        ref={popupAnchor}
        small={true}
        tooltip="More actions"
      />
    </Kb.Box2>
  ) : undefined
  const massActionsProps = canPerform.deleteChannel
    ? {
        containerStyleOverride: selectionStyles.listItemMargin,
        icon: checkCircle,
        iconStyleOverride: styles.checkCircle,
      }
    : {}
  return (
    <Kb.ListItem
      {...massActionsProps}
      action={actions}
      onlyShowActionOnHover="fade"
      height={isMobile ? 90 : 64}
      type="Large"
      body={body}
      firstItem={isGeneral}
      style={selected ? selectionStyles.selected : selectionStyles.unselected}
      onClick={onNavToChannel}
    />
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      actionButtons: {
        paddingTop: Kb.Styles.globalMargins.tiny,
      },
      // like selectionStyles.checkCircle but deliberately not centered in the taller row
      checkCircle: Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.small),
      row: {
        paddingTop: Kb.Styles.globalMargins.xtiny,
      },
    }) as const
)

// memo: the team screen's section hooks rebuild data arrays per render
// (e.g. while typing filters); rows have stable/primitive props so they bail
export default React.memo(ChannelRow)
