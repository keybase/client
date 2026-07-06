import * as C from '@/constants'
import * as T from '@/constants/types'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Common from '@/teams/common'
import {useSafeNavigation} from '@/util/safe-navigation'

// horizontal padding shared with the header row in add-to-channels.tsx
export const itemStyle = Kb.Styles.platformStyles({
  isElectron: {...Kb.Styles.padding(0, Kb.Styles.globalMargins.small)},
  isMobile: {
    ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
  },
})

const SelfChannelActions = function SelfChannelActions(p: {
  canDeleteChannel: boolean
  canEditChannelDescription: boolean
  meta: T.Chat.ConversationMeta
  reloadChannels: () => Promise<void>
  selfMode: boolean
}) {
  const {canDeleteChannel, canEditChannelDescription, meta, reloadChannels} = p
  const nav = useSafeNavigation()
  const inChannel = meta.membershipType === 'active'

  const [waiting, setWaiting] = React.useState(false)
  const stopWaiting = () => setWaiting(false)

  const onEditChannel = () => {
    nav.safeNavigateAppend({
      name: 'teamEditChannel',
      params: {
        channelname: meta.channelname,
        conversationIDKey: meta.conversationIDKey,
        description: meta.description,
        teamID: meta.teamID,
      },
    })
  }
  const clearModals = C.Router2.clearModals
  const navigateAppend = C.Router2.navigateAppend
  const onChannelSettings = () => {
    clearModals()
    navigateAppend({
      name: 'teamChannel',
      params: {conversationIDKey: meta.conversationIDKey, teamID: meta.teamID},
    })
  }
  const onDelete = () => {
    // TODO: consider not using the confirm modal
    nav.safeNavigateAppend({
      name: 'teamDeleteChannel',
      params: {conversationIDKey: meta.conversationIDKey, teamID: meta.teamID},
    })
  }

  const joinRPC = C.useRPC(T.RPCChat.localJoinConversationByIDLocalRpcPromise)
  const leaveRPC = C.useRPC(T.RPCChat.localLeaveConversationLocalRpcPromise)

  const convID = T.Chat.keyToConversationID(meta.conversationIDKey)
  const onLeave = () => {
    setWaiting(true)
    leaveRPC(
      [{convID}],
      () => {
        reloadChannels()
          .then(stopWaiting, stopWaiting)
          .catch(() => {})
      },
      stopWaiting
    )
  }
  const onJoin = () => {
    setWaiting(true)
    joinRPC(
      [{convID}],
      () => {
        reloadChannels()
          .then(stopWaiting, stopWaiting)
          .catch(() => {})
      },
      stopWaiting
    )
  }

  const makePopup = (p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p
    const menuItems = [
      {icon: 'iconfont-edit' as const, onClick: onEditChannel, title: 'Edit channel'},
      ...(canDeleteChannel
        ? [
            {
              icon: 'iconfont-nav-2-settings' as const,
              onClick: onChannelSettings,
              title: 'Channel settings',
            },
            {danger: true, icon: 'iconfont-remove' as const, onClick: onDelete, title: 'Delete'},
          ]
        : []),
    ]
    return (
      <Kb.FloatingMenu
        attachTo={attachTo}
        visible={true}
        onHidden={hidePopup}
        closeOnSelect={true}
        items={menuItems}
      />
    )
  }
  const {popupAnchor, showPopup, popup} = Kb.usePopup2(makePopup)
  const [buttonMousedOver, setMouseover] = React.useState(false)
  return (
    <Kb.Box2
      direction="horizontal"
      gap="xtiny"
      fullHeight={true}
      centerChildren={true}
    >
      {popup}
      <Kb.Box2
        direction="horizontal"
        onMouseOver={() => setMouseover(true)}
        onMouseLeave={() => setMouseover(false)}
      >
        <Kb.Button
          disabled={meta.channelname === 'general'}
          type={buttonMousedOver && inChannel ? 'Default' : 'Success'}
          mode={inChannel ? 'Secondary' : 'Primary'}
          label={inChannel ? (buttonMousedOver ? 'Leave' : 'In') : 'Join'}
          onClick={inChannel ? onLeave : onJoin}
          small={true}
          waiting={waiting}
        >
          {inChannel && !buttonMousedOver ? <Kb.Icon type="iconfont-check" sizeType="Tiny" /> : undefined}
        </Kb.Button>
      </Kb.Box2>
      {canEditChannelDescription && (
        <Kb.IconButton
          icon="iconfont-ellipsis"
          iconColor={Kb.Styles.globalColors.black_50}
          onClick={showPopup}
          ref={popupAnchor}
          small={true}
          mode="Secondary"
          type="Dim"
        />
      )}
    </Kb.Box2>
  )
}

