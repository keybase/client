// @flow
import React from 'react'
import {
  compose,
  withState,
  lifecycle,
  withPropsOnChange,
  type TypedState,
  connect,
  setDisplayName,
  type MapStateToProps,
} from '../../util/container'
import {Box, ClickableBox, List, Text} from '../../common-adapters/index'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../styles'

type Props<D: {channelName: string, selected: boolean}> = {
  rowRenderer: (i: number, d: D) => React$Element<*>,
  data: Array<D>,
  style: Object,
  selectedIndex: number,
}

type MentionDatum = {
  channelName: string,
  selected: boolean,
  onClick: () => void,
  onHover: () => void,
}

const MentionRowRenderer = ({channelName, selected, onClick, onHover}: MentionDatum) => (
  <ClickableBox
    style={{
      ...globalStyles.flexBoxRow,
      height: 40,
      alignItems: 'center',
      paddingLeft: globalMargins.tiny,
      paddingRight: globalMargins.tiny,
      backgroundColor: selected && !isMobile ? globalColors.blue4 : undefined,
    }}
    onClick={onClick}
    onMouseOver={onHover}
  >
    <Text type="BodySemibold" style={{marginLeft: globalMargins.tiny}}>
      #{channelName}
    </Text>
  </ClickableBox>
)

// We want to render Hud even if there's no data so we can still have lifecycle methods so we can still do things
// This is important if you type a filter that gives you no results and you press enter for instance
const Hud = ({style, data, rowRenderer, selectedIndex}: Props<*>) =>
  data.length ? (
    <Box style={{...hudStyle, ...style}}>
      <List
        items={data}
        renderItem={rowRenderer}
        selectedIndex={selectedIndex}
        fixedHeight={40}
        keyboardShouldPersistTaps="always"
      />
    </Box>
  ) : null

const hudStyle = {
  ...globalStyles.flexBoxRow,
  backgroundColor: globalColors.white,
}

type MentionHudProps = {
  channels: Array<{channelName: string}>,
  onPickChannel: (user: string) => void,
  onSelectChannel: (user: string) => void,
  pickSelectedChannelCounter: number,
  selectUpCounter: number,
  selectDownCounter: number,
  filter: string,
  style?: ?Object,
}

// TODO figure typing out
const mapStateToProps: MapStateToProps<*, *, *> = (state: TypedState, {channels, selectedIndex, filter}) => ({
  data: channels
    ? Object.keys(channels)
        .filter(c => c.toLowerCase().indexOf(filter) >= 0)
        .sort()
        .map((c, i) => ({channelName: c, selected: i === selectedIndex}))
    : {},
})

// TODO share this connector with user-mention-hud?
// $FlowIssue is confused
const MentionHud: Class<React.Component<MentionHudProps, void>> = compose(
  withState('selectedIndex', 'setSelectedIndex', 0),
  connect(mapStateToProps),
  setDisplayName('ChannelMentionHud'),
  lifecycle({
    componentWillReceiveProps: function(nextProps) {
      if (nextProps.data.length === 0) {
        nextProps.setSelectedIndex(0)
      }
      if (nextProps.data.length && nextProps.data.length !== this.props.data.length) {
        nextProps.setSelectedIndex(n => Math.min(n, nextProps.data.length - 1))
      }

      if (nextProps.selectUpCounter !== this.props.selectUpCounter) {
        nextProps.setSelectedIndex(n => {
          const next = n - 1
          if (next < 0) {
            return Math.max(nextProps.data.length - 1, 0)
          }
          return next
        })
      } else if (nextProps.selectDownCounter !== this.props.selectDownCounter) {
        nextProps.setSelectedIndex(n => {
          const next = n + 1
          if (next >= nextProps.data.length) {
            return 0
          }
          return next
        })
      }

      if (nextProps.pickSelectedChannelCounter !== this.props.pickSelectedChannelCounter) {
        if (nextProps.selectedIndex < nextProps.data.length) {
          nextProps.onPickChannel(nextProps.data[nextProps.selectedIndex].channelName)
        } else {
          // Just exit
          nextProps.onPickChannel(nextProps.filter, {notChannel: true})
        }
      }

      if (nextProps.selectedIndex !== this.props.selectedIndex) {
        if (nextProps.selectedIndex < nextProps.data.length) {
          nextProps.onSelectChannel(nextProps.data[nextProps.selectedIndex].channelName)
        }
      }
    },
  }),
  withPropsOnChange(['onPickChannel'], ownerProps => ({
    rowRenderer: (index, props) => (
      <MentionRowRenderer
        key={props.channelName}
        onClick={() => ownerProps.onPickChannel(props.channelName)}
        onHover={() => ownerProps.setSelectedIndex(index)}
        {...props}
      />
    ),
  }))
)(Hud)

export {MentionRowRenderer, MentionHud}
export default Hud
