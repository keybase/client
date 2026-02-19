import * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import ChannelPopup from '../team/settings-tab/channel-popup'
import useAutocompleter from './use-autocompleter'
import {useAllChannelMetas} from './channel-hooks'

type Props = {
  channels: ReadonlyArray<T.Teams.ChannelNameID>
  disableGeneral?: boolean
  disabledChannels?: ReadonlyArray<T.Teams.ChannelNameID>
  onAddChannel: (toAdd: ReadonlyArray<T.Teams.ChannelNameID>) => void
  onRemoveChannel: (toRemove: T.Teams.ChannelNameID) => void
  teamID: T.Teams.TeamID
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
  disabledChannels?: ReadonlyArray<T.Teams.ChannelNameID>
  onAdd: (toAdd: ReadonlyArray<T.Teams.ChannelNameID>) => void
  selected: ReadonlyArray<T.Teams.ChannelNameID>
  teamID: T.Teams.TeamID
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
            !disabledChannels?.some(dc => dc.conversationIDKey === c.conversationIDKey)
        )
        .map(c => ({
          label: `#${c.channelname}`,
          value: {channelname: c.channelname, conversationIDKey: c.conversationIDKey},
        })),
    [channelMetas, disableGeneral, disabledChannels, selected]
  )

  const onSelect = React.useCallback(
    (value: T.Unpacked<typeof channelItems>['value']) => {
      onAdd([value])
      setFilter('')
    },
    [onAdd, setFilter]
  )

  const {popup, popupAnchor, onKeyDown, showPopup, hidePopup} = useAutocompleter(
    channelItems,
    onSelect,
    filter
  )

  return (
    <>
      <Kb.SearchFilter
        measureRef={popupAnchor}
        onFocus={showPopup}
        onBlur={hidePopup}
        placeholderText="Add channels"
        icon="iconfont-search"
        onChange={setFilter}
        size={Kb.Styles.isMobile ? 'full-width' : 'small'}
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
  const onComplete = (channels: Array<T.Teams.ChannelNameID>) => {
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
        <Kb.Icon type="iconfont-search" color={Kb.Styles.globalColors.black_50} sizeType="Small" />
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

const ChannelInput = Kb.Styles.isMobile ? ChannelInputMobile : ChannelInputDesktop

const ChannelPill = ({channelname, onRemove}: {channelname: string; onRemove?: () => void}) => (
  <Kb.Box2 direction="horizontal" gap="tiny" alignItems="center" style={styles.pill}>
    <Kb.Text type={Kb.Styles.isMobile ? 'Body' : 'BodySemibold'}>#{channelname}</Kb.Text>
    {onRemove && (
      <Kb.Icon type="iconfont-remove" onClick={onRemove} color={Kb.Styles.globalColors.black_20} />
    )}
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(() => ({
  channelDummyInput: {
    backgroundColor: Kb.Styles.globalColors.black_10,
    borderRadius: Kb.Styles.borderRadius,
    paddingBottom: Kb.Styles.globalMargins.xtiny,
    paddingTop: Kb.Styles.globalMargins.xtiny,
  },
  channelDummyInputText: {color: Kb.Styles.globalColors.black_50},
  container: {
    ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny),
    backgroundColor: Kb.Styles.globalColors.blueGrey,
    borderRadius: Kb.Styles.borderRadius,
  },
  pill: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.xtiny, Kb.Styles.globalMargins.tiny),
      backgroundColor: Kb.Styles.globalColors.white,
      borderRadius: Kb.Styles.borderRadius,
      marginBottom: Kb.Styles.globalMargins.xtiny,
    },
    isMobile: {
      borderColor: Kb.Styles.globalColors.black_20,
      borderStyle: 'solid',
      borderWidth: 1,
    },
  }),
  pillContainer: {
    flexWrap: 'wrap',
  },
}))
