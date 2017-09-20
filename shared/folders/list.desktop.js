// @flow
import React, {Component} from 'react'
import ReactDOM from 'react-dom'
import Row from './row'
import some from 'lodash/some'
import type {IconType} from '../common-adapters/icon'
import type {Props, Folder} from './list'
import {Box, Text, Icon} from '../common-adapters'
import {globalStyles, globalColors} from '../styles'

const rowKey = users => users && users.map(u => `${u.username}-${u.readOnly ? 'reader' : ''}`).join('-')

const Ignored = ({rows, showIgnored, styles, onToggle, isPublic, onClick}) => {
  const caretIcon: IconType = showIgnored ? 'iconfont-caret-down' : 'iconfont-caret-right'

  if (!rows) {
    return null
  }

  return (
    <Box style={stylesIgnoreContainer}>
      <Box style={styles.topBox} onClick={onToggle}>
        <Text type="BodySmallSemibold" style={stylesDividerText}>Ignored folders</Text>
        <Icon type={caretIcon} style={{color: globalColors.black_40}} />
      </Box>
      {showIgnored &&
        <Box style={styles.bottomBox}>
          <Text type="BodySmall" style={stylesDividerBodyText}>
            Ignored folders won't show up on your computer and you won't receive alerts about them.
          </Text>
        </Box>}
      {showIgnored && rows}
    </Box>
  )
}

const Rows = ({
  tlfs = [],
  installed,
  isIgnored,
  isPublic,
  onOpen,
  onChat,
  onClick,
  onRekey,
  smallMode,
}: Props & {isIgnored: boolean, smallMode?: boolean, tlfs?: Array<Folder>}) => (
  <Box>
    {!!tlfs &&
      tlfs.map(tlf => (
        <Row
          {...tlf}
          key={rowKey(tlf.users)}
          isPublic={isPublic}
          hasReadOnlyUsers={tlf.users && some(tlf.users, 'readOnly')}
          ignored={isIgnored}
          installed={installed}
          onChat={onChat}
          onClick={onClick}
          onRekey={onRekey}
          onOpen={onOpen}
          smallMode={smallMode}
        />
      ))}
  </Box>
)

class ListRender extends Component<Props> {
  _scrollContainer = null

  componentDidUpdate(prevProps: Props) {
    if (prevProps.showIgnored !== this.props.showIgnored && this._scrollContainer && this.props.showIgnored) {
      // $FlowIssue
      ReactDOM.findDOMNode(this._scrollContainer).scrollTop += 100
    }
  }

  _setRef = r => {
    this._scrollContainer = r
  }

  render() {
    const realCSS = `
      .folder-row .folder-row-hover-action { visibility: hidden; }
      .folder-row:hover .folder-row-hover-action { visibility: visible; }
      .folder-row:hover .folder-row-hover-action:hover { text-decoration: underline; }
    `

    const styles = this.props.isPublic ? stylesPublic : stylesPrivate
    const ignoredRows = <Rows {...this.props} isIgnored={true} tlfs={this.props.ignored || []} />

    return (
      <Box style={{...stylesContainer, ...this.props.style}} ref={this._setRef}>
        <style>{realCSS}</style>
        {this.props.extraRows}
        <Rows {...this.props} isIgnored={false} tlfs={this.props.tlfs || []} />
        {!this.props.smallMode &&
          <Ignored
            isPublic={this.props.isPublic}
            showIgnored={this.props.showIgnored}
            styles={styles}
            onToggle={this.props.onToggleShowIgnored}
            rows={ignoredRows}
          />}
      </Box>
    )
  }
}

const stylesContainer = {
  ...globalStyles.scrollable,
  willChange: 'transform',
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
  marginRight: 7,
}

const stylesDividerBodyText = {
  width: 360,
  padding: 7,
  textAlign: 'center',
}

const stylesPrivate = {
  topBox: {
    ...stylesIgnoreDivider,
    backgroundColor: globalColors.white,
    color: globalColors.white_75,
    borderBottom: 'solid 1px rgba(255, 255, 255, 0.05)',
  },
  bottomBox: {
    ...stylesIgnoreDesc,
    backgroundColor: globalColors.white,
    color: globalColors.white_40,
  },
}

const stylesPublic = {
  topBox: {
    ...stylesIgnoreDivider,
    backgroundColor: globalColors.white,
    color: globalColors.black_40,
    borderBottom: 'solid 1px rgba(0, 0, 0, 0.05)',
  },
  bottomBox: {
    ...stylesIgnoreDesc,
    backgroundColor: globalColors.white,
    color: globalColors.black_40,
  },
}
export default ListRender
