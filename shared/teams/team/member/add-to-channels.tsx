import * as C from '@/constants'
import * as T from '@/constants/types'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Container from '@/util/container'
import * as Common from '@/teams/common'
import {pluralize} from '@/util/string'
import {useAllChannelMetas} from '@/teams/common/channel-hooks'

type Props = {
  teamID: T.Teams.TeamID
  usernames?: Array<string> // undefined means the user themself
}

const getChannelsForList = (
  channels: Map<T.Chat.ConversationIDKey, T.Chat.ConversationMeta>,
  usernames: string[]
) => {
  const processed = [...channels.values()].reduce(
    ({list, general}: {general: T.Chat.ConversationMeta; list: Array<T.Chat.ConversationMeta>}, c) =>
      c.channelname === 'general' ? {general: c, list} : {general, list: [...list, c]},
    {general: C.Chat.makeConversationMeta(), list: []}
  )
  const {list, general} = processed
  const sortedList = list.sort((a, b) => a.channelname.localeCompare(b.channelname))
  const convIDKeysAvailable = sortedList
    .map(c => c.conversationIDKey)
    .filter(convIDKey => {
      // TODO not reactive
      const participants = C.getConvoState(convIDKey).participants.all
      // At least one person is not in the channel
      return usernames.some(member => !participants.includes(member))
    })
  return {
    channelMetaGeneral: general,
    channelMetasAll: [general, ...sortedList],
    convIDKeysAvailable,
  }
}

