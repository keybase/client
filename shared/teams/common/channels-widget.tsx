import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/teams'
import * as ChatTypes from '../../constants/types/chat2'
import ChannelPopup from '../team/settings-tab/channel-popup'
import useAutocompleter from './use-autocompleter'
import {useAllChannelMetas} from './channel-hooks'

type ChannelNameID = {
  channelname: string
  conversationIDKey: ChatTypes.ConversationIDKey
}

type Props = {
  channels: Array<ChannelNameID>
  onAddChannel: (toAdd: Array<ChannelNameID>) => void
  onRemoveChannel: (toRemove: ChannelNameID) => void
  teamID: Types.TeamID
}

// always shows #general
const ChannelsWidget = (props: Props) => {
  return (
    <Kb.Box2 direction="vertical" gap="tiny" style={styles.container} fullWidth={true}>
      <ChannelInput onAdd={props.onAddChannel} teamID={props.teamID} selected={props.channels} />
      <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true} style={styles.pillContainer}>
        {props.channels.map(channel => (
          <ChannelPill
            key={channel.channelname}
            channelname={channel.channelname}
            onRemove={channel.channelname === 'general' ? undefined : () => props.onRemoveChannel(channel)}
          />
        ))}
      </Kb.Box2>
    </Kb.Box2>
  )
}

type ChannelInputProps = {
  onAdd: (toAdd: Array<ChannelNameID>) => void
  selected: Array<ChannelNameID>
  teamID: Types.TeamID
}

const ChannelInputDesktop = ({onAdd, selected, teamID}: ChannelInputProps) => {
  const [filter, setFilter] = React.useState('')
  const channels = useAllChannelMetas(teamID)
  const channelnames = [...channels.values()]
    .filter(c => !selected.find(channel => channel.conversationIDKey === c.conversationIDKey))
    .map(c => `#${c.channelname}`)

  const onSelect = value => {
    onAdd(value)
    setFilter('')
  }

  const {popup, popupAnchor, onKeyDown, setShowingPopup} = useAutocompleter<Kb.SearchFilter>(
    channelnames,
    onSelect,
    filter
  )

  return (
    <>
      <Kb.SearchFilter
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

const ChannelInputMobile = ({onAdd, selected, teamID}: ChannelInputProps) => {
  const [showingPopup, setShowingPopup] = React.useState(false)
  const onComplete = (channelnames: Array<string>) => {
    setShowingPopup(false)
    channelnames.forEach(c => onAdd(c))
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
          disabledChannels={selected}
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

export default ChannelsWidget
