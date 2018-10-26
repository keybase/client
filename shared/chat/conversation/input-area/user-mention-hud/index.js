// @flow
// TODO the hierarchy of this component is too confusing, clean this up
import * as React from 'react'
import * as Kb from '../../../../common-adapters/index'
import * as Styles from '../../../../styles'
import * as Constants from '../../../../constants/chat2'
import type {MentionDatum, HudProps, MentionHudProps} from '.'

const MentionRowRenderer = ({username, fullName, selected, onClick, onHover}: MentionDatum) => (
  <Kb.ClickableBox
    style={{
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      backgroundColor: selected && !Styles.isMobile ? Styles.globalColors.blue4 : undefined,
      height: 40,
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
    }}
    onClick={onClick}
    onMouseOver={onHover}
  >
    {!Constants.isSpecialMention(username) ? (
      <Kb.Avatar username={username} size={32} />
    ) : (
      <Kb.Icon
        type="iconfont-people"
        style={{
          padding: Styles.globalMargins.xtiny,
        }}
        color={Styles.globalColors.blue}
        fontSize={24}
      />
    )}

    <Kb.Box style={{width: Styles.globalMargins.small}} />

    <Kb.ConnectedUsernames type="BodySemibold" colorFollowing={true} usernames={[username]} />
    <Kb.Text type="BodySmall" style={{marginLeft: Styles.globalMargins.tiny}}>
      {fullName}
    </Kb.Text>
  </Kb.ClickableBox>
)

// We want to render Hud even if there's no data so we can still have lifecycle methods so we can still do things
// This is important if you type a filter that gives you no results and you press enter for instance
const Hud = ({style, data, loading, rowRenderer, selectedIndex}: HudProps<any>) =>
  data.length ? (
    <Kb.Box style={Styles.collapseStyles([hudStyle, style])}>
      {loading ? (
        <Kb.Box2
          direction="horizontal"
          fullWidth={true}
          style={{alignItems: 'center', justifyContent: 'center'}}
        >
          <Kb.ProgressIndicator style={{height: 40, width: 40}} />
        </Kb.Box2>
      ) : (
        <Kb.List items={data} renderItem={rowRenderer} selectedIndex={selectedIndex} fixedHeight={40} />
      )}
    </Kb.Box>
  ) : null

const hudStyle = {
  ...Styles.globalStyles.flexBoxRow,
  backgroundColor: Styles.globalColors.white,
}

type State = {|
  selectedIndex: number,
|}

type Data = {|
  key: string,
  username: string,
  fullName: string,
  selected: boolean,
|}

class MentionHud extends React.Component<MentionHudProps, State> {
  state = {selectedIndex: 0}
  _setSelectedIndex = selectedIndex =>
    this.setState(p => (p.selectedIndex !== selectedIndex ? {selectedIndex} : null))
  render() {
    const fullList = makeFullList(this.props)
    const data = makeData(fullList, this.props.filter, this.state.selectedIndex)
    return (
      // $FlowIssue these types are all messed up
      <MentionHudImpl
        {...this.props}
        fullList={fullList}
        data={data}
        setSelectedIndex={this._setSelectedIndex}
        selectedIndex={this.state.selectedIndex}
      />
    )
  }
}

type ImplProps = MentionHudProps & {|data: Array<Data>, fullList: Array<Data>|}
class MentionHudImpl extends React.Component<ImplProps> {
  componentDidUpdate(prevProps: ImplProps) {
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

    if (this.props.pickSelectedUserCounter !== prevProps.pickSelectedUserCounter) {
      if (this.props.selectedIndex < this.props.data.length) {
        this.props.onPickUser(this.props.data[this.props.selectedIndex].username)
      } else {
        // Just exit
        this.props.onPickUser(this.props.filter, {notUser: true})
      }
    }

    if (this.props.selectedIndex !== prevProps.selectedIndex) {
      if (this.props.selectedIndex < this.props.data.length) {
        // Check if the previously selected entry matches the currently selected one
        // we do this to prevent replace the user's text if the currently selected
        // moves around in the list
        const prevUser = prevProps.fullList[prevProps.selectedIndex]
        const prevUsername = prevUser && prevUser.username
        const nextUsername = this.props.data[this.props.selectedIndex].username
        if (prevUsername !== nextUsername) {
          this.props.onSelectUser(nextUsername)
        }
      }
    }
  }

  rowRenderer = (index: number, props: Data) => {
    return (
      <MentionRowRenderer
        key={props.key}
        onClick={() => this.props.onPickUser(props.username)}
        onHover={() => this.props.setSelectedIndex(index)}
        {...props}
      />
    )
  }

  render() {
    return <Hud {...this.props} rowRenderer={this.rowRenderer} />
  }
}

const makeFullList = props => {
  const usersList = props.users.map((u, i) => ({
    fullName: u.fullName,
    key: u.username,
    selected: false,
    username: u.username,
  }))

  const bigList =
    props.teamType === 'big'
      ? [
          {fullName: 'Everyone in this channel', key: 'channel', selected: false, username: 'channel'},
          {fullName: 'Everyone in this channel', key: 'here', selected: false, username: 'here'},
        ]
      : []

  const smallList =
    props.teamType === 'small'
      ? [
          {fullName: 'Everyone in this team', key: 'channel', selected: false, username: 'channel'},
          {fullName: 'Everyone in this team', key: 'here', selected: false, username: 'here'},
        ]
      : []

  return [...usersList, ...bigList, ...smallList]
}

const makeData = (fullList, filter, selectedIndex) =>
  fullList
    .filter(u => {
      return u.username.toLowerCase().indexOf(filter) >= 0 || u.fullName.toLowerCase().indexOf(filter) >= 0
    })
    .map((u, i) => ({...u, selected: i === selectedIndex}))

export {MentionRowRenderer, MentionHud}
export default Hud
