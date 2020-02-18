import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'

type Props = {
  channels: Array<string>
  onAddChannel: (channelname: string) => void
  onRemoveChannel: (channelname: string) => void
  teamID: Types.TeamID
}

// always shows #general
const ChannelsWidget = (props: Props) => {
  return (
    <Kb.Box2 direction="vertical" gap="tiny" style={styles.container}>
      <ChannelInput teamID={props.teamID} />
      <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true} style={styles.pillContainer}>
        <ChannelPill channelname="general" />
        {props.channels.map(channelname => (
          <ChannelPill
            key={channelname}
            channelname={channelname}
            onRemove={() => props.onRemoveChannel(channelname)}
          />
        ))}
      </Kb.Box2>
    </Kb.Box2>
  )
}

type ChannelInputProps = {teamID: Types.TeamID}

const ChannelInputDesktop = ({teamID}: ChannelInputProps) => {
  const [filter, setFilter] = React.useState('')
  const channels = Container.useSelector(s => Constants.getTeamChannelInfos(s, teamID))
  const channelnames = [...channels.values()].map(c => `#${c.channelname}`)

  const {popup, popupAnchor, onKeyDown, setShowingPopup} = useAutocompleter(
    channelnames,
    () => setFilter(''),
    filter
  )

  return (
    <>
      <Kb.SearchFilter
        // @ts-ignore TODO
        ref={popupAnchor}
        onFocus={() => setShowingPopup(true)}
        onBlur={() => setShowingPopup(false)}
        placeholderText="Add channels"
        icon="iconfont-search"
        onChange={setFilter}
        size={Styles.isMobile ? 'full-width' : 'small'}
        onKeyDown={onKeyDown}
        value={filter}
        valueControlled={true}
      />
      {popup}
    </>
  )
}

const useAutocompleter = (items: Array<string>, onSelect: (value: string) => void, filter: string) => {
  const [selected, setSelected] = React.useState(0)
  const filterLCase = filter.trim().toLowerCase()
  const prevFilterLCase = Container.usePrevious(filterLCase)
  React.useEffect(() => {
    if (prevFilterLCase !== filterLCase) {
      setSelected(0)
    }
  }, [setSelected, prevFilterLCase, filterLCase])
  let itemsFiltered = filter ? items.filter(item => item.toLowerCase().includes(filterLCase)) : items
  itemsFiltered = itemsFiltered.slice(0, 5)

  const {popup, popupAnchor, setShowingPopup, showingPopup} = Kb.usePopup(
    getAttachmentRef => (
      <Kb.Overlay
        attachTo={getAttachmentRef}
        visible={showingPopup}
        onHidden={() => setShowingPopup(false)}
        matchDimension={true}
        position="top center"
        positionFallbacks={['bottom center']}
      >
        {itemsFiltered.map((item, idx) => (
          <Kb.Box2
            key={item}
            direction="horizontal"
            fullWidth={true}
            style={Styles.collapseStyles([styles.channelOption, selected === idx && styles.optionSelected])}
          >
            <Kb.Text type="BodySemibold" lineClamp={1}>
              {item}
            </Kb.Text>
          </Kb.Box2>
        ))}
      </Kb.Overlay>
    ),
    filterLCase + selected
  )

  const numItems = itemsFiltered.length
  const selectedItem = itemsFiltered[selected]
  const onKeyDown = React.useCallback(
    evt => {
      let diff = 0
      switch (evt.key) {
        case 'ArrowDown':
          diff = 1
          break
        case 'ArrowUp':
          diff = -1
          break
        case 'Enter':
          onSelect(selectedItem)
          break
      }
      let newSelected = selected + diff
      if (newSelected >= numItems) {
        newSelected = 0
      } else if (newSelected < 0) {
        newSelected = numItems - 1
      }
      if (newSelected !== selected) {
        setSelected(newSelected)
      }
    },
    [selected, setSelected, numItems, onSelect, selectedItem]
  )

  return {onKeyDown, popup, popupAnchor, setShowingPopup}
}

const ChannelInputMobile = ({teamID}: ChannelInputProps) => {
  return (
    <Kb.Box2
      direction="horizontal"
      gap="tiny"
      alignSelf="stretch"
      centerChildren={true}
      style={styles.channelDummyInput}
    >
      <Kb.Icon type="iconfont-search" color={Styles.globalColors.black_50} sizeType="Small" />
      <Kb.Text type="BodySemibold" style={styles.channelDummyInputText}>
        Add channels
      </Kb.Text>
    </Kb.Box2>
  )
}

const ChannelInput = Styles.isMobile ? ChannelInputMobile : ChannelInputDesktop

const ChannelPill = ({channelname, onRemove}: {channelname: string; onRemove?: () => void}) => (
  <Kb.Box2 direction="horizontal" gap="tiny" alignItems="center" style={styles.pill}>
    <Kb.Text type={Styles.isMobile ? 'Body' : 'BodySemibold'}>#{channelname}</Kb.Text>
    {onRemove && <Kb.Icon type="iconfont-remove" onClick={onRemove} color={Styles.globalColors.black_20} />}
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(() => ({
  channelDummyInput: {
    backgroundColor: Styles.globalColors.black_10,
    borderRadius: Styles.borderRadius,
    paddingBottom: Styles.globalMargins.xtiny,
    paddingTop: Styles.globalMargins.xtiny,
  },
  channelDummyInputText: {color: Styles.globalColors.black_50},
  channelOption: {...Styles.padding(4, 10, 2), backgroundColor: Styles.globalColors.white},
  container: {
    ...Styles.padding(Styles.globalMargins.tiny),
    backgroundColor: Styles.globalColors.blueGrey,
    borderRadius: Styles.borderRadius,
  },
  optionSelected: {
    backgroundColor: Styles.globalColors.blueLighter2,
  },
  pill: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.xtiny, Styles.globalMargins.tiny),
      backgroundColor: Styles.globalColors.white,
      borderRadius: Styles.borderRadius,
      marginBottom: Styles.globalMargins.xtiny,
    },
    isMobile: {
      borderColor: Styles.globalColors.black_20,
      borderStyle: 'solid',
      borderWidth: 1,
    },
  }),
  pillContainer: {
    flexWrap: 'wrap',
  },
}))

export default ChannelsWidget
