// @flow
import React, {Component} from 'react'
import type {Props} from './list'
import type {IconType} from '../common-adapters/icon'
import {Box, Text, Icon} from '../common-adapters'
import Row from './row'
import {globalStyles, globalColors} from '../styles/style-guide'

type State = {
  showIgnored: boolean
}

const rowKey = users => users && users.map(u => u.username).join('-')

const Ignored = ({showIgnored, ignored, styles, onToggle, isPublic, onOpen, onClick, onRekey, smallMode}) => {
  const caretIcon: IconType = showIgnored ? 'fa-kb-iconfont-caret-down' : 'fa-kb-iconfont-caret-right'

  return (
    <Box style={stylesIgnoreContainer}>
      <Box style={styles.topBox} onClick={onToggle}>
        <Text type='BodySmallSemibold' style={stylesDividerText}>Ignored folders</Text>
        <Icon type={caretIcon} style={{color: isPublic ? globalColors.black_40 : globalColors.white_40}} />
      </Box>
      {showIgnored && <Box style={styles.bottomBox}>
        <Text type='BodySmallSemibold' style={stylesDividerBodyText}>Ignored folders won't show up on your computer and you won't receive alerts about them.</Text>
      </Box>}
      {showIgnored && ignored && <Rows
        rows={ignored}
        onOpen={onOpen}
        onClick={onClick}
        onRekey={onRekey}
        isPublic={isPublic}
        smallMode={smallMode}
        ignored={true} // eslint-disable-line
      />}
    </Box>
  )
}

const Rows = ({rows, ignored, isPublic, onOpen, onClick, onRekey, smallMode}) => (
  <Box>
    {!!rows && rows.map((row, idx) => (
      <Row {...row} key={rowKey(row.users)} isPublic={isPublic} ignored={ignored} onClick={onClick}
        onRekey={onRekey} onOpen={onOpen} isFirst={!idx} smallMode={smallMode} />
    ))}
  </Box>
)

class Render extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)

    this.state = {
      showIgnored: false,
    }
  }

  render () {
    const realCSS = `
      .folder-row .folder-row-hover-action { visibility: hidden }
      .folder-row:hover .folder-row-hover-action { visibility: visible }
    `

    const styles = this.props.isPublic ? stylesPublic : stylesPrivate

    return (
      <Box style={{...stylesContainer, ...this.props.style}}>
        <style>{realCSS}</style>
        {this.props.extraRows}
        <Rows
          rows={this.props.tlfs}
          onOpen={this.props.onOpen}
          onClick={this.props.onClick}
          onRekey={this.props.onRekey}
          isPublic={this.props.isPublic}
          smallMode={this.props.smallMode}
          ignored={false}
        />
          {this.props.ignored && this.props.ignored.length > 0 && <Ignored
            ignored={this.props.ignored}
            showIgnored={this.state.showIgnored}
            styles={styles}
            onOpen={this.props.onOpen}
            onClick={this.props.onClick}
            onRekey={this.props.onRekey}
            isPublic={this.props.isPublic}
            smallMode={this.props.smallMode}
            onToggle={() => this.setState({showIgnored: !this.state.showIgnored})} />}
      </Box>
    )
  }
}

const stylesContainer = {
  ...globalStyles.scrollable,
  overflowX: 'hidden',
}

const stylesIgnoreContainer = {
  ...globalStyles.flexBoxColumn,
}

const stylesIgnoreDesc = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
}

const stylesIgnoreDivider = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  padding: 7,
  height: 32,
}

const stylesDividerText = {
  ...globalStyles.clickable,
  color: 'inherit',
  marginRight: 7,
}

const stylesDividerBodyText = {
  width: 360,
  padding: 7,
  textAlign: 'center',
  color: 'inherit',
}

const stylesPrivate = {
  topBox: {
    ...stylesIgnoreDivider,
    backgroundColor: globalColors.darkBlue3,
    color: globalColors.white_75,
    borderTop: 'solid 1px rgba(255, 255, 255, 0.05)',
  },
  bottomBox: {
    ...stylesIgnoreDesc,
    backgroundColor: globalColors.darkBlue3,
    color: globalColors.white_40,
  },
}

const stylesPublic = {
  topBox: {
    ...stylesIgnoreDivider,
    backgroundColor: globalColors.lightGrey,
    color: globalColors.black_40,
    borderTop: 'solid 1px rgba(0, 0, 0, 0.05)',
  },
  bottomBox: {
    ...stylesIgnoreDesc,
    backgroundColor: globalColors.lightGrey,
    color: globalColors.black_40,
  },
}
export default Render
