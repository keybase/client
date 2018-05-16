// @flow
import React from 'react'
import {compose, withStateHandlers, lifecycle, withPropsOnChange, withProps} from '../../../../util/container'
import {
  Avatar,
  Box,
  ClickableBox,
  List,
  Text,
  ConnectedUsernames,
  Icon,
} from '../../../../common-adapters/index'
import {globalColors, globalMargins, globalStyles, isMobile, collapseStyles} from '../../../../styles'
import {isSpecialMention} from '../../../../constants/chat2'

type Props<D: {key: string, selected: boolean}> = {
  rowRenderer: (i: number, d: D) => React$Element<any>,
  data: Array<D>,
  style: Object,
  selectedIndex: number,
}

type MentionDatum = {
  username: string,
  fullName: string,
  selected: boolean,
  onClick: () => void,
  onHover: () => void,
}

const MentionRowRenderer = ({username, fullName, selected, onClick, onHover}: MentionDatum) => (
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
    {!isSpecialMention(username) ? (
      <Avatar username={username} size={32} />
    ) : (
      <Icon
        type="iconfont-people"
        style={{
          padding: globalMargins.xtiny,
        }}
        color={globalColors.blue}
        fontSize={24}
      />
    )}

    <Box style={{width: globalMargins.small}} />

    <ConnectedUsernames type="BodySemibold" colorFollowing={true} usernames={[username]} />
    <Text type="BodySmall" style={{marginLeft: globalMargins.tiny}}>
      {fullName}
    </Text>
  </ClickableBox>
)

// We want to render Hud even if there's no data so we can still have lifecycle methods so we can still do things
// This is important if you type a filter that gives you no results and you press enter for instance
// $FlowIssue doens't like star now
const Hud = ({style, data, rowRenderer, selectedIndex}: Props<*>) =>
  data.length ? (
    <Box style={collapseStyles([hudStyle, style])}>
      <List items={data} renderItem={rowRenderer} selectedIndex={selectedIndex} fixedHeight={40} />
    </Box>
  ) : null

const hudStyle = {
  ...globalStyles.flexBoxRow,
  backgroundColor: globalColors.white,
}

const _withProps = ({users, filter, selectedIndex}) => {
  const fullList = users
    .map((u, i) => ({
      fullName: u.fullName,
      key: u.username,
      username: u.username,
    }))
    .concat({
      fullName: 'Everyone in this channel',
      key: 'channel',
      username: 'channel',
    })
  return {
    data: fullList
      .filter(u => {
        return u.username.toLowerCase().indexOf(filter) >= 0 || u.fullName.toLowerCase().indexOf(filter) >= 0
      })
      .map((u, i) => ({...u, selected: i === selectedIndex})),
    fullList,
  }
}

const MentionHud = compose(
  withStateHandlers({selectedIndex: 0}, {setSelectedIndex: () => selectedIndex => ({selectedIndex})}),
  withProps(_withProps),
  lifecycle({
    componentWillReceiveProps(nextProps) {
      if (nextProps.data.length === 0) {
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

      if (nextProps.pickSelectedUserCounter !== this.props.pickSelectedUserCounter) {
        if (nextProps.selectedIndex < nextProps.data.length) {
          nextProps.onPickUser(nextProps.data[nextProps.selectedIndex].username)
        } else {
          // Just exit
          nextProps.onPickUser(nextProps.filter, {notUser: true})
        }
      }

      if (nextProps.selectedIndex !== this.props.selectedIndex) {
        if (nextProps.selectedIndex < nextProps.data.length) {
          // Check if the previously selected entry matches the currently selected one
          // we do this to prevent replace the user's text if the currently selected
          // moves around in the list
          const prevUser = this.props.fullList[this.props.selectedIndex]
          const prevUsername = prevUser && prevUser.username
          const nextUsername = nextProps.data[nextProps.selectedIndex].username
          if (prevUsername !== nextUsername) {
            nextProps.onSelectUser(nextUsername)
          }
        }
      }
    },
  }),
  withPropsOnChange(['onPickUser'], ownerProps => ({
    rowRenderer: (index, props) => {
      return (
        <MentionRowRenderer
          key={props.key}
          onClick={() => ownerProps.onPickUser(props.username)}
          onHover={() => ownerProps.setSelectedIndex(index)}
          {...props}
        />
      )
    },
  }))
)(Hud)

export {MentionRowRenderer, MentionHud}
export default Hud
