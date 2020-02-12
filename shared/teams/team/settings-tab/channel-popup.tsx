import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import * as Container from '../../../util/container'
import {pluralize} from '../../../util/string'

type Props = {
  disabledChannels?: Array<string>
  onCancel: () => void
  onComplete: (channels: Array<string>) => void
  teamID: Types.TeamID
}

const ChannelPopup = (props: Props) => {
  const {disabledChannels, onCancel, onComplete, teamID} = props
  const [filter, setFilter] = React.useState('')
  const filterLCase = filter.toLowerCase()
  const onChangeFilter = (value: string) => setFilter(value)

  const channelInfos = Container.useSelector(s => Constants.getTeamChannelInfos(s, teamID))
  const channels = [...channelInfos.values()].map(ci => ci.channelname)
  const channelsFiltered = filter ? channels.filter(c => c.toLowerCase().includes(filterLCase)) : channels

  const [selected, setSelected] = React.useState(new Set<string>())
  const onSelect = (channelname: string) => {
    if (selected.has(channelname)) {
      selected.delete(channelname)
    } else {
      selected.add(channelname)
    }
    setSelected(new Set(selected))
  }

  const onAdd = () => onComplete([...selected])
  return (
    <Kb.FloatingBox dest="keyboard-avoiding-root">
      <Kb.Box2 direction="vertical" centerChildren={true} style={styles.underlay}>
        <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.overlay}>
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.header} gap="tiny">
            <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.headerTop}>
              <Kb.Text type="BodyBigLink" onClick={onCancel}>
                Cancel
              </Kb.Text>
              <Kb.Text
                type="BodyBigLink"
                onClick={selected.size ? onAdd : undefined}
                style={!selected.size && styles.addDisabled}
              >
                Add{!!selected.size && ` (${selected.size})`}
              </Kb.Text>
            </Kb.Box2>
            <Kb.SearchFilter
              placeholderText={`Search ${channels.length} ${pluralize('channel', channels.length)}`}
              size="full-width"
              onChange={onChangeFilter}
              style={styles.searchFilter}
              placeholderCentered={true}
              icon="iconfont-search"
            />
          </Kb.Box2>
          <Kb.BoxGrow>
            <Kb.ScrollView>
              {channelsFiltered.map(channelname => {
                const disabled = disabledChannels?.includes(channelname)
                const onClick = disabled ? undefined : () => onSelect(channelname)
                return (
                  <Kb.ClickableBox key={channelname} onClick={onClick}>
                    <Kb.Box2
                      direction="horizontal"
                      style={styles.channelContainer}
                      gap="tiny"
                      fullWidth={true}
                    >
                      <Kb.Text type="Body" lineClamp={1} style={Styles.globalStyles.flexOne}>
                        #{channelname}
                      </Kb.Text>
                      <Kb.CheckCircle
                        onCheck={onClick}
                        checked={disabled || selected.has(channelname)}
                        disabled={disabledChannels?.includes(channelname)}
                      />
                    </Kb.Box2>
                  </Kb.ClickableBox>
                )
              })}
            </Kb.ScrollView>
          </Kb.BoxGrow>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.FloatingBox>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  addDisabled: {opacity: 0.4},
  channelContainer: {
    ...Styles.padding(14, Styles.globalMargins.medium, 14, Styles.globalMargins.small),
    justifyContent: 'space-between',
  },
  header: {
    ...Styles.padding(19, Styles.globalMargins.small, 0),
  },
  headerTop: {justifyContent: 'space-between'},
  overlay: {
    backgroundColor: Styles.globalColors.white,
    borderRadius: Styles.borderRadius,
    maxHeight: 450,
  },
  searchFilter: {paddingLeft: 0, paddingRight: 0},
  underlay: {
    ...Styles.globalStyles.fillAbsolute,
    ...Styles.padding(27, Styles.globalMargins.small, Styles.globalMargins.small),
    backgroundColor: Styles.globalColors.black_50,
  },
}))

export default ChannelPopup
