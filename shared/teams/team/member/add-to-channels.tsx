import * as C from '@/constants'
import * as Chat from '@/constants/chat'
import * as T from '@/constants/types'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Common from '@/teams/common'
import {pluralize} from '@/util/string'
import {useAllChannelMetas} from '@/teams/common/channel-hooks'
import {useInboxMetadataState} from '@/chat/inbox/metadata'
import {useSafeNavigation} from '@/util/safe-navigation'
import {useCurrentUserState} from '@/stores/current-user'
import {LoadedTeamProvider, useLoadedTeam} from '../use-loaded-team'
import ChannelRow, {itemStyle} from './add-to-channels-row'

type Props = {
  teamID: T.Teams.TeamID
  usernames?: Array<string> // undefined means the user themself
}

type ChannelItem = {
  channelMeta: T.Chat.ConversationMeta
  numMembers: number
  participants: Array<string>
  type: 'channel'
}
// items are rebuilt per filter keystroke; reuse identities (keyed on the
// stable meta) so the memoized rows can bail
const channelItemCache = new WeakMap<T.Chat.ConversationMeta, ChannelItem>()
const canonChannelItem = (channelMeta: T.Chat.ConversationMeta, participants: Array<string>) => {
  const old = channelItemCache.get(channelMeta)
  if (old) {
    if (
      old.participants.length === participants.length &&
      old.participants.every((u, i) => u === participants[i])
    ) {
      return old
    }
  }
  const next: ChannelItem = {channelMeta, numMembers: participants.length, participants, type: 'channel'}
  channelItemCache.set(channelMeta, next)
  return next
}

const getChannelsForList = (
  channels: Map<T.Chat.ConversationIDKey, T.Chat.ConversationMeta>,
  channelParticipants: Map<T.Chat.ConversationIDKey, T.Chat.ParticipantInfo>,
  // Team channel participants arrive asynchronously via the ChatParticipantsInfo
  // notification (stored here), not in the getTLFConversations RPC result.
  inboxParticipants: T.Immutable<Map<T.Chat.ConversationIDKey, T.Chat.ParticipantInfo>>,
  usernames: string[]
) => {
  const processed = [...channels.values()].reduce(
    ({list, general}: {general: T.Chat.ConversationMeta; list: Array<T.Chat.ConversationMeta>}, c) =>
      c.channelname === 'general' ? {general: c, list} : {general, list: [...list, c]},
    {general: Chat.makeConversationMeta(), list: []}
  )
  const {list, general} = processed
  const sortedList = list.sort((a, b) => a.channelname.localeCompare(b.channelname))
  const convIDKeysAvailable = sortedList
    .map(c => c.conversationIDKey)
    .filter(convIDKey => {
      const participants =
        inboxParticipants.get(convIDKey)?.all ?? channelParticipants.get(convIDKey)?.all ?? []
      // At least one person is not in the channel
      return usernames.some(member => !participants.includes(member))
    })
  return {
    channelMetaGeneral: general,
    channelMetasAll: [general, ...sortedList],
    convIDKeysAvailable,
  }
}

