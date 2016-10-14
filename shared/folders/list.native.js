// @flow
import React, {Component} from 'react'
import Row from './row'
import type {IconType} from '../common-adapters/icon'
import type {Props} from './list'
import {Box, Text, Icon, ClickableBox} from '../common-adapters/index'
import {globalStyles, globalColors} from '../styles'

const rowKey = users => users && users.map(u => u.username).join('-')

const Ignored = ({rows, showIgnored, ignored, styles, onToggle, isPublic}) => {
  const caretIcon: IconType = showIgnored ? 'iconfont-caret-down' : 'iconfont-caret-right'

  return (
    <Box style={stylesIgnoreContainer}>
      <ClickableBox onClick={onToggle}>
        <Box style={styles.topBox}>
          <Text type='BodySmallSemibold' style={styles.dividerText}>Ignored folders</Text>
          <Icon type={caretIcon} style={{...stylesIgnoreCaret, color: isPublic ? globalColors.black_40 : globalColors.white_40}} />
        </Box>
      </ClickableBox>
      {showIgnored && <Box style={styles.bottomBox}>
        <Text type='BodySmallSemibold' style={styles.dividerBodyText}>Ignored folders won't show up on your computer and you won't receive alerts about them.</Text>
      </Box>}
      {showIgnored && rows}
    </Box>
  )
}

class ListRender extends Component<void, Props, void> {
  render () {
    const styles = this.props.isPublic ? stylesPublic : stylesPrivate
    const ignoredRows = (this.props.ignored || []).map((i, idx) => (
      <Row
        {...i}
        key={rowKey(i.users)}
        users={i.users}
        isPublic={this.props.isPublic}
        ignored={true} />))

    return (
      <Box style={stylesContainer}>
        {this.props.tlfs && this.props.tlfs.map((t, idx) => (
          <Row
            key={rowKey(t.users)}
            {...t}
            isPublic={this.props.isPublic}
            ignored={false}
            onClick={this.props.onClick} />
          ))}
        <Ignored rows={ignoredRows} showIgnored={this.props.showIgnored} styles={styles}
          isPublic={this.props.isPublic} onToggle={this.props.onToggleShowIgnored} />
      </Box>
    )
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
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
  padding: 7,
  textAlign: 'center',
}

const stylesIgnoreCaret = {
  width: 8,
  height: 8,
}

const stylesPrivate = {
  topBox: {
    ...stylesIgnoreDivider,
    backgroundColor: globalColors.darkBlue3,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  dividerText: {
    ...stylesDividerText,
    color: globalColors.white_75,
  },
  dividerBodyText: {
    ...stylesDividerBodyText,
    color: globalColors.white_40,
  },
  bottomBox: {
    ...stylesIgnoreDesc,
    backgroundColor: globalColors.darkBlue3,
  },
}

const stylesPublic = {
  topBox: {
    ...stylesIgnoreDivider,
    backgroundColor: globalColors.lightGrey,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  dividerText: {
    ...stylesDividerText,
    color: globalColors.black_40,
  },
  dividerBodyText: {
    ...stylesDividerBodyText,
    color: globalColors.black_40,
  },
  bottomBox: {
    ...stylesIgnoreDesc,
    backgroundColor: globalColors.lightGrey,
  },
}
export default ListRender