type ChannelRowProps = {
  canDeleteChannel: boolean
  canEditChannelDescription: boolean
  channelMeta: T.Chat.ConversationMeta
  selected: boolean
  onSelect: (conviID: T.Chat.ConversationIDKey) => void
  mode: 'self' | 'others'
  participants: ReadonlyArray<string>
  reloadChannels: () => Promise<void>
  usernames: string[]
  rowHeight: number
}
const ChannelRow = function ChannelRow(p: ChannelRowProps) {
  const {
    canDeleteChannel,
    canEditChannelDescription,
    channelMeta,
    mode,
    participants,
    selected,
    onSelect: _onSelect,
    reloadChannels,
    usernames,
    rowHeight,
  } = p
  const {conversationIDKey} = channelMeta
  const selfMode = mode === 'self'
  const {channels: activityByChannel} = Common.useActivityLevels()
  const activityLevel = activityByChannel.get(channelMeta.conversationIDKey) || 'none'
  const allInChannel = usernames.every(member => participants.includes(member))
  const previewConversation = C.Router2.previewConversation
  const onPreviewChannel = () =>
    previewConversation({
      conversationIDKey: channelMeta.conversationIDKey,
      reason: 'manageView',
    })

  const onSelect = () => {
    _onSelect(conversationIDKey)
  }

  return isMobile ? (
    <Kb.ClickableBox
      onClick={selfMode ? onPreviewChannel : onSelect}
      direction="horizontal"
      alignItems="center"
      fullWidth={true}
      gap="tiny"
      justifyContent="space-between"
      style={Kb.Styles.collapseStyles([{height: rowHeight}, itemStyle])}
    >
        <Kb.Text type="Body" lineClamp={1} style={styles.channelText}>
          #{channelMeta.channelname}
        </Kb.Text>
        <Common.Activity level={activityLevel} iconOnly={true} />
        <ParticipantMeta numParticipants={participants.length} />
        {selfMode ? (
          <SelfChannelActions
            canDeleteChannel={canDeleteChannel}
            canEditChannelDescription={canEditChannelDescription}
            selfMode={selfMode}
            meta={channelMeta}
            reloadChannels={reloadChannels}
          />
        ) : (
          <Kb.CheckCircle
            checked={selected || allInChannel}
            onCheck={onSelect}
            disabled={channelMeta.channelname === 'general' || allInChannel}
            disabledColor={
              channelMeta.channelname === 'general' || allInChannel
                ? Kb.Styles.globalColors.black_20OrWhite_20
                : undefined
            }
          />
        )}
      </Kb.ClickableBox>
  ) : (
    <Kb.ListItem
      fullDivider={true}
      onMouseDown={
        selfMode || channelMeta.channelname === 'general' || allInChannel
          ? undefined
          : evt => {
              // using onMouseDown so we can prevent blurring the search filter
              evt.preventDefault()
              onSelect()
            }
      }
      onClick={selfMode ? onPreviewChannel : undefined}
      type="Small"
      action={
        selfMode ? (
          <Kb.Box2 direction="horizontal" gap="tiny" fullHeight={true}>
            <Kb.Box2 direction="horizontal" alignSelf="stretch">
              <Common.Activity level={activityLevel} />
            </Kb.Box2>
            <Kb.Box2 direction="horizontal">
              <ParticipantMeta numParticipants={participants.length} />
            </Kb.Box2>
            <SelfChannelActions
              canDeleteChannel={canDeleteChannel}
              canEditChannelDescription={canEditChannelDescription}
              selfMode={selfMode}
              meta={channelMeta}
              reloadChannels={reloadChannels}
            />
          </Kb.Box2>
        ) : (
          <Kb.CheckCircle
            checked={selected || allInChannel}
            disabled={channelMeta.channelname === 'general' || allInChannel}
            disabledColor={
              channelMeta.channelname === 'general' || allInChannel
                ? Kb.Styles.globalColors.black_20OrWhite_20
                : undefined
            }
            onCheck={() => {
              /* ListItem onMouseDown triggers this */
            }}
          />
        )
      }
      firstItem={false}
      body={
        <Kb.Box2 direction="vertical" alignItems="stretch">
          <Kb.Box2 direction="horizontal" gap="xtiny" alignSelf="flex-start">
            <Kb.Text type="BodySemibold" lineClamp={1}>
              #{channelMeta.channelname}
            </Kb.Text>
          </Kb.Box2>
          {selfMode && (
            <Kb.Text
              type="BodySmall"
              lineClamp={1}
              style={styles.description}
              title={channelMeta.description}
            >
              {channelMeta.description}
            </Kb.Text>
          )}
        </Kb.Box2>
      }
      containerStyleOverride={styles.channelRowContainer}
    />
  )
}

const ParticipantMeta = (props: {numParticipants: number}) => (
  <Kb.Meta
    color={Kb.Styles.globalColors.black_50}
    icon="iconfont-people-solid"
    iconColor={Kb.Styles.globalColors.black_20}
    title={props.numParticipants.toLocaleString()}
    backgroundColor={Kb.Styles.globalColors.black_10}
    style={styles.participantMeta}
  />
)

const styles = Kb.Styles.styleSheetCreate(() => ({
  channelRowContainer: {marginLeft: 16, marginRight: 8},
  channelText: {flexGrow: 1, flexShrink: 1},
  description: Kb.Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
  participantMeta: {...Kb.Styles.padding(3, 6)},
}))

export default ChannelRow
