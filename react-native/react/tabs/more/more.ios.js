'use strict'

import BaseComponent from '../base-component'
import * as LoginActions from '../../actions/login'
import * as SearchActions from '../../actions/search'
import { navigateTo } from '../../actions/router'
import { pushNewProfile } from '../../actions/profile'
//import Button from '../../common-adapters/button'
import { List, ListItem, RaisedButton } from 'material-ui'

export default class More extends BaseComponent {
  constructor (props) {
    super(props)
  }

  renderRow (rowData, sectionID, rowID) {
    const sep = (rowID < (this.state.dataSource.getRowCount() - 1)) ? <View style={commonStyles.separator} /> : null

    return (
      <Button onPress={rowData.onClick}>
        <View>
          <View style={{margin: 10, flexDirection: 'row', flex: 1, justifyContent: 'space-between'}}>
            <Text>{rowData.name}</Text>
            <Text>{rowData.hasChildren ? '>' : ''}</Text>
          </View>
          {sep}
        </View>
      </Button>
    )
  }

  render () {
    return (
      <View style={styles.container}>
        <ListView
        dataSource={this.state.dataSource}
        renderRow={(...args) => { return this.renderRow(...args) }}
        />
      </View>
    )
  }
}
