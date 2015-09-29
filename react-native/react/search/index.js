'use strict'
/* @flow */

import React from 'react-native'
import {
  ActivityIndicatorIOS,
  Component,
  ListView,
  StyleSheet,
  Text,
  TextInput,
  TouchableHighlight,
  View
} from 'react-native'

import * as SearchActions from '../actions/search'
import commonStyles from '../styles/common'

class Search extends Component {
  constructor (props) {
    super(props)

    this.state = {
      search: props.term,
      ...this.buildDataSource(props)
    }
  }

  buildDataSource (props) {
    const ds = new ListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2})

    const results = !props.results ? [] : props.results.map((s) => {
      const row1 = `${s.username}${this.componentName(s)}on Keybase`
      const row2 = s.components.map(c => this.componentText(c)).filter(c => c).join(' | ')
      return { row1, row2 }
    })

    return { dataSource: ds.cloneWithRows(results) }
  }

  componentName (s) {
    return s.components.filter(c => c.key === 'full_name').map(c => ` [${c.value}] `).join('')
  }

  componentText (c) {
    switch (c.key) {
      case 'username':
      case 'full_name':
        return null
      case 'key_fingerprint':
        return `PGP: ${c.value.substring(0, 5)}...`
      default:
        return `${c.value}@${c.key}`
    }
  }

  componentWillReceiveProps (nextProps) {
    if (nextProps.results !== this.props.results) {
      this.setState(this.buildDataSource(nextProps))
    }
  }

  renderRow (rowData, sectionID, rowID) {
    const sep = (rowID < (this.state.dataSource.getRowCount() - 1)) ? <View style={commonStyles.separator} /> : null

    return (
      <TouchableHighlight
        underlayColor={commonStyles.buttonHighlight}
        onPress={() => {}}>
        <View>
          <View style={{margin: 10}}>
            <Text style={{}}>{rowData.row1}</Text>
            <Text style={{fontSize: 10}}>{rowData.row2}</Text>
          </View>
          {sep}
        </View>
      </TouchableHighlight>
    )
  }

  onSubmit () {
    this.props.dispatch(SearchActions.submitSearch(this.props.base, this.state.search))
  }

  render () {
    const activity = this.props.waitingForServer ? (
      <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
        <ActivityIndicatorIOS
        animating
        style={{height: 80}}
        size='large'
        />
      </View>
    ) : null

    const button = !this.props.waitingForServer ? (
      <TouchableHighlight
        style={{width: 100}}
        underlayColor={commonStyles.buttonHighlight}
        onPress={ () => this.onSubmit() }>
        <Text style={[commonStyles.actionButton, {width: 100}]}>Search</Text>
      </TouchableHighlight>
    ) : null

    return (
      <View style={styles.container}>
        <TextInput
          style={styles.input}
          placeholder='Search'
          value={this.state.search}
          enablesReturnKeyAutomatically
          returnKeyType='next'
          autoCorrect={false}
          onChangeText={(search) => { this.setState({search}) }}
          onEndEditing={() => this.onSubmit()}
        />
        {activity}{button}
        <ListView style={{flex: 1}}
          dataSource={this.state.dataSource}
          renderRow={(...args) => { return this.renderRow(...args) }}
        />
      </View>
    )
  }
  static canParseNextRoute (currentPath) {
    return currentPath.get('path') === 'search'
  }

  static parseRoute (store, currentPath, nextPath, uri) {
    const base = uri.pop()
    return {
      componentAtTop: {
        component: Search,
        mapStateToProps: (state) => state.search[base]
      },
      parseNextRoute: null
    }
  }
}

function mapStateToGetURI (state) {
  var uri = SearchActions.getCurrentRoute(state)
  return state.search[uri]
}

Search.propTypes = {
  dispatch: React.PropTypes.func.isRequired,
  base: React.PropTypes.string.isRequired,
  results: React.PropTypes.array,
  waitingForServer: React.PropTypes.bool.isRequired
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    backgroundColor: '#F5FCFF',
    marginTop: 64
  },
  input: {
    height: 40,
    marginBottom: 5,
    marginLeft: 10,
    marginRight: 10,
    borderWidth: 0.5,
    borderColor: '#0f0f0f',
    fontSize: 13,
    padding: 4
  },
  submitWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10
  }
})

export default Search
