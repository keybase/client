import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as ChatConstants from '../../../constants/chat2'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import * as Container from '../../../util/container'
import * as RPCChatGen from '../../../constants/types/rpc-chat-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as ChatGen from '../../../actions/chat2-gen'
import * as ChatTypes from '../../../constants/types/chat2'
import * as Common from '../../common'
import {pluralize} from '../../../util/string'
import {memoize} from '../../../util/memoize'
import {useAllChannelMetas} from '../../common/channel-hooks'

type Props = Container.RouteProps<{
  teamID: Types.TeamID
  usernames: Array<string> | undefined // undefined means the user themself
}>

const getChannelsForList = memoize(
  (
    channels: Map<ChatTypes.ConversationIDKey, ChatTypes.ConversationMeta>,
    participantMap: Map<ChatTypes.ConversationIDKey, ChatTypes.ParticipantInfo>,
    usernames: string[]
  ) => {
    const processed = [...channels.values()].reduce(
      ({list, general}: {general: ChatTypes.ConversationMeta; list: Array<ChatTypes.ConversationMeta>}, c) =>
        c.channelname === 'general' ? {general: c, list} : {general, list: [...list, c]},
      {general: ChatConstants.makeConversationMeta(), list: []}
    )
    const {list, general} = processed
    const sortedList = list.sort((a, b) => a.channelname.localeCompare(b.channelname))
    const convIDKeysAvailable = sortedList
      .map(c => c.conversationIDKey)
      .filter(convIDKey => {
        const participants = participantMap.get(convIDKey)?.all
        // At least one person is not in the channel
        return usernames.some(member => !participants?.includes(member))
      })
    return {
      channelMetaGeneral: general,
      channelMetasAll: [general, ...sortedList],
      convIDKeysAvailable,
    }
  }
)

