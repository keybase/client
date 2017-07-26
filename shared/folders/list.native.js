// @flow
import React, {Component} from 'react'
import Row from './row'
import type {IconType} from '../common-adapters/icon'
import type {Props} from './list'
import {Box, Text, Icon, ClickableBox} from '../common-adapters/index'
import {NativeListView} from '../common-adapters/index.native'
import {globalStyles, globalColors, globalMargins} from '../styles'

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
    const headingColor = row.enabled ? globalColors.black_60 : globalColors.black_40
    return (
      <Box style={stylesIgnoreContainer}>
        <ClickableBox onClick={this._onIgnoredToggle}>
          <Box style={styles.topBox}>
            <Text type="BodySmallSemibold" style={{color: headingColor}}>Ignored folders</Text>
            <Icon
              type={caretIcon}
              style={{
                ...stylesIgnoreCaret,
                color: headingColor,
                marginLeft: globalMargins.xtiny,
              }}
            />
          </Box>
        </ClickableBox>
        {row.enabled &&
          <Box style={styles.bottomBox}>
            <Text type="BodySmall" style={{textAlign: 'center'}}>
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
  marginLeft: globalMargins.large,
  marginRight: globalMargins.large,
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
  fontSize: 10,
}

const stylesPrivate = {
  topBox: {
    ...stylesIgnoreDivider,
    backgroundColor: globalColors.white,
  },
  dividerText: {
    ...stylesDividerText,
  },
  dividerBodyText: {
    ...stylesDividerBodyText,
  },
  bottomBox: {
    ...stylesIgnoreDesc,
    backgroundColor: globalColors.white,
  },
}

const stylesPublic = {
  topBox: {
    ...stylesIgnoreDivider,
    backgroundColor: globalColors.white,
  },
  dividerText: {
    ...stylesDividerText,
  },
  dividerBodyText: {
    ...stylesDividerBodyText,
  },
  bottomBox: {
    ...stylesIgnoreDesc,
    backgroundColor: globalColors.white,
  },
}
export default ListRender
