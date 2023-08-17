import * as C from '../../../../constants'
import * as Constants from '../../../../constants/teams'
import * as Container from '../../../../util/container'
import * as Kb from '../../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../../styles'
import type * as T from '../../../../constants/types'
import {Activity, useChannelParticipants} from '../../../common'
import {pluralize} from '../../../../util/string'

type ChannelRowProps = {
  conversationIDKey: T.Chat.ConversationIDKey
  teamID: T.Teams.TeamID
}
const ChannelRow = (props: ChannelRowProps) => {
  const {conversationIDKey, teamID} = props
  const channel = C.useTeamsState(s => Constants.getTeamChannelInfo(s, teamID, conversationIDKey))
  const isGeneral = channel.channelname === 'general'

  const selected = C.useTeamsState(s => !!s.teamSelectedChannels.get(teamID)?.has(channel.conversationIDKey))
  const canPerform = C.useTeamsState(s => Constants.getCanPerformByID(s, teamID))
  const canDelete = canPerform.deleteChannel && !isGeneral

  const numParticipants = useChannelParticipants(teamID, conversationIDKey).length
  const details = C.useTeamsState(s => s.teamDetails.get(teamID))
  const hasAllMembers = details?.members.size === numParticipants
  const activityLevel = C.useTeamsState(
    s => s.activityLevels.channels.get(channel.conversationIDKey) || 'none'
  )

  const nav = Container.useSafeNavigation()
  const setChannelSelected = C.useTeamsState(s => s.dispatch.setChannelSelected)
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

  const deleteChannelConfirmed = C.useTeamsState(s => s.dispatch.deleteChannelConfirmed)

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
      <Kb.Box2 direction={Styles.isMobile ? 'vertical' : 'horizontal'} alignSelf="flex-start" gap="xtiny">
        <Kb.Text type="BodySmall">{membersText}</Kb.Text>
        {!Styles.isMobile && activityLevel !== 'none' && <Kb.Text type="BodySmall">·</Kb.Text>}
        <Activity level={activityLevel} />
      </Kb.Box2>
    </Kb.Box2>
  )

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, toggleShowingPopup} = p
      const menuItems: Array<Kb.MenuItem> = [
        {onClick: onNavToSettings, title: 'Settings'},
        ...(canDelete ? [{danger: true, onClick: onDeleteChannel, title: 'Delete channel'}] : []),
      ]
      return (
        <Kb.FloatingMenu
          attachTo={attachTo}
          closeOnSelect={true}
          items={menuItems}
          onHidden={toggleShowingPopup}
          visible={true}
        />
      )
    },
    [canDelete, onDeleteChannel, onNavToSettings]
  )
  const {toggleShowingPopup, popupAnchor, popup} = Kb.usePopup2(makePopup)

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
    }) as const
)

export default ChannelRow
