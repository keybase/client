import React, {Component} from 'react'
import type {Props} from './render'
import {Box, Text, Icon, Avatar} from '../common-adapters'
import {globalStyles, globalColors} from '../styles/style-guide'
import {resolveImageAsURL} from '../../desktop/resolve-root'

type State = {
  showIgnored: boolean
}

const Row = ({users, icon, isPublic, ignored, isFirst}) => (
  <Box style={{...rowContainer,
    ...(isPublic ? rowContainerPublic : rowContainerPrivate),
    ...(isFirst ? {borderBottom: undefined} : {})}}>
    <Box style={{...stylesAvatarContainer, ...(isPublic ? stylesAvatarContainerPublic : stylesAvatarContainerPrivate)}}>
      {users.length === 1 ? <Avatar size={32} username={users[0]} /> : <Icon type='folder-private-group-32' />}
    </Box>
    <Box style={stylesBodyContainer} />
    <Box style={stylesActionContainer} />
  </Box>
)

const Ignored = ({showIgnored, ignored, isPublic, onToggle}) => (
  <Box style={stylesIgnoreContainer}>
    <Box style={stylesIgnoreDivider} onClick={onToggle}>
      <Text type='BodySmallSemibold' style={stylesDividerText}>Ignored folders</Text>
      <Icon type={showIgnored ? 'fa-caret-down' : 'fa-caret-right'} style={stylesIgnoreCaret} />
    </Box>
    {showIgnored && <Box style={stylesIgnoreDesc}>
      <Text type='BodySmallSemibold' style={stylesDividerBodyText}>Ignored folders won't show up on your computer and you won't receive alerts about them.</Text>
    </Box>}
    {showIgnored && ignored.map((i, idx) => <Row key={i.users.map(u => u.username).join('-')} users={i.users} icon='' isPublic={isPublic} ignored isFirst={!idx} />)}
  </Box>
)

class Render extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)

    this.state = {
      showIgnored: false
    }
  }

  render () {
    return (
      <Box style={stylesContainer}>
        {this.props.tlfs.map((t, idx) => <Row key={t.users.map(u => u.username).join('-')} users={t.users} icon='' isPublic={this.props.isPublic} ignored={false} isFirst={!idx} />)}
        <Ignored ignored={this.props.ignored} showIgnored={this.state.showIgnored} isPublic={this.props.isPublic}
          onToggle={() => this.setState({showIgnored: !this.state.showIgnored})} />
      </Box>
    )
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1
}

const stylesIgnoreContainer = {
  ...globalStyles.flexBoxColumn
}

const stylesIgnoreDesc = {
  ...globalStyles.flexBoxColumn,
  borderTop: 'solid 1px rgba(255, 255, 255, 0.05)',
  backgroundColor: globalColors.darkBlue3,
  alignItems: 'center'
}

const stylesIgnoreDivider = {
  backgroundColor: globalColors.darkBlue3,
  padding: 7,
  height: 32
}

const stylesDividerText = {
  ...globalStyles.clickable,
  color: globalColors.white_75,
  marginRight: 7
}

const stylesDividerBodyText = {
  width: 360,
  color: globalColors.white_75,
  padding: 7,
  textAlign: 'center'
}

const stylesIgnoreCaret = {
  color: globalColors.white_75
}

const rowContainer = {
  ...globalStyles.flexBoxRow,
  minHeight: 48,
  borderTop: `solid 1px ${globalColors.black_10}`
}

const rowContainerPublic = {
  backgroundColor: globalColors.white,
  color: globalColors.yellowGreen2
}

const rowContainerPrivate = {
  backgroundColor: globalColors.darkBlue,
  color: globalColors.white
}

const stylesAvatarContainer = {
  width: 48,
  minHeight: 48,
  padding: 8
}

const stylesAvatarContainerPublic = {}

const stylesAvatarContainerPrivate = {
  backgroundColor: globalColors.darkBlue3,
  backgroundImage: `url(${resolveImageAsURL('icons', 'damier-pattern-good-open.png')})`,
  backgroundRepeat: 'repeat'
}

const stylesBodyContainer = {
  flex: 1
}

const stylesActionContainer = {
  width: 96,
  height: 48,
  marginLeft: 16,
  marginRight: 16
}

export default Render

