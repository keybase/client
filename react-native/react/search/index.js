'use strict'
/* @flow */

import React, { ActivityIndicatorIOS, Component, ListView, StyleSheet, Text, TextInput, View } from 'react-native'
import * as SearchActions from '../actions/search'
import commonStyles from '../styles/common'
import Button from '../common-adapters/button'

export default class Search extends Component {
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
      <Button>
        <View>
          <View style={{margin: 10}}>
            <Text style={{}}>{rowData.row1}</Text>
            <Text style={{fontSize: 10}}>{rowData.row2}</Text>
          </View>
          {sep}
        </View>
      </Button>
    )
  }

  onSubmit () {
    this.props.dispatch(SearchActions.submitSearch(this.props.base, this.state.search))
  }

  render () {
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
        {this.props.waitingForServer &&
          <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
            <ActivityIndicatorIOS
              animating
              style={{height: 80}}
              size='large'
            />
          </View>}
        {!this.props.waitingForServer &&
          <Button buttonStyle={[commonStyles.actionButton, {width: 100}]} onPress={ () => this.onSubmit() } title='Search' />}
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
