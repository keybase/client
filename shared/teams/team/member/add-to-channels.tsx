import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import * as TeamsGen from '../../../actions/teams-gen'
import * as Container from '../../../util/container'
import * as RPCChatGen from '../../../constants/types/rpc-chat-gen'
import * as ChatTypes from '../../../constants/types/chat2'
import {Activity, ModalTitle} from '../../common'
import {pluralize} from '../../../util/string'
import {memoize} from '../../../util/memoize'

type Props = Container.RouteProps<{
  teamID: Types.TeamID
  usernames: Array<string>
  test: React.ReactElement
}>

const getChannelsForList = memoize((channels: Map<string, Types.ChannelInfo>) =>
  [...channels.values()].sort((a, b) =>
    a.channelname === b.channelname
      ? 0
      : a.channelname === 'general'
      ? -1
      : b.channelname === 'general'
      ? 1
      : a.channelname.localeCompare(b.channelname)
  )
)

const AddToChannels = (props: Props) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const teamID = Container.getRouteProps(props, 'teamID', Types.noTeamID)
  const usernames = Container.getRouteProps(props, 'usernames', [])

  React.useEffect(() => {
    dispatch(TeamsGen.createGetChannels({teamID}))
  }, [dispatch, teamID])

  const meta = Container.useSelector(s => Constants.getTeamMeta(s, teamID))
  const channelInfos = Container.useSelector(s => Constants.getTeamChannelInfos(s, teamID))
  const channelInfosFiltered = getChannelsForList(channelInfos)
  const participantMap = Container.useSelector(s => s.chat2.participantMap)
  const [filter, setFilter] = React.useState('')
  const filterLCase = filter.trim().toLowerCase()
  const [filtering, setFiltering] = React.useState(false)
  const channels = filterLCase
    ? channelInfosFiltered.filter(c => c.channelname.toLowerCase().includes(filterLCase))
    : channelInfosFiltered
  const items = [
    ...(filtering ? [] : [{type: 'header' as const}]),
    ...channels.map(c => ({
      channelname: c.channelname,
      conversationIDKey: c.conversationIDKey,
      numMembers: participantMap.get(c.conversationIDKey)?.all?.length ?? 0,
      type: 'channel' as const,
    })),
  ]
  const [selected, setSelected] = React.useState(new Set<ChatTypes.ConversationIDKey>())
  const onSelect = (convIDKey: ChatTypes.ConversationIDKey) => {
    if (selected.has(convIDKey)) {
      selected.delete(convIDKey)
      setSelected(new Set(selected))
    } else {
      selected.add(convIDKey)
      setSelected(new Set(selected))
    }
  }
  const onSelectAll = () =>
    setSelected(new Set([...channelInfosFiltered.values()].map(c => c.conversationIDKey)))
  const onSelectNone = () => setSelected(new Set())

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

  const renderItem = (_, item: Unpacked<typeof items>) => {
    switch (item.type) {
      case 'header': {
        const allSelected = selected.size === channelInfosFiltered.length
        return (
          <HeaderRow
            key="{header}"
            onCreate={onCreate}
            onSelectAll={allSelected ? undefined : onSelectAll}
            onSelectNone={allSelected ? onSelectNone : undefined}
          />
        )
      }
      case 'channel':
        return (
          <ChannelRow
            key={item.channelname}
            channelname={item.channelname}
            numMembers={item.numMembers}
            selected={selected.has(item.conversationIDKey)}
            onSelect={() => onSelect(item.conversationIDKey)}
          />
        )
    }
  }

  return (
    <Kb.Modal
      header={{
        hideBorder: Styles.isMobile,
        leftButton: Styles.isMobile ? (
          <Kb.Text type="BodyBigLink" onClick={onCancel}>
            Cancel
          </Kb.Text>
        ) : (
          undefined
        ),
        rightButton: Styles.isMobile ? (
          <Kb.Text type="BodyBigLink" onClick={onFinish} style={!numSelected && styles.disabled}>
            Add
          </Kb.Text>
        ) : (
          undefined
        ),
        title: (
          <ModalTitle
            teamname={meta.teamname}
            title={`Add${usernames.length === 1 ? ` ${usernames[0]}` : ''} to...`}
          />
        ),
      }}
      footer={
        Styles.isMobile
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
      <Kb.Box2 direction="vertical" fullWidth={true} style={Styles.globalStyles.flexOne}>
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.searchFilterContainer}>
          <Kb.SearchFilter
            placeholderText={`Search ${channelInfosFiltered.length} ${pluralize(
              'channel',
              channelInfosFiltered.length
            )}`}
            icon="iconfont-search"
            onChange={setFilter}
            size="full-width"
            onFocus={() => setFiltering(true)}
            onBlur={() => setFiltering(false)}
          />
        </Kb.Box2>
        <Kb.Box2 direction="vertical" style={styles.listContainer} fullWidth={true}>
          <Kb.List2
            items={items}
            renderItem={renderItem}
            itemHeight={
              Styles.isMobile ? {height: 48, type: 'fixed'} : {sizeType: 'Large', type: 'fixedListItem2Auto'}
            }
          />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Modal>
  )
}

