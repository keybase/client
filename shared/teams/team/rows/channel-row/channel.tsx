import * as Kb from '@/common-adapters'
import * as React from 'react'
import type * as T from '@/constants/types'
import {Activity, useChannelParticipants} from '@/teams/common'
import {pluralize} from '@/util/string'
import {useSafeNavigation} from '@/util/safe-navigation'
import * as Teams from '@/stores/teams'
import {useTeamsState} from '@/stores/teams'

type ChannelRowProps = {
  conversationIDKey: T.Chat.ConversationIDKey
  teamID: T.Teams.TeamID
}
const ChannelRow = (props: ChannelRowProps) => {
  const {conversationIDKey, teamID} = props
  const channel = useTeamsState(s => Teams.getTeamChannelInfo(s, teamID, conversationIDKey))
  const isGeneral = channel.channelname === 'general'

  const selected = useTeamsState(s => !!s.teamSelectedChannels.get(teamID)?.has(channel.conversationIDKey))
  const canPerform = useTeamsState(s => Teams.getCanPerformByID(s, teamID))
  const canDelete = canPerform.deleteChannel && !isGeneral

  const numParticipants = useChannelParticipants(teamID, conversationIDKey).length
  const details = useTeamsState(s => s.teamDetails.get(teamID))
  const hasAllMembers = details?.members.size === numParticipants
  const activityLevel = useTeamsState(s => s.activityLevels.channels.get(channel.conversationIDKey) || 'none')

  const nav = useSafeNavigation()
  const setChannelSelected = useTeamsState(s => s.dispatch.setChannelSelected)
  const onSelect = (newSelected: boolean) => {
    setChannelSelected(teamID, channel.conversationIDKey, newSelected)
  }

  const onEditChannel = React.useCallback(() => {
    nav.safeNavigateAppend({
      props: {
        channelname: channel.channelname,
        conversationIDKey: channel.conversationIDKey,
        description: channel.description,
        teamID,
      },
      selected: 'teamEditChannel',
    })
  }, [nav, channel, teamID])
  const onNavToChannel = React.useCallback(() => {
    nav.safeNavigateAppend({
      props: {
        conversationIDKey: channel.conversationIDKey,
        teamID,
      },
      selected: 'teamChannel',
    })
  }, [nav, channel, teamID])
  const onNavToSettings = React.useCallback(() => {
    nav.safeNavigateAppend({
      props: {
        ...props,
        conversationIDKey: channel.conversationIDKey,
        selectedTab: 'settings' as const,
      },
      selected: 'teamChannel',
    })
  }, [channel, props, nav])

  const deleteChannelConfirmed = useTeamsState(s => s.dispatch.deleteChannelConfirmed)

  const onDeleteChannel = React.useCallback(() => {
    deleteChannelConfirmed(teamID, channel.conversationIDKey)
  }, [deleteChannelConfirmed, channel, teamID])
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
      <Kb.Box2 direction={Kb.Styles.isMobile ? 'vertical' : 'horizontal'} alignSelf="flex-start" gap="xtiny">
        <Kb.Text type="BodySmall">{membersText}</Kb.Text>
        {!Kb.Styles.isMobile && activityLevel !== 'none' && <Kb.Text type="BodySmall">·</Kb.Text>}
        <Activity level={activityLevel} />
      </Kb.Box2>
    </Kb.Box2>
  )

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
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
    },
    [canDelete, onDeleteChannel, onNavToSettings]
  )
  const {showPopup, popupAnchor, popup} = Kb.usePopup2(makePopup)

  const actions = canPerform.deleteChannel ? (
    <Kb.Box2
      direction="horizontal"
      gap="tiny"
      style={Kb.Styles.collapseStyles([styles.actionButtons, styles.mobileMarginsHack])}
      alignSelf="flex-start"
    >
      {popup}
      <Kb.Button
        icon="iconfont-edit"
        iconColor={Kb.Styles.globalColors.black_50}
        mode="Secondary"
        onClick={onEditChannel}
        small={true}
        tooltip="Edit channel"
      />
      <Kb.Button
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
      height={Kb.Styles.isMobile ? 90 : 64}
      type="Large"
      body={body}
      firstItem={isGeneral}
      style={selected ? styles.selected : styles.unselected}
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
      checkCircle: Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.small),
      listItemMargin: {marginLeft: 0},
      mobileMarginsHack: Kb.Styles.platformStyles({isMobile: {marginRight: 48}}), // ListItem2 is malfunctioning because the checkbox width is unusual
      row: {
        paddingTop: Kb.Styles.globalMargins.xtiny,
      },
      selected: {backgroundColor: Kb.Styles.globalColors.blueLighterOrBlueDarker},
      unselected: {backgroundColor: Kb.Styles.globalColors.white},
      widenClickableArea: {margin: -5, padding: 5},
    }) as const
)

export default ChannelRow
