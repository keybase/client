import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import type * as Types from '../../constants/types/teams'
import ChannelPopup from '../team/settings-tab/channel-popup'
import useAutocompleter from './use-autocompleter'
import {useAllChannelMetas} from './channel-hooks'

type Props = {
  channels: Array<Types.ChannelNameID>
  disableGeneral?: boolean
  disabledChannels?: Array<Types.ChannelNameID>
  onAddChannel: (toAdd: Array<Types.ChannelNameID>) => void
  onRemoveChannel: (toRemove: Types.ChannelNameID) => void
  teamID: Types.TeamID
}

// always shows #general
export const ChannelsWidget = (props: Props) => (
  <Kb.Box2 direction="vertical" gap="tiny" style={styles.container} fullWidth={true}>
    <ChannelInput
      onAdd={props.onAddChannel}
      teamID={props.teamID}
      selected={props.channels}
      disableGeneral={props.disableGeneral}
      disabledChannels={props.disabledChannels}
    />
    {!!props.channels.length && (
      <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true} style={styles.pillContainer}>
        {props.channels.map(channel => (
          <ChannelPill
            key={channel.channelname}
            channelname={channel.channelname}
            onRemove={channel.channelname === 'general' ? undefined : () => props.onRemoveChannel(channel)}
          />
        ))}
      </Kb.Box2>
    )}
  </Kb.Box2>
)

type ChannelInputProps = {
  disableGeneral?: boolean
  disabledChannels?: Array<Types.ChannelNameID>
  onAdd: (toAdd: Array<Types.ChannelNameID>) => void
  selected: Array<Types.ChannelNameID>
  teamID: Types.TeamID
}

const ChannelInputDesktop = (props: ChannelInputProps) => {
  const {disableGeneral, disabledChannels, onAdd, selected, teamID} = props
  const [filter, setFilter] = React.useState('')

  const {channelMetas} = useAllChannelMetas(teamID)
  const channelItems = React.useMemo(
    () =>
      [...channelMetas.values()]
        .filter(
          c =>
            !selected.find(channel => channel.conversationIDKey === c.conversationIDKey) &&
            (!disableGeneral || c.channelname !== 'general') &&
            (!disabledChannels || !disabledChannels.some(dc => dc.conversationIDKey === c.conversationIDKey))
        )
        .map(c => ({
          label: `#${c.channelname}`,
          value: {channelname: c.channelname, conversationIDKey: c.conversationIDKey},
        })),
    [channelMetas, disableGeneral, disabledChannels, selected]
  )

  const onSelect = React.useCallback(
    (value: Unpacked<typeof channelItems>['value']) => {
      onAdd([value])
      setFilter('')
    },
    [onAdd, setFilter]
  )

  const {popup, popupAnchor, onKeyDown, setShowingPopup} = useAutocompleter(channelItems, onSelect, filter)

  return (
    <>
      <Kb.SearchFilter
        // @ts-ignore complaining that popupAnchor is missing properties that SearchFilter has
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

const ChannelInputMobile = (props: ChannelInputProps) => {
  const {disableGeneral, disabledChannels, onAdd, selected, teamID} = props
  const [showingPopup, setShowingPopup] = React.useState(false)
  const onComplete = (channels: Array<Types.ChannelNameID>) => {
    setShowingPopup(false)
    onAdd(channels)
  }
  return (
    <Kb.ClickableBox onClick={() => setShowingPopup(true)}>
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
      {showingPopup && (
        <ChannelPopup
          teamID={teamID}
          onCancel={() => setShowingPopup(false)}
          onComplete={onComplete}
          disabledChannels={[...selected, ...(disabledChannels || [])]}
          hideGeneral={disableGeneral}
        />
      )}
    </Kb.ClickableBox>
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