const AddToChannels = (props: Props) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const teamID = Container.getRouteProps(props, 'teamID', Types.noTeamID)
  const myUsername = Container.useSelector(state => state.config.username)
  const usernames = Container.getRouteProps(props, 'usernames', undefined) ?? [myUsername]
  const mode = Container.getRouteProps(props, 'usernames', undefined) ? 'others' : 'self'

  const {channelMetas, loadingChannels, reloadChannels} = useAllChannelMetas(teamID)
  const participantMap = Container.useSelector(s => s.chat2.participantMap)
  const {channelMetasAll, channelMetaGeneral, convIDKeysAvailable} = getChannelsForList(
    channelMetas,
    participantMap,
    usernames
  )

  const [filter, setFilter] = React.useState('')
  const filterLCase = filter.trim().toLowerCase()
  const [filtering, setFiltering] = React.useState(false)
  const channels = filterLCase
    ? channelMetasAll.filter(c => c.channelname.toLowerCase().includes(filterLCase))
    : channelMetasAll
  const items = [
    ...(filtering ? [] : [{type: 'header' as const}]),
    ...channels.map(c => ({
      channelMeta: c,
      numMembers:
        participantMap.get(c.conversationIDKey)?.name?.length ??
        participantMap.get(c.conversationIDKey)?.all?.length ??
        0,
      type: 'channel' as const,
    })),
  ]
  const [selected, setSelected] = React.useState(new Set<ChatTypes.ConversationIDKey>())
  const onSelect = (convIDKey: ChatTypes.ConversationIDKey) => {
    if (convIDKey === channelMetaGeneral.conversationIDKey) return
    if (selected.has(convIDKey)) {
      selected.delete(convIDKey)
      setSelected(new Set(selected))
    } else {
      selected.add(convIDKey)
      setSelected(new Set(selected))
    }
  }
  const onSelectAll = () => setSelected(new Set(convIDKeysAvailable))
  const onSelectNone = convIDKeysAvailable.length === 0 ? undefined : () => setSelected(new Set())

  const onCancel = () => dispatch(nav.safeNavigateUpPayload())
  const onCreate = () =>
    dispatch(nav.safeNavigateAppendPayload({path: [{props: {teamID}, selected: 'chatCreateChannel'}]}))

  const submit = Container.useRPC(RPCChatGen.localBulkAddToManyConvsRpcPromise)
  const [waiting, setWaiting] = React.useState(false)
  const onFinish = () => {
    if (!selected.size) {
      onCancel()
      return
    }
    setWaiting(true)
    submit(
      [{conversations: [...selected].map(ChatTypes.keyToConversationID), usernames}],
      () => {
        setWaiting(false)
        onCancel()
      },
      error => {
        console.error(error)
        setWaiting(false)
      }
    )
  }

  const numSelected = selected.size

  const getItemLayout = React.useCallback(
    (index: number, item?: Unpacked<typeof items>) =>
      item && item.type === 'header'
        ? {
            index,
            length: Styles.isMobile ? 48 : 40,
            offset: 0,
          }
        : {
            index,
            length: mode === 'self' ? 72 : 56,
            offset: 48 + (index > 0 ? index - 1 : index) * (mode === 'self' ? 72 : 56),
          },
    [mode]
  )
  const renderItem = (_, item: Unpacked<typeof items>) => {
    switch (item.type) {
      case 'header': {
        const allSelected = selected.size === convIDKeysAvailable.length
        return (
          <HeaderRow
            key="{header}"
            mode={mode}
            onCreate={onCreate}
            onSelectAll={allSelected ? undefined : onSelectAll}
            onSelectNone={allSelected ? onSelectNone : undefined}
          />
        )
      }
      case 'channel':
        return (
          <ChannelRow
            key={item.channelMeta.channelname}
            channelMeta={item.channelMeta}
            selected={
              selected.has(item.channelMeta.conversationIDKey) ||
              item.channelMeta.conversationIDKey === channelMetaGeneral.conversationIDKey
            }
            onSelect={() => onSelect(item.channelMeta.conversationIDKey)}
            mode={mode}
            reloadChannels={reloadChannels}
            usernames={usernames}
          />
        )
    }
  }

  // channel rows use activity levels
  Common.useActivityLevels()

  // TODO: alternate title when there aren't channels yet?
  const title =
    mode === 'self' ? 'Browse all channels' : `Add${usernames.length === 1 ? ` ${usernames[0]}` : ''} to...`
  return (
    <Kb.Modal
      mode="DefaultFullHeight"
      header={{
        hideBorder: Styles.isMobile,
        leftButton: Styles.isMobile ? (
          <Kb.Text type="BodyBigLink" onClick={onCancel}>
            Cancel
          </Kb.Text>
        ) : (
          undefined
        ),
        rightButton:
          Styles.isMobile && mode === 'others' ? (
            waiting ? (
              <Kb.ProgressIndicator type="Large" />
            ) : (
              <Kb.Text type="BodyBigLink" onClick={onFinish} style={!numSelected && styles.disabled}>
                Add
              </Kb.Text>
            )
          ) : (
            undefined
          ),
        title: <Common.ModalTitle teamID={teamID} title={title} />,
      }}
      footer={
        Styles.isMobile || mode === 'self'
          ? undefined
          : {
              content: (
                <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true}>
                  <Kb.Button
                    type="Dim"
                    label="Cancel"
                    onClick={onCancel}
                    style={Styles.globalStyles.flexOne}
                    disabled={waiting}
                  />
                  <Kb.Button
                    label={
                      numSelected ? `Add to ${numSelected} ${pluralize('channel', numSelected)}` : 'Add...'
                    }
                    onClick={onFinish}
                    disabled={!numSelected}
                    style={Styles.globalStyles.flexOne}
                    waiting={waiting}
                  />
                </Kb.Box2>
              ),
            }
      }
      allowOverflow={true}
      noScrollView={true}
      onClose={onCancel}
    >
      {loadingChannels && !channelMetas?.size ? (
        <Kb.Box fullWidth={true} style={Styles.globalStyles.flexOne}>
          <Kb.ProgressIndicator type="Large" />
        </Kb.Box>
      ) : (
        <Kb.Box2 direction="vertical" fullWidth={true} style={Styles.globalStyles.flexOne}>
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.searchFilterContainer}>
            <Kb.SearchFilter
              placeholderText={`Search ${channelMetasAll.length} ${pluralize(
                'channel',
                channelMetasAll.length
              )}`}
              icon="iconfont-search"
              onChange={setFilter}
              size="full-width"
              hotkey="f"
              onFocus={() => setFiltering(true)}
              onBlur={() => setFiltering(false)}
            />
          </Kb.Box2>
          <Kb.Box2 direction="vertical" style={Styles.globalStyles.flexOne} fullWidth={true}>
            <Kb.List2 items={items} renderItem={renderItem} itemHeight={{getItemLayout, type: 'variable'}} />
          </Kb.Box2>
        </Kb.Box2>
      )}
    </Kb.Modal>
  )
}

const HeaderRow = ({mode, onCreate, onSelectAll, onSelectNone}) => (
  <Kb.Box2
    direction="horizontal"
    alignItems="center"
    fullWidth={true}
    style={Styles.collapseStyles([styles.item, styles.headerItem])}
  >
    <Kb.Button label="Create channel" small={true} mode="Secondary" onClick={onCreate} />
    {mode === 'self' || (!onSelectAll && !onSelectNone) ? (
      <Kb.Box /> // box so that the other item aligns to the left
    ) : (
      <Kb.Text type="BodyPrimaryLink" onClick={onSelectAll || onSelectNone}>
        {onSelectAll ? 'Select all' : 'Clear'}
      </Kb.Text>
    )}
  </Kb.Box2>
)