const HeaderRow = ({onCreate, onSelectAll, onSelectNone}) => (
  <Kb.Box2
    direction="horizontal"
    alignItems="center"
    fullWidth={true}
    style={Styles.collapseStyles([styles.item, styles.headerItem])}
  >
    <Kb.Button label="Create channel" small={true} mode="Secondary" onClick={onCreate} />
    <Kb.Text type="BodyPrimaryLink" onClick={onSelectAll || onSelectNone}>
      {onSelectAll ? 'Select all' : 'Clear'}
    </Kb.Text>
  </Kb.Box2>
)

const ChannelRow = ({channelname, numMembers, selected, onSelect}) =>
  Styles.isMobile ? (
    <Kb.ClickableBox onClick={onSelect}>
      <Kb.Box2 direction="horizontal" style={styles.item} alignItems="center" fullWidth={true} gap="medium">
        <Kb.Text type="Body" lineClamp={1} style={Styles.globalStyles.flexOne}>
          #{channelname}
        </Kb.Text>
        <Kb.CheckCircle checked={selected} onCheck={onSelect} disabled={channelname === 'general'} />
      </Kb.Box2>
    </Kb.ClickableBox>
  ) : (
    <Kb.ListItem2
      onMouseDown={evt => {
        // using onMouseDown so we can prevent blurring the search filter
        evt.preventDefault()
        onSelect()
      }}
      type="Large"
      action={
        <Kb.CheckCircle
          checked={selected}
          onCheck={() => {
            /* ListItem onMouseDown triggers this */
          }}
        />
      }
      firstItem={true}
      body={
        <Kb.Box2 direction="vertical" alignItems="stretch">
          <Kb.Text type="BodySemibold" lineClamp={1}>
            #{channelname}
          </Kb.Text>
          <Kb.Box2 direction="horizontal" alignSelf="stretch" gap="xxtiny">
            <Kb.Text type="BodySmall">
              {numMembers} {pluralize('member', numMembers)} •
            </Kb.Text>
            <Activity level="recently" />
          </Kb.Box2>
        </Kb.Box2>
      }
      containerStyleOverride={{marginLeft: 16, marginRight: 8}}
    />
  )

const styles = Styles.styleSheetCreate(() => ({
  disabled: {opacity: 0.4},
  headerItem: {backgroundColor: Styles.globalColors.blueGrey},
  item: Styles.platformStyles({
    common: {justifyContent: 'space-between', ...Styles.padding(0, Styles.globalMargins.small)},
    isElectron: {height: 56},
    isMobile: {height: 48},
  }),
  listContainer: Styles.platformStyles({
    isElectron: {
      height: 370, // shortcut to expand the modal
    },
    isMobile: Styles.globalStyles.flexOne,
  }),
  searchFilterContainer: Styles.platformStyles({
    isElectron: Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
  }),
}))

export default AddToChannels
