import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import * as Container from '../../../util/container'
import {Activity, ModalTitle} from '../../common'
import {pluralize} from '../../../util/string'

type Props = {
  teamID: Types.TeamID
  username: string
}

const AddToChannels = ({teamID, username}: Props) => {
  const meta = Container.useSelector(s => Constants.getTeamMeta(s, teamID))
  const channelInfos = Container.useSelector(s => Constants.getTeamChannelInfos(s, teamID))
  const [filter, setFilter] = React.useState('')
  const filterLCase = filter.trim().toLowerCase()
  const [filtering, setFiltering] = React.useState(false)
  const channels = filterLCase
    ? [...channelInfos.values()].filter(c => c.channelname.toLowerCase().includes(filterLCase))
    : [...channelInfos.values()]
  const items = [
    ...(filtering ? [] : [{type: 'header' as const}]),
    ...channels.map(c => ({
      channelname: c.channelname,
      numMembers: c.numParticipants,
      type: 'channel' as const,
    })),
  ]
  const [selected, setSelected] = React.useState(new Set<string>())
  const onSelect = (channelname: string) => {
    if (selected.has(channelname)) {
      selected.delete(channelname)
      setSelected(new Set(selected))
    } else {
      selected.add(channelname)
      setSelected(new Set(selected))
    }
  }
  const onSelectAll = () => setSelected(new Set([...channelInfos.values()].map(c => c.channelname)))
  const onSelectNone = () => setSelected(new Set())

  const renderItem = (_, item: Unpacked<typeof items>) => {
    switch (item.type) {
      case 'header': {
        const allSelected = selected.size === channelInfos.size
        return (
          <HeaderRow
            key="{header}"
            onCreate={() => {}}
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
            selected={selected.has(item.channelname)}
            onSelect={() => onSelect(item.channelname)}
          />
        )
    }
  }

  return (
    <Kb.Modal
      header={{
        hideBorder: Styles.isMobile,
        leftButton: Styles.isMobile ? <Kb.Text type="BodyBigLink">Cancel</Kb.Text> : undefined,
        title: <ModalTitle teamname={meta.teamname} title={`Add ${username} to...`} />,
      }}
      allowOverflow={true}
      noScrollView={true}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} style={Styles.globalStyles.flexOne}>
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.searchFilterContainer}>
          <Kb.SearchFilter
            placeholderText={`Search ${channelInfos.size} ${pluralize('channel', channelInfos.size)}`}
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
      {onSelectAll ? 'Select all' : 'Select none'}
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
        <Kb.CheckCircle checked={selected} onCheck={onSelect} />
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
            <Activity level="extinct" />
          </Kb.Box2>
        </Kb.Box2>
      }
      containerStyleOverride={{marginLeft: 16, marginRight: 8}}
    />
  )

const styles = Styles.styleSheetCreate(() => ({
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
