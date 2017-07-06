// @flow
import React, {Component} from 'react'
import {ClickableBox, NativeListView, Box, Text} from '../common-adapters/index.native'
import {globalStyles} from '../styles'

import type {Props, MenuListItem} from './menu-list'

type State = {
  dataSource: any,
}

export default class MenuList extends Component<void, Props, State> {
  state: State

  componentWillMount() {
    const ds = new NativeListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2})
    this.state = {
      dataSource: ds.cloneWithRows(this.props.items),
    }
  }

  renderRow(rowData: MenuListItem) {
    return (
      <ClickableBox onClick={rowData.onClick}>
        <Box style={{margin: 10, ...globalStyles.flexBoxRow, flex: 1}}>
          <Text type="BodySmall">
            {rowData.name}
          </Text>
          <Text type="BodySmall" style={{flex: 1}}>
            {rowData.hasChildren ? '>' : ''}
          </Text>
        </Box>
      </ClickableBox>
    )
  }

  render() {
    return (
      <Box style={styles.container}>
        <NativeListView
          dataSource={this.state.dataSource}
          renderRow={(rowData, sectionID, rowID) => {
            return this.renderRow(rowData)
          }}
        />
      </Box>
    )
  }
}

const styles = {
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    backgroundColor: '#F5FCFF',
  },
}
