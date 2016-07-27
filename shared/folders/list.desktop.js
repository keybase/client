// @flow
import React, {Component} from 'react'
import type {Props, Folder} from './list'
import type {IconType} from '../common-adapters/icon'
import {Box, Text, Icon} from '../common-adapters'
import Row from './row'
import {globalStyles, globalColors} from '../styles/style-guide'

const rowKey = users => users && users.map(u => u.username).join('-')

const Ignored = ({rows, showIgnored, styles, onToggle, isPublic, onClick}) => {
  const caretIcon: IconType = showIgnored ? 'iconfont-caret-down' : 'iconfont-caret-right'

  if (!rows) {
    return null
  }

  return (
    <Box style={stylesIgnoreContainer}>
      <Box style={styles.topBox} onClick={onToggle}>
        <Text type='BodySmallSemibold' style={stylesDividerText}>Ignored folders</Text>
        <Icon type={caretIcon} style={{color: isPublic ? globalColors.black_40 : globalColors.white_40}} />
      </Box>
      {showIgnored && <Box style={styles.bottomBox}>
        <Text type='BodySmall' style={stylesDividerBodyText}>Ignored folders won't show up on your computer and you won't receive alerts about them.</Text>
      </Box>}
      {showIgnored && rows}
    </Box>
  )
}

const Rows = ({tlfs = [], isIgnored, isPublic, onOpen, onClick, onRekey, smallMode}: Props & {isIgnored: boolean, smallMode?: boolean, tlfs?: Array<Folder>}) => (
  <Box>
    {!!tlfs && tlfs.map((tlf) => (
      <Row
        {...tlf}
        key={rowKey(tlf.users)}
        isPublic={isPublic}
        ignored={isIgnored}
        onClick={onClick}
        onRekey={onRekey}
        onOpen={onOpen}
        smallMode={smallMode} />
    ))}
  </Box>
)

class Render extends Component<void, Props, void> {
  render () {
    const realCSS = `
      .folder-row .folder-row-hover-action { visibility: hidden }
      .folder-row:hover .folder-row-hover-action { visibility: visible }
    `

    const styles = this.props.isPublic ? stylesPublic : stylesPrivate
    const ignoredRows = <Rows {...this.props} isIgnored={true} tlfs={this.props.ignored || []} />

    return (
      <Box style={{...stylesContainer, ...this.props.style}}>
        <style>{realCSS}</style>
        {this.props.extraRows}
        <Rows
          {...this.props}
          isIgnored={false}
          tlfs={this.props.tlfs || []} />
        <Ignored
          isPublic={this.props.isPublic}
          showIgnored={this.props.showIgnored}
          styles={styles}
          onToggle={this.props.onToggleShowIgnored}
          rows={ignoredRows} />
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
    borderBottom: 'solid 1px rgba(255, 255, 255, 0.05)',
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
    borderBottom: 'solid 1px rgba(0, 0, 0, 0.05)',
  },
  bottomBox: {
    ...stylesIgnoreDesc,
    backgroundColor: globalColors.lightGrey,
    color: globalColors.black_40,
  },
}
export default Render
