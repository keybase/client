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
  withStateHandlers<any, any, any>(
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
    componentDidUpdate(prevProps, prevState) {
      if (this.props.data.length === 0) {
        if (prevProps.selectedIndex === 0) {
          // We've already done this, so just get out of here so we don't infinite loop
          return
        }
        this.props.setSelectedIndex(0)
      }
      if (this.props.data.length && this.props.data.length !== prevProps.data.length) {
        this.props.setSelectedIndex(Math.min(this.props.selectedIndex, this.props.data.length - 1))
      }

      if (this.props.selectUpCounter !== prevProps.selectUpCounter) {
        let next = this.props.selectedIndex - 1
        if (next < 0) {
          next = Math.max(this.props.data.length - 1, 0)
        }
        this.props.setSelectedIndex(next)
      } else if (this.props.selectDownCounter !== prevProps.selectDownCounter) {
        let next = this.props.selectedIndex + 1
        if (next >= this.props.data.length) {
          next = 0
        }
        this.props.setSelectedIndex(next)
      }

      if (this.props.pickSelectedChannelCounter !== prevProps.pickSelectedChannelCounter) {
        if (this.props.selectedIndex < this.props.data.length) {
          this.props.onPickChannel(this.props.data[this.props.selectedIndex].channelName)
        } else {
          // Just exit
          this.props.onPickChannel(this.props.filter, {notChannel: true})
        }
      }

      if (this.props.selectedIndex !== prevProps.selectedIndex) {
        if (this.props.selectedIndex < this.props.data.length) {
          // Check if the previously selected entry matches the currently selected one
          // we do this to prevent replace the user's text if the currently selected
          // moves around in the list
          const prevChannelname = prevProps.fullList[prevProps.selectedIndex]
          const nextChannelname = this.props.data[this.props.selectedIndex].channelName
          if (prevChannelname !== nextChannelname) {
            this.props.onSelectChannel(nextChannelname)
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
