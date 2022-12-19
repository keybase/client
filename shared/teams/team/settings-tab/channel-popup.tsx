import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import type * as Types from '../../../constants/types/teams'
import {pluralize} from '../../../util/string'
import {useAllChannelMetas} from '../../common/channel-hooks'

type Props = {
  disabledChannels?: Array<Types.ChannelNameID>
  hideGeneral?: boolean
  onCancel: () => void
  onComplete: (channels: Array<Types.ChannelNameID>) => void
  teamID: Types.TeamID
}

const ChannelPopup = (props: Props) => {
  const {disabledChannels, onCancel, onComplete, teamID} = props
  const [filter, setFilter] = React.useState('')
  const filterLCase = filter.toLowerCase()
  const onChangeFilter = (value: string) => setFilter(value)

  const {channelMetas} = useAllChannelMetas(teamID)
  const channels = [...channelMetas.values()].map(ci => ({
    channelname: ci.channelname,
    conversationIDKey: ci.conversationIDKey,
  }))
  const channelsFiltered =
    filter || props.hideGeneral
      ? channels.filter(
          c =>
            c.channelname.toLowerCase().includes(filterLCase) &&
            (!props.hideGeneral || c.channelname !== 'general')
        )
      : channels

  const [selected, setSelected] = React.useState<Array<Types.ChannelNameID>>([])
  const onSelect = (channel: Types.ChannelNameID) => {
    const idx = selected.findIndex(c => c.conversationIDKey === channel.conversationIDKey)
    if (idx >= 0) {
      selected.splice(idx, 1)
    } else {
      selected.push(channel)
    }
    setSelected([...selected])
  }

  const onAdd = () => onComplete(selected)
  return (
    <Kb.MobilePopup overlayStyle={Styles.globalStyles.fullHeight}>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.header} gap="tiny">
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.headerTop}>
          <Kb.Text type="BodyBigLink" onClick={onCancel}>
            Cancel
          </Kb.Text>
          <Kb.Text
            type="BodyBigLink"
            onClick={selected.length ? onAdd : undefined}
            style={!selected.length && styles.addDisabled}
          >
            Add{!!selected.length && ` (${selected.length})`}
          </Kb.Text>
        </Kb.Box2>
        <Kb.SearchFilter
          placeholderText={`Search ${channelsFiltered.length} ${pluralize(
            'channel',
            channelsFiltered.length
          )}`}
          size="full-width"
          onChange={onChangeFilter}
          style={styles.searchFilter}
          placeholderCentered={true}
          icon="iconfont-search"
        />
      </Kb.Box2>
      <Kb.BoxGrow>
        <Kb.List2
          itemHeight={{height: 48, type: 'fixed'}}
          items={channelsFiltered}
          keyProperty="conversationIDKey"
          renderItem={(_, channel) => {
            const disabled = disabledChannels?.some(c => c.conversationIDKey === channel.conversationIDKey)
            const onClick = disabled ? undefined : () => onSelect(channel)
            return (
              <Kb.ClickableBox key={channel.conversationIDKey} onClick={onClick}>
                <Kb.Box2 direction="horizontal" style={styles.channelContainer} gap="tiny" fullWidth={true}>
                  <Kb.Text type="Body" lineClamp={1} style={Styles.globalStyles.flexOne}>
                    #{channel.channelname}
                  </Kb.Text>
                  <Kb.CheckCircle
                    onCheck={onClick}
                    checked={
                      disabled || selected.some(c => c.conversationIDKey === channel.conversationIDKey)
                    }
                    disabled={disabled}
                  />
                </Kb.Box2>
              </Kb.ClickableBox>
            )
          }}
        />
      </Kb.BoxGrow>
    </Kb.MobilePopup>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  addDisabled: {opacity: 0.4},
  channelContainer: {
    ...Styles.padding(14, Styles.globalMargins.medium, 14, Styles.globalMargins.small),
    height: 48,
    justifyContent: 'space-between',
  },
  header: {
    ...Styles.padding(19, Styles.globalMargins.small, 0),
  },
  headerTop: {justifyContent: 'space-between'},
  searchFilter: {paddingLeft: 0, paddingRight: 0},
}))

export default ChannelPopup
