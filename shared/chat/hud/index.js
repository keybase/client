// @flow
import React from 'react'
import {
  compose,
  withState,
  lifecycle,
  withPropsOnChange,
  type TypedState,
  connect,
  type MapStateToProps,
} from '../../util/container'
import {Avatar, Box, ClickableBox, List, Text, Usernames} from '../../common-adapters/index'
import {globalColors, globalMargins, globalStyles} from '../../styles'

type Props<D: {key: string, selected: boolean}> = {
  rowRenderer: (i: number, d: D) => React$Element<*>,
  data: Array<D>,
  style: Object,
  selectedIndex: number,
}

type MentionDatum = {
  following: {[username: string]: boolean},
  you: string,
  username: string,
  fullName: string,
  selected: boolean,
  onClick: () => void,
  onHover: () => void,
}

const MentionRowRenderer = ({
  username,
  fullName,
  selected,
  onClick,
  onHover,
  following,
  you,
}: MentionDatum) => (
  <ClickableBox
    style={{
      ...globalStyles.flexBoxRow,
      height: 40,
      alignItems: 'center',
      paddingLeft: globalMargins.tiny,
      paddingRight: globalMargins.tiny,
      backgroundColor: selected ? globalColors.blue4 : undefined,
    }}
    onClick={onClick}
    onMouseOver={onHover}
  >
    <Avatar username={username} size={32} />
    <Usernames
      type="Body"
      colorFollowing={true}
      users={[{you: you === username, username, following: following[username]}]}
      style={{marginLeft: globalMargins.small}}
    />
    <Text type="Body" style={{marginLeft: globalMargins.tiny}}>{fullName}</Text>
  </ClickableBox>
)

// We want to render Hud even if there's no data so we can still have lifecycle methods so we can still do things
// This is important if you type a filter that gives you no results and you press enter for instance
const Hud = ({style, data, rowRenderer, selectedIndex}: Props<*>) =>
  data.length
    ? <Box style={{...hudStyle, ...style}}>
        <List items={data} renderItem={rowRenderer} selectedIndex={selectedIndex} fixedHeight={40} />
      </Box>
    : null

const hudStyle = {
  ...globalStyles.flexBoxRow,
  backgroundColor: globalColors.white,
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
  following: state.config.following,
  you: state.config.username || '',
  data: userIds
    .map((u, i) => ({
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

      if (nextProps.pickSelectedUserCounter !== this.props.pickSelectedUserCounter) {
        if (nextProps.data.length) {
          nextProps.onPickUser(nextProps.data[nextProps.selectedIndex].username)
        } else {
          // Just exit
          nextProps.onPickUser(nextProps.filter, {notUser: true})
        }
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
          following={ownerProps.following}
          you={ownerProps.you}
          {...props}
        />
      )
    },
  }))
)(Hud)

export {MentionRowRenderer, MentionHud}
export default Hud
