// @flow
import React from 'react'
import {connect, type MapStateToProps} from 'react-redux'
import {compose, withState, lifecycle, withPropsOnChange, branch, renderNothing} from 'recompose'
import {Avatar, Box, ClickableBox, List, Text} from '../../common-adapters/index'
import {globalColors, globalMargins, globalStyles} from '../../styles'

import type {TypedState} from '../../constants/reducer'

type Props<D: {key: string, selected: boolean}> = {
  rowRenderer: (i: number, d: D) => React$Element<*>,
  data: Array<D>,
  style: Object,
}

type MentionDatum = {
  avatar: React$Element<*>,
  username: string,
  fullName: string,
  selected: boolean,
  onClick: () => void,
  onHover: () => void,
}

const MentionRowRenderer = ({avatar, username, fullName, selected, onClick, onHover}: MentionDatum) => (
  <ClickableBox
    style={{
      ...globalStyles.flexBoxRow,
      height: 24,
      alignItems: 'center',
      paddingLeft: globalMargins.small,
      paddingRight: globalMargins.small,
      backgroundColor: selected ? globalColors.blue4 : undefined,
    }}
    onClick={onClick}
    onMouseOver={onHover}
  >
    {avatar}
    <Text type="Body" style={{marginLeft: globalMargins.tiny}}>{username}</Text>
    <Text type="Body" style={{marginLeft: globalMargins.tiny}}>{fullName}</Text>
  </ClickableBox>
)

const Hud = ({style, data, rowRenderer}: Props<*>) => (
  <Box style={{...hudStyle, ...style}}>
    <List items={data} renderItem={rowRenderer} />
  </Box>
)

const hudStyle = {
  ...globalStyles.flexBoxRow,
}

type MentionHudProps = {
  userIds: Array<string>,
  onPickUser: (user: string) => void,
  onSelectUser: (user: string) => void,
  pickSelectedUserCounter: number,
  selectUpCounter: number,
  selectDownCounter: number,
  filter: string,
  style?: ?Object,
}

// TODO figure typing out
const mapStateToProps: MapStateToProps<*, *, *> = (state: TypedState, {userIds, selectedIndex, filter}) => ({
  data: userIds
    .map((u, i) => ({
      avatar: <Avatar username={u} size={16} />,
      username: u,
      fullName: '', // TODO
      key: u,
    }))
    .filter(u => u.username.indexOf(filter) >= 0)
    .map((u, i) => ({...u, selected: i === selectedIndex})),
})
const MentionHud: Class<React.Component<MentionHudProps, void>> = compose(
  withState('selectedIndex', 'setSelectedIndex', 0),
  connect(mapStateToProps),
  branch(props => !props.data.length, renderNothing),
  lifecycle({
    componentWillReceiveProps: function(nextProps) {
      if (nextProps.data.length === 0) {
        nextProps.setSelectedIndex(0)
      }
      if (nextProps.data.length && nextProps.data.length !== this.props.data.length) {
        nextProps.setSelectedIndex(n => Math.min(n, nextProps.data.length - 1))
      }

      if (nextProps.selectUpCounter !== this.props.selectUpCounter) {
        nextProps.setSelectedIndex(n => Math.max(n - 1, 0))
      } else if (nextProps.selectDownCounter !== this.props.selectDownCounter) {
        nextProps.setSelectedIndex(n => Math.min(n + 1, nextProps.data.length - 1))
      }

      if (nextProps.pickSelectedUserCounter !== this.props.pickSelectedUserCounter) {
        nextProps.onPickUser(nextProps.data[nextProps.selectedIndex].username)
      }

      if (nextProps.selectedIndex !== this.props.selectedIndex) {
        nextProps.onSelectUser(nextProps.data[nextProps.selectedIndex].username)
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