const SelfChannelActions = ({
  meta,
  reloadChannels,
  selfMode,
}: {
  meta: ChatTypes.ConversationMeta
  reloadChannels: () => Promise<undefined>
  selfMode: boolean
}) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const yourOperations = Container.useSelector(state => Constants.getCanPerformByID(state, meta.teamID))
  const isAdmin = yourOperations.deleteChannel
  const canEdit = yourOperations.editChannelDescription
  const inChannel = meta.membershipType === 'active'

  const [waiting, setWaiting] = React.useState(false)
  const stopWaiting = () => setWaiting(false)

  const actionProps = {conversationIDKey: meta.conversationIDKey, teamID: meta.teamID}
  const editChannelProps = {
    ...actionProps,
    afterEdit: () => {
      setWaiting(true)
      reloadChannels().then(stopWaiting, stopWaiting)
    },
    channelname: meta.channelname,
    description: meta.description,
  }
  const onEditChannel = () =>
    dispatch(nav.safeNavigateAppendPayload({path: [{props: editChannelProps, selected: 'teamEditChannel'}]}))
  const onChannelSettings = () => {
    dispatch(RouteTreeGen.createClearModals())
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: actionProps, selected: 'teamChannel'}]}))
  }
  const onDelete = () =>
    // TODO: consider not using the confirm modal
    dispatch(nav.safeNavigateAppendPayload({path: [{props: actionProps, selected: 'teamDeleteChannel'}]}))

  const joinRPC = Container.useRPC(RPCChatGen.localJoinConversationByIDLocalRpcPromise)
  const leaveRPC = Container.useRPC(RPCChatGen.localLeaveConversationLocalRpcPromise)

  const convID = ChatTypes.keyToConversationID(meta.conversationIDKey)
  const onLeave = () => {
    setWaiting(true)
    leaveRPC([{convID}], () => reloadChannels().then(stopWaiting, stopWaiting), stopWaiting)
  }
  const onJoin = () => {
    setWaiting(true)
    joinRPC([{convID}], () => reloadChannels().then(stopWaiting, stopWaiting), stopWaiting)
  }

  const menuItems = [
    {icon: 'iconfont-edit' as const, onClick: onEditChannel, title: 'Edit channel'},
    ...(isAdmin
      ? [
          {icon: 'iconfont-nav-2-settings' as const, onClick: onChannelSettings, title: 'Channel settings'},
          {danger: true, icon: 'iconfont-remove' as const, onClick: onDelete, title: 'Delete'},
        ]
      : []),
  ]
  const {popupAnchor, showingPopup, toggleShowingPopup, popup} = Kb.usePopup(getAttachmentRef => (
    <Kb.FloatingMenu
      attachTo={getAttachmentRef}
      visible={showingPopup}
      onHidden={toggleShowingPopup}
      closeOnSelect={true}
      items={menuItems}
    />
  ))
  const [buttonMousedOver, setMouseover] = React.useState(false)
  return (
    <Kb.Box2
      direction="horizontal"
      gap="xtiny"
      fullHeight={true}
      centerChildren={true}
      style={Styles.collapseStyles([selfMode && !Styles.isMobile && styles.channelRowSelfMode])}
    >
      {popup}
      {meta.channelname !== 'general' && (
        <Kb.Button
          type={buttonMousedOver && inChannel ? 'Default' : 'Success'}
          mode={inChannel ? 'Secondary' : 'Primary'}
          label={inChannel ? (buttonMousedOver ? 'Leave' : 'In') : 'Join'}
          icon={inChannel && !buttonMousedOver ? 'iconfont-check' : undefined}
          iconSizeType={inChannel && !buttonMousedOver ? 'Tiny' : undefined}
          onMouseEnter={Styles.isMobile ? undefined : () => setMouseover(true)}
          onMouseLeave={Styles.isMobile ? undefined : () => setMouseover(false)}
          onMouseDown={
            Styles.isMobile
              ? undefined
              : evt => {
                  // using onMouseDown so we can prevent blurring the search filter
                  evt.preventDefault()
                  inChannel ? onLeave() : onJoin()
                }
          }
          onClick={Styles.isMobile ? (inChannel ? onLeave : onJoin) : undefined}
          small={true}
          style={styles.joinLeaveButton}
          waiting={waiting}
        />
      )}
      {canEdit && (
        <Kb.Button
          icon="iconfont-ellipsis"
          iconColor={Styles.globalColors.black_50}
          onClick={toggleShowingPopup}
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
  channelMeta: ChatTypes.ConversationMeta
  selected: boolean
  onSelect: () => void
  mode: 'self' | 'others'
  reloadChannels: () => Promise<undefined>
  usernames: string[]
}
const ChannelRow = ({channelMeta, mode, selected, onSelect, reloadChannels, usernames}: ChannelRowProps) => {
  const dispatch = Container.useDispatch()
  const selfMode = mode === 'self'
  const participants = Container.useSelector(s => {
    const info = ChatConstants.getParticipantInfo(s, channelMeta.conversationIDKey)
    return info.name.length ? info.name : info.all
  })
  const activityLevel = Container.useSelector(
    s => s.teams.activityLevels.channels.get(channelMeta.conversationIDKey) || 'none'
  )
  const allInChannel = usernames.every(member => participants.includes(member))
  const onPreviewChannel = () =>
    dispatch(
      ChatGen.createPreviewConversation({
        conversationIDKey: channelMeta.conversationIDKey,
        reason: 'manageView',
      })
    )
  return Styles.isMobile ? (
    <Kb.ClickableBox onClick={selfMode ? onPreviewChannel : onSelect}>
      <Kb.Box2 direction="horizontal" style={styles.item} alignItems="center" fullWidth={true} gap="medium">
        <Kb.Box2 direction="vertical" style={Styles.globalStyles.flexOne}>
          <Kb.Box2 direction="horizontal" gap="tiny" alignSelf="flex-start">
            <Kb.Text type="Body" lineClamp={1} style={styles.channelText}>
              #{channelMeta.channelname}
            </Kb.Text>
            <Common.ParticipantMeta numParticipants={participants.length} />
          </Kb.Box2>
          <Common.Activity level={activityLevel} />
        </Kb.Box2>
        {selfMode ? (
          <SelfChannelActions selfMode={selfMode} meta={channelMeta} reloadChannels={reloadChannels} />
        ) : (
          <Kb.CheckCircle
            checked={selected || allInChannel}
            onCheck={onSelect}
            disabled={channelMeta.channelname === 'general' || allInChannel}
            disabledColor={
              channelMeta.channelname === 'general' || allInChannel
                ? Styles.globalColors.black_20OrWhite_20
                : undefined
            }
          />
        )}
      </Kb.Box2>
    </Kb.ClickableBox>
  ) : (
    <Kb.ListItem2
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
      type="Large"
      action={
        selfMode ? (
          <SelfChannelActions selfMode={selfMode} meta={channelMeta} reloadChannels={reloadChannels} />
        ) : (
          <Kb.CheckCircle
            checked={selected || allInChannel}
            disabled={channelMeta.channelname === 'general' || allInChannel}
            disabledColor={
              channelMeta.channelname === 'general' || allInChannel
                ? Styles.globalColors.black_20OrWhite_20
                : undefined
            }
            onCheck={() => {
              /* ListItem onMouseDown triggers this */
            }}
          />
        )
      }
      firstItem={true}
      body={
        <Kb.Box2 direction="vertical" alignItems="stretch">
          <Kb.Box2 direction="horizontal" gap="xtiny" alignSelf="flex-start">
            <Kb.Text type="BodySemibold" lineClamp={1}>
              #{channelMeta.channelname}
            </Kb.Text>
            <Common.ParticipantMeta numParticipants={participants.length} />
          </Kb.Box2>
          <Kb.Box2 direction="horizontal" alignSelf="stretch" gap="xxtiny">
            <Common.Activity level={activityLevel} />
          </Kb.Box2>
          {selfMode && !Styles.isMobile && (
            <Kb.Text type="BodySmall" lineClamp={1}>
              {channelMeta.description}
            </Kb.Text>
          )}
        </Kb.Box2>
      }
      containerStyleOverride={Styles.collapseStyles([
        styles.channelRowContainer,
        selfMode && !Styles.isMobile && styles.channelRowSelfMode,
      ])}
    />
  )
}

const styles = Styles.styleSheetCreate(() => ({
  channelRowContainer: {marginLeft: 16, marginRight: 8},
  channelRowSelfMode: {minHeight: 72},
  channelText: {flexShrink: 1},
  disabled: {opacity: 0.4},
  headerItem: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.blueGrey,
    },
    isElectron: {
      height: 40,
    },
    isMobile: {
      height: 48,
    },
  }),
  item: Styles.platformStyles({
    common: {justifyContent: 'space-between'},
    isElectron: {
      ...Styles.padding(0, Styles.globalMargins.small),
    },
    isMobile: {
      ...Styles.padding(Styles.globalMargins.small),
    },
  }),
  joinLeaveButton: {
    width: 63,
  },
  searchFilterContainer: Styles.platformStyles({
    isElectron: Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
  }),
}))

export default AddToChannels