const AddToChannelsBody = function AddToChannelsBody(props: Props) {
  const teamID = props.teamID
  const myUsername = useCurrentUserState(s => s.username)
  const usernames = React.useMemo(() => props.usernames ?? [myUsername], [props.usernames, myUsername])
  const mode = props.usernames ? 'others' : 'self'
  const nav = useSafeNavigation()
  const {yourOperations, teamDetails} = useLoadedTeam(teamID)

  const {channelMetas, channelParticipants, loadingChannels, reloadChannels} = useAllChannelMetas(teamID)
  const inboxParticipants = useInboxMetadataState(s => s.participants)
  const {channelMetasAll, channelMetaGeneral, convIDKeysAvailable} = getChannelsForList(
    channelMetas,
    channelParticipants,
    inboxParticipants,
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
    ...channels.map(c => {
      const p = inboxParticipants.get(c.conversationIDKey) ?? channelParticipants.get(c.conversationIDKey)
      const allParticipants = p?.name.length ? p.name : (p?.all ?? [])
      const participants = allParticipants.filter(u => {
        const m = teamDetails.members.get(u)
        return !m || (m.type !== 'bot' && m.type !== 'restrictedbot')
      })
      return canonChannelItem(c, participants)
    }),
  ]

  const [numItems, setNumItems] = React.useState(0)
  if (numItems !== items.length) {
    setNumItems(items.length)
  }

  const [selected, setSelected] = React.useState(new Set<T.Chat.ConversationIDKey>())
  const onSelect = React.useEffectEvent((convIDKey: T.Chat.ConversationIDKey) => {
    if (convIDKey === channelMetaGeneral.conversationIDKey) return
    if (selected.has(convIDKey)) {
      selected.delete(convIDKey)
      setSelected(new Set(selected))
    } else {
      selected.add(convIDKey)
      setSelected(new Set(selected))
    }
  })
  const onSelectAll = () => setSelected(new Set(convIDKeysAvailable))
  const onSelectNone = convIDKeysAvailable.length === 0 ? undefined : () => setSelected(new Set())
  const onCancel = () => nav.safeNavigateUp()

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

  const rowHeight = isMobile ? 56 : 48

  const headerHeight = filtering ? 0 : isMobile ? 48 : 40
  const itemHeight = {
    getItemLayout: (index: number, item?: T.Unpacked<typeof items>) =>
      item?.type === 'header'
        ? {index, length: headerHeight, offset: 0}
        : {
            index,
            length: rowHeight,
            offset: headerHeight + (index > 0 ? index - 1 : index) * rowHeight,
          },
    type: 'variable' as const,
  }

  const renderItem = (_: unknown, item: T.Unpacked<typeof items>) => {
    switch (item.type) {
      case 'header': {
        const allSelected = selected.size === convIDKeysAvailable.length
        return (
          <HeaderRow
            key="{header}"
            canCreateChannel={yourOperations.createChannel}
            mode={mode}
            teamID={teamID}
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
            participants={item.participants}
            canDeleteChannel={yourOperations.deleteChannel}
            canEditChannelDescription={yourOperations.editChannelDescription}
          />
        )
    }
  }

  // TODO: alternate title when there aren't channels yet?
  const title =
    mode === 'self' ? 'Browse all channels' : `Add${usernames.length === 1 ? ` ${usernames[0]}` : ''} to...`
  const desktopFooter =
    !isMobile && mode !== 'self' ? (
      <Kb.ModalFooter>
        <Kb.ConfirmButtons
          split={true}
          waiting={waiting}
          onCancel={onCancel}
          onConfirm={onFinish}
          confirmLabel={numSelected ? `Add to ${numSelected} ${pluralize('channel', numSelected)}` : 'Add...'}
          confirmDisabled={!numSelected}
        />
      </Kb.ModalFooter>
    ) : null

  Kb.useModalHeaderAction({
    enabled: numSelected > 0,
    label: 'Add',
    onAction: mode === 'others' ? onFinish : undefined,
    title,
    waiting,
  })

  return (
    <Common.ActivityLevelsProvider>
      {loadingChannels && !channelMetas.size ? (
        <Kb.Box2 direction="vertical" style={Kb.Styles.globalStyles.flexOne} centerChildren={true}>
          <Kb.ProgressIndicator type="Large" />
        </Kb.Box2>
      ) : (
        <Kb.Box2 direction="vertical" fullWidth={true} flex={1}>
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
              }}
              onBlur={() => {
                setFiltering(false)
              }}
            />
          </Kb.Box2>
          <Kb.BoxGrow2>
            <Kb.List items={items} renderItem={renderItem} itemHeight={itemHeight} />
          </Kb.BoxGrow2>
        </Kb.Box2>
      )}
      {desktopFooter}
    </Common.ActivityLevelsProvider>
  )
}

const HeaderRow = function HeaderRow(p: {
  canCreateChannel: boolean
  teamID: T.Teams.TeamID
  mode: 'others' | 'self'
  onSelectAll?: () => void
  onSelectNone?: () => void
}) {
  const {canCreateChannel, mode, teamID, onSelectAll, onSelectNone} = p
  const nav = useSafeNavigation()
  const onCreate = () => nav.safeNavigateAppend({name: 'chatCreateChannel', params: {teamID}})

  return (
    <Kb.Box2
      direction="horizontal"
      alignItems="center"
      fullWidth={true}
      gap="tiny"
      style={Kb.Styles.collapseStyles([itemStyle, styles.headerItem])}
    >
      <Kb.BoxGrow2 />
      <Kb.Button
        disabled={!canCreateChannel}
        label="Create channel"
        small={true}
        mode="Secondary"
        onClick={onCreate}
      >
        <Kb.Icon type="iconfont-new" sizeType="Small" color={Kb.Styles.globalColors.blueDark} />
      </Kb.Button>
      {mode === 'self' || (!onSelectAll && !onSelectNone) ? (
        <Kb.Box2 direction="vertical" /> // box so that the other item aligns to the left
      ) : (
        <Kb.Text type="BodyPrimaryLink" onClick={onSelectAll || onSelectNone}>
          {onSelectAll ? 'Select all' : 'Clear'}
        </Kb.Text>
      )}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  headerItem: Kb.Styles.platformStyles({
    common: {backgroundColor: Kb.Styles.globalColors.blueGrey},
    isElectron: {height: 40},
    isMobile: {height: 48},
  }),
  searchFilterContainer: Kb.Styles.platformStyles({
    isElectron: Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.small),
  }),
}))

const AddToChannels = (props: Props) => (
  <LoadedTeamProvider teamID={props.teamID}>
    <AddToChannelsBody {...props} />
  </LoadedTeamProvider>
)

export default AddToChannels
