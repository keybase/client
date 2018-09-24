// @flow
import React from 'react'
import {compose, lifecycle, withProps, withPropsOnChange, withStateHandlers} from '../../../../util/container'
import {Box, ClickableBox, List, Text} from '../../../../common-adapters/index'
import {globalColors, globalMargins, globalStyles, isMobile, collapseStyles} from '../../../../styles'

type Props<D: {channelName: string, selected: boolean}> = {
  rowRenderer: (i: number, d: D) => React$Element<any>,
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
const Hud = ({style, data, rowRenderer, selectedIndex}: Props<any>) =>
  data.length ? (
    <Box style={collapseStyles([hudStyle, style])}>
      <List items={data} renderItem={rowRenderer} selectedIndex={selectedIndex} fixedHeight={40} />
    </Box>
  ) : null

const hudStyle = {
  ...globalStyles.flexBoxRow,
  backgroundColor: globalColors.white,
}

// TODO share this connector with user-mention-hud?
const MentionHud = compose(
  withStateHandlers(
    {selectedIndex: 0},
    {
      setSelectedIndex: () => (selectedIndex: number) => ({selectedIndex}),
    }
  ),
  withProps((props: {channels: Array<string>, filter: string, selectedIndex: number}) => {
    const fullList = props.channels ? props.channels.slice().sort() : []
    return {
      data: fullList
        .filter(c => c.toLowerCase().indexOf(props.filter) >= 0)
        .map((c, i) => ({channelName: c, key: c, selected: i === props.selectedIndex})),
      fullList,
    }
  }),
  lifecycle({
    componentWillReceiveProps(nextProps) {
      if (nextProps.data.length === 0) {
        if (this.props.selectedIndex === 0) {
          // We've already done this, so just get out of here so we don't infinite loop
          return
        }
        nextProps.setSelectedIndex(0)
      }
      if (nextProps.data.length && nextProps.data.length !== this.props.data.length) {
        nextProps.setSelectedIndex(Math.min(nextProps.selectedIndex, nextProps.data.length - 1))
      }

      if (nextProps.selectUpCounter !== this.props.selectUpCounter) {
        let next = nextProps.selectedIndex - 1
        if (next < 0) {
          next = Math.max(nextProps.data.length - 1, 0)
        }
        nextProps.setSelectedIndex(next)
      } else if (nextProps.selectDownCounter !== this.props.selectDownCounter) {
        let next = nextProps.selectedIndex + 1
        if (next >= nextProps.data.length) {
          next = 0
        }
        nextProps.setSelectedIndex(next)
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
          // Check if the previously selected entry matches the currently selected one
          // we do this to prevent replace the user's text if the currently selected
          // moves around in the list
          const prevChannelname = this.props.fullList[this.props.selectedIndex]
          const nextChannelname = nextProps.data[nextProps.selectedIndex].channelName
          if (prevChannelname !== nextChannelname) {
            nextProps.onSelectChannel(nextChannelname)
          }
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
