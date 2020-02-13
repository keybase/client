import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Types from '../../constants/types/teams'
import AddSuggestors, {PropsWithSuggestor} from '../../chat/conversation/input-area/suggestors'

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
      <ChannelsSearch
        dataSources={{channels: () => ({data: ['hi'], useSpaces: false})}}
        renderers={{channels: item => <Kb.Text type="Body">{item}</Kb.Text>}}
        suggestorToMarker={{channels: ''}}
        transformers={{channels: () => ({})}}
      />
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

const _ChannelsSearch = (props: PropsWithSuggestor<{}>) => {
  return (
    <Kb.SearchFilter
      placeholderText="Add channels"
      icon="iconfont-search"
      onChange={props.onChangeText}
      onKeyDown={props.onKeyDown}
      onBlur={props.onBlur}
      onFocus={props.onFocus}
      size={Styles.isMobile ? 'full-width' : 'small'}
      ref={props.inputRef}
    />
  )
}
const ChannelsSearch = AddSuggestors(_ChannelsSearch)

const ChannelPill = ({channelname, onRemove}: {channelname: string; onRemove?: () => void}) => (
  <Kb.Box2 direction="horizontal" gap="tiny" alignItems="center" style={styles.pill}>
    <Kb.Text type={Styles.isMobile ? 'Body' : 'BodySemibold'}>#{channelname}</Kb.Text>
    {onRemove && <Kb.Icon type="iconfont-remove" onClick={onRemove} color={Styles.globalColors.black_20} />}
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.padding(Styles.globalMargins.tiny),
    backgroundColor: Styles.globalColors.blueGrey,
    borderRadius: Styles.borderRadius,
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
