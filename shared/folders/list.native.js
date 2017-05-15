// @flow
import React, {Component} from 'react'
import Row from './row'
import type {IconType} from '../common-adapters/icon'
import type {Props} from './list'
import {Box, Text, Icon, ClickableBox} from '../common-adapters/index'
import {NativeListView} from '../common-adapters/index.native'
import {globalStyles, globalColors} from '../styles'

const rowKey = users => users && users.map(u => u.username).join('-')

type State = {
  dataSource: NativeListView.DataSource,
  showIgnored: boolean,
}

class ListRender extends Component<void, Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    this.state = {
      dataSource: this._dataSourceForProps(props, false),
      showIgnored: false,
    }
  }

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.tlfs !== nextProps.tlfs || this.props.ignored !== nextProps.ignored) {
      this.setState({
        dataSource: this._dataSourceForProps(nextProps, false),
      })
    }
  }

  _dataSourceForProps(props: Props, showIgnored: boolean) {
    const ds = new NativeListView.DataSource({
      rowHasChanged: (r1, r2) => r1 !== r2,
      sectionHeaderHasChanged: (s1, s2) => s1 !== s2,
    })
    if (showIgnored) {
      return ds.cloneWithRowsAndSections({
        tlfs: props.tlfs || [],
        ignoredToggle: [{enabled: true}],
        ignored: props.ignored || [],
      })
    } else {
      return ds.cloneWithRowsAndSections({
        tlfs: props.tlfs || [],
        ignoredToggle: [{enabled: false}],
        ignored: [],
      })
    }
  }

  _onIgnoredToggle = () => {
    const showIgnored = !this.state.showIgnored
    this.setState({
      dataSource: this._dataSourceForProps(this.props, showIgnored),
      showIgnored,
    })
  }

  _renderIgnoredToggleRow = (row: any) => {
    const styles = this.props.isPublic ? stylesPublic : stylesPrivate
    const caretIcon: IconType = row.enabled ? 'iconfont-caret-down' : 'iconfont-caret-right'
    return (
      <Box style={stylesIgnoreContainer}>
        <ClickableBox onClick={this._onIgnoredToggle}>
          <Box style={styles.topBox}>
            <Text type="BodySmallSemibold" style={styles.dividerText}>
              Ignored folders
            </Text>
            <Icon
              type={caretIcon}
              style={{
                ...stylesIgnoreCaret,
                color: this.props.isPublic ? globalColors.black_40 : globalColors.white_40,
              }}
            />
          </Box>
        </ClickableBox>
        {row.enabled &&
          <Box style={styles.bottomBox}>
            <Text type="BodySmallSemibold" style={styles.dividerBodyText}>
              Ignored folders won't show up on your computer and you won't receive alerts about them.
            </Text>
          </Box>}
      </Box>
    )
  }

  _renderRow = (row, sectionID, rowID) => {
    if (sectionID === 'ignoredToggle') {
      return this._renderIgnoredToggleRow(row)
    }
    return (
      <Row
        key={rowKey(row.users)}
        {...row}
        isPublic={this.props.isPublic}
        ignored={sectionID === 'ignored'}
        onClick={this.props.onClick}
      />
    )
  }

  render() {
    return (
      <NativeListView
        enableEmptySections={true}
        dataSource={this.state.dataSource}
        renderRow={this._renderRow}
      />
    )
  }
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
