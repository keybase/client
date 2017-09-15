// @flow
import React from 'react'
import {connect} from 'react-redux'
import {compose, withState, lifecycle, withPropsOnChange} from 'recompose'
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
  selectUpCounter: number,
  selectDownCounter: number,
  style: Object,
}

// TODO figure typing out
const MentionHud: Class<React.Component<MentionHudProps, void>> = compose(
  withState('selectedIndex', 'setSelectedIndex', 0),
  connect((state: TypedState, {userIds, selectedIndex}) => ({
    data: userIds.map((u, i) => ({
      avatar: <Avatar username={u} size={16} />,
      username: u,
      fullName: u, // TODO
      key: u,
      selected: i === selectedIndex,
    })),
  })),
  lifecycle({
    componentWillReceiveProps: function(nextProps) {
      if (nextProps.selectUpCounter !== this.props.selectUpCounter) {
        nextProps.setSelectedIndex(n => Math.max(n - 1, 0))
      } else if (nextProps.selectDownCounter !== this.props.selectDownCounter) {
        nextProps.setSelectedIndex(n => Math.min(n + 1, nextProps.userIds.length - 1))
      }

      if (nextProps.selectedIndex !== this.props.selectedIndex) {
        nextProps.onSelectUser(nextProps.userIds[nextProps.selectedIndex])
      }
    },
  }),
  withPropsOnChange(['onPickUser'], ownerProps => ({
    rowRenderer: (index, props) => {
      console.log('props', props)
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