const AddToChannels = React.memo(function AddToChannels(props: Props) {
  const teamID = props.teamID
  const myUsername = C.useCurrentUserState(s => s.username)
  const justMe = React.useMemo(() => [myUsername], [myUsername])
  const usernames = props.usernames ?? justMe
  const mode = props.usernames ? 'others' : 'self'
  const nav = Container.useSafeNavigation()

  const {channelMetas, loadingChannels, reloadChannels} = useAllChannelMetas(teamID)
  const {channelMetasAll, channelMetaGeneral, convIDKeysAvailable} = React.useMemo(
    () => getChannelsForList(channelMetas, usernames),
    [channelMetas, usernames]
  )

  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      C.ignorePromise(reloadChannels())
    }, [reloadChannels])
  )

  const [filter, setFilter] = React.useState('')
  const filterLCase = filter.trim().toLowerCase()
  const [filtering, setFiltering] = React.useState(false)
  const channels = filterLCase
    ? channelMetasAll.filter(c => c.channelname.toLowerCase().includes(filterLCase))
    : channelMetasAll

  const items = [
    ...(filtering ? [] : [{type: 'header' as const}]),
    ...channels.map(c => {
      // TODO not reactive
      const p = C.getConvoState(c.conversationIDKey).participants
      return {
        channelMeta: c,
        numMembers: p.name.length || p.all.length || 0,
        type: 'channel' as const,
      }
    }),
  ]

  const [forceLayout, setForceLayout] = React.useState(0)
  const [numItems, setNumItems] = React.useState(0)
  if (numItems !== items.length) {
    setNumItems(items.length)
    setForceLayout(s => s + 1)
  }

  const [selected, setSelected] = React.useState(new Set<T.Chat.ConversationIDKey>())
  const onSelect = (convIDKey: T.Chat.ConversationIDKey) => {
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

  const onCancel = () => nav.safeNavigateUp()
  const onCreate = () => nav.safeNavigateAppend({props: {teamID}, selected: 'chatCreateChannel'})

  const submit = C.useRPC(T.RPCChat.localBulkAddToManyConvsRpcPromise)
  const [waiting, setWaiting] = React.useState(false)
  const onFinish = () => {
    if (!selected.size) {
      onCancel()
      return
    }
    setWaiting(true)
    submit(
      [{conversations: [...selected].map(T.Chat.keyToConversationID), usernames}],
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

  const rowHeight = Kb.Styles.isMobile ? (mode === 'self' ? 56 : 56) : mode === 'self' ? 48 : 48

  const itemHeight = React.useMemo(() => {
    const headerHeight = filtering ? 0 : Kb.Styles.isMobile ? 48 : 40
    const getItemLayout = (index: number, item?: T.Unpacked<typeof items>) => {
      return item && item.type === 'header'
        ? {index, length: headerHeight, offset: 0}
        : {
            index,
            length: rowHeight,
            offset: headerHeight + (index > 0 ? index - 1 : index) * rowHeight,
          }
    }
    return {getItemLayout, type: 'variable'} as const
  }, [rowHeight, filtering])

  const renderItem = (_: unknown, item: T.Unpacked<typeof items>) => {
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
            rowHeight={rowHeight}
            key={item.channelMeta.channelname}
            channelMeta={item.channelMeta}
            selected={
              selected.has(item.channelMeta.conversationIDKey) ||
              item.channelMeta.conversationIDKey === channelMetaGeneral.conversationIDKey
            }
            onSelect={onSelect}
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
        hideBorder: Kb.Styles.isMobile,
        leftButton: Kb.Styles.isMobile ? (
          <Kb.Text type="BodyBigLink" onClick={onCancel}>
            Cancel
          </Kb.Text>
        ) : undefined,
        rightButton:
          Kb.Styles.isMobile && mode === 'others' ? (
            waiting ? (
              <Kb.ProgressIndicator type="Large" />
            ) : (
              <Kb.Text type="BodyBigLink" onClick={onFinish} style={!numSelected && styles.disabled}>
                Add
              </Kb.Text>
            )
          ) : undefined,
        title: <Common.ModalTitle teamID={teamID} title={title} />,
      }}
      footer={
        Kb.Styles.isMobile || mode === 'self'
          ? undefined
          : {
              content: (
                <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true}>
                  <Kb.Button
                    type="Dim"
                    label="Cancel"
                    onClick={onCancel}
                    style={Kb.Styles.globalStyles.flexOne}
                    disabled={waiting}
                  />
                  <Kb.Button
                    label={
                      numSelected ? `Add to ${numSelected} ${pluralize('channel', numSelected)}` : 'Add...'
                    }
                    onClick={onFinish}
                    disabled={!numSelected}
                    style={Kb.Styles.globalStyles.flexOne}
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
      {loadingChannels && !channelMetas.size ? (
        <Kb.Box style={Kb.Styles.globalStyles.flexOne}>
          <Kb.ProgressIndicator type="Large" />
        </Kb.Box>
      ) : (
        <Kb.Box2 direction="vertical" fullWidth={true} style={Kb.Styles.globalStyles.flexOne}>
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
              onFocus={() => {
                setFiltering(true)
                setForceLayout(s => s + 1)
              }}
              onBlur={() => {
                setFiltering(false)
                setForceLayout(s => s + 1)
              }}
            />
          </Kb.Box2>
          <Kb.Box2 direction="vertical" style={Kb.Styles.globalStyles.flexOne} fullWidth={true}>
            <Kb.List2
              items={items}
              renderItem={renderItem}
              itemHeight={itemHeight}
              forceLayout={forceLayout}
            />
          </Kb.Box2>
        </Kb.Box2>
      )}
    </Kb.Modal>
  )
})

const HeaderRow = React.memo(function HeaderRow(p: {
  mode: 'others' | 'self'
  onCreate: () => void
  onSelectAll?: () => void
  onSelectNone?: () => void
}) {
  const {mode, onCreate, onSelectAll, onSelectNone} = p
  return (
    <Kb.Box2
      direction="horizontal"
      alignItems="center"
      fullWidth={true}
      gap="tiny"
      style={Kb.Styles.collapseStyles([styles.item, styles.headerItem])}
    >
      <Kb.BoxGrow2 />
      <Kb.Button
        label="Create channel"
        small={true}
        mode="Secondary"
        onClick={onCreate}
        icon="iconfont-new"
      />
      {mode === 'self' || (!onSelectAll && !onSelectNone) ? (
        <Kb.Box /> // box so that the other item aligns to the left
      ) : (
        <Kb.Text type="BodyPrimaryLink" onClick={onSelectAll || onSelectNone}>
          {onSelectAll ? 'Select all' : 'Clear'}
        </Kb.Text>
      )}
    </Kb.Box2>
  )
})

const SelfChannelActions = React.memo(function SelfChannelActions(p: {
  meta: T.Chat.ConversationMeta
  reloadChannels: () => Promise<void>
  selfMode: boolean
}) {
  const {meta, reloadChannels, selfMode} = p
  const nav = Container.useSafeNavigation()
  const yourOperations = C.useTeamsState(s => C.Teams.getCanPerformByID(s, meta.teamID))
  const isAdmin = yourOperations.deleteChannel
  const canEdit = yourOperations.editChannelDescription
  const inChannel = meta.membershipType === 'active'

  const [waiting, setWaiting] = React.useState(false)
  const stopWaiting = React.useCallback(() => setWaiting(false), [])

  const onEditChannel = React.useCallback(() => {
    nav.safeNavigateAppend({
      props: {
        channelname: meta.channelname,
        conversationIDKey: meta.conversationIDKey,
        description: meta.description,
        teamID: meta.teamID,
      },
      selected: 'teamEditChannel',
    })
  }, [nav, meta])
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onChannelSettings = React.useCallback(() => {
    clearModals()
    navigateAppend({
      props: {conversationIDKey: meta.conversationIDKey, teamID: meta.teamID},
      selected: 'teamChannel',
    })
  }, [meta, clearModals, navigateAppend])
  const onDelete = React.useCallback(() => {
    // TODO: consider not using the confirm modal
    nav.safeNavigateAppend({
      props: {conversationIDKey: meta.conversationIDKey, teamID: meta.teamID},
      selected: 'teamDeleteChannel',
    })
  }, [nav, meta])

  const joinRPC = C.useRPC(T.RPCChat.localJoinConversationByIDLocalRpcPromise)
  const leaveRPC = C.useRPC(T.RPCChat.localLeaveConversationLocalRpcPromise)

  const convID = T.Chat.keyToConversationID(meta.conversationIDKey)
  const onLeave = React.useCallback(() => {
    setWaiting(true)
    leaveRPC(
      [{convID}],
      () => {
        reloadChannels().then(stopWaiting, stopWaiting)
      },
      stopWaiting
    )
  }, [convID, leaveRPC, reloadChannels, stopWaiting])
  const onJoin = React.useCallback(() => {
    setWaiting(true)
    joinRPC(
      [{convID}],
      () => {
        reloadChannels().then(stopWaiting, stopWaiting)
      },
      stopWaiting
    )
  }, [convID, joinRPC, reloadChannels, stopWaiting])

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p
      const menuItems = [
        {icon: 'iconfont-edit' as const, onClick: onEditChannel, title: 'Edit channel'},
        ...(isAdmin
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
    },
    [onEditChannel, onChannelSettings, onDelete, isAdmin]
  )
  const {popupAnchor, showPopup, popup} = Kb.usePopup2(makePopup)
  const [buttonMousedOver, setMouseover] = React.useState(false)
  return (
    <Kb.Box2
      direction="horizontal"
      gap="xtiny"
      fullHeight={true}
      centerChildren={true}
      style={Kb.Styles.collapseStyles([selfMode && !Kb.Styles.isMobile && styles.channelRowSelfMode])}
    >
      {popup}
      {
        <Kb.Button
          disabled={meta.channelname === 'general'}
          disabledStopClick={true}
          type={buttonMousedOver && inChannel ? 'Default' : 'Success'}
          mode={inChannel ? 'Secondary' : 'Primary'}
          label={inChannel ? (buttonMousedOver ? 'Leave' : 'In') : 'Join'}
          icon={inChannel && !buttonMousedOver ? 'iconfont-check' : undefined}
          iconSizeType={inChannel && !buttonMousedOver ? 'Tiny' : undefined}
          onMouseEnter={Kb.Styles.isMobile ? undefined : () => setMouseover(true)}
          onMouseLeave={Kb.Styles.isMobile ? undefined : () => setMouseover(false)}
          onClick={inChannel ? onLeave : onJoin}
          small={true}
          style={styles.joinLeaveButton}
          waiting={waiting}
        />
      }
      {canEdit && (
        <Kb.Button
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
})

type ChannelRowProps = {
  channelMeta: T.Chat.ConversationMeta
  selected: boolean
  onSelect: (conviID: T.Chat.ConversationIDKey) => void
  mode: 'self' | 'others'
  reloadChannels: () => Promise<void>
  usernames: string[]
  rowHeight: number
}
const ChannelRow = React.memo(function ChannelRow(p: ChannelRowProps) {
  const {channelMeta, mode, selected, onSelect: _onSelect, reloadChannels, usernames, rowHeight} = p
  const {conversationIDKey} = channelMeta
  const selfMode = mode === 'self'
  const participants = C.useConvoState(conversationIDKey, s => {
    const {name, all} = s.participants
    return name.length ? name : all
  })
  const activityLevel = C.useTeamsState(
    s => s.activityLevels.channels.get(channelMeta.conversationIDKey) || 'none'
  )
  const allInChannel = usernames.every(member => participants.includes(member))
  const previewConversation = C.useChatState(s => s.dispatch.previewConversation)
  const onPreviewChannel = () =>
    previewConversation({
      conversationIDKey: channelMeta.conversationIDKey,
      reason: 'manageView',
    })

  const onSelect = React.useCallback(() => {
    _onSelect(conversationIDKey)
  }, [_onSelect, conversationIDKey])

  return Kb.Styles.isMobile ? (
    <Kb.ClickableBox onClick={selfMode ? onPreviewChannel : onSelect} style={{height: rowHeight}}>
      <Kb.Box2 direction="horizontal" style={styles.item} alignItems="center" fullWidth={true} gap="tiny">
        <Kb.Text type="Body" lineClamp={1} style={styles.channelText}>
          #{channelMeta.channelname}
        </Kb.Text>
        <Kb.Box2 direction="vertical">
          <Common.Activity level={activityLevel} iconOnly={true} />
        </Kb.Box2>
        <Common.ParticipantMeta numParticipants={participants.length} />
        {selfMode ? (
          <SelfChannelActions selfMode={selfMode} meta={channelMeta} reloadChannels={reloadChannels} />
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
      </Kb.Box2>
    </Kb.ClickableBox>
  ) : (
    <Kb.ListItem2
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
            <Kb.Box2 direction="horizontal" alignSelf="stretch" gap="xxtiny">
              <Common.Activity level={activityLevel} />
            </Kb.Box2>
            <Kb.Box2 direction="horizontal">
              <Common.ParticipantMeta numParticipants={participants.length} />
            </Kb.Box2>
            <SelfChannelActions selfMode={selfMode} meta={channelMeta} reloadChannels={reloadChannels} />
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
      containerStyleOverride={Kb.Styles.collapseStyles([
        styles.channelRowContainer,
        selfMode && styles.channelRowSelfMode,
      ])}
    />
  )
})

const styles = Kb.Styles.styleSheetCreate(() => ({
  channelRowContainer: {marginLeft: 16, marginRight: 8},
  channelRowSelfMode: {},
  channelText: {flexGrow: 1, flexShrink: 1},
  description: Kb.Styles.platformStyles({
    common: {},
    electron: {
      wordBreak: 'break-all',
    },
  }),
  disabled: {opacity: 0.4},
  headerItem: Kb.Styles.platformStyles({
    common: {backgroundColor: Kb.Styles.globalColors.blueGrey},
    isElectron: {height: 40},
    isMobile: {height: 48},
  }),
  item: Kb.Styles.platformStyles({
    common: {justifyContent: 'space-between'},
    isElectron: {...Kb.Styles.padding(0, Kb.Styles.globalMargins.small)},
    isMobile: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
    },
  }),
  joinLeaveButton: {width: 63},
  searchFilterContainer: Kb.Styles.platformStyles({
    isElectron: Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.small),
  }),
}))

export default AddToChannels
