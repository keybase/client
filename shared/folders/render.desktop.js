// @flow
import React, {Component} from 'react'
import type {Props} from './render'
import {Box, Text, Icon} from '../common-adapters'
import Row from './row'
import {globalStyles, globalColors} from '../styles/style-guide'

type State = {
  showIgnored: boolean
}

const Ignored = ({showIgnored, ignored, isPublic, onToggle}) => {
  const boxStyles = {
    backgroundColor: isPublic ? globalColors.black_40 : globalColors.darkBlue3,
    color: isPublic ? globalColors.black_40 : globalColors.white_75
  }

  return (
    <Box style={stylesIgnoreContainer}>
      <Box style={{...stylesIgnoreDivider, ...boxStyles}} onClick={onToggle}>
        <Text type='BodySmallSemibold' style={stylesDividerText}>Ignored folders</Text>
        <Icon type={showIgnored ? 'fa-caret-down' : 'fa-caret-right'} style={stylesIgnoreCaret} />
      </Box>
      {showIgnored && <Box style={{...stylesIgnoreDesc, ...boxStyles}}>
        <Text type='BodySmallSemibold' style={stylesDividerBodyText}>Ignored folders won't show up on your computer and you won't receive alerts about them.</Text>
      </Box>}
      {showIgnored && ignored.map((i, idx) => <Row key={i.users.map(u => u.username).join('-')} users={i.users} icon='' isPublic={isPublic} ignored isFirst={!idx} />)}
    </Box>
  )
}

class Render extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)

    this.state = {
      showIgnored: false
    }
  }

  render () {
    const realCSS = `
      .folder-row .folder-row-hover-action { visibility: hidden }
      .folder-row:hover .folder-row-hover-action { visibility: visible }
    `

    return (
      <Box style={stylesContainer}>
        <style>{realCSS}</style>
        {this.props.tlfs && this.props.tlfs.map((t, idx) => <Row key={t.users.map(u => u.username).join('-')} {...t} icon='' isPublic={this.props.isPublic} ignored={false} isFirst={!idx} />)}
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
  alignItems: 'center'
}

const stylesIgnoreDivider = {
  padding: 7,
  height: 32
}

const stylesDividerText = {
  ...globalStyles.clickable,
  color: 'inherit',
  marginRight: 7
}

const stylesDividerBodyText = {
  width: 360,
  padding: 7,
  textAlign: 'center',
  color: 'inherit'
}

const stylesIgnoreCaret = {
  color: globalColors.white_75
}

export default Render
