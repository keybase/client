'use strict'
/* @flow */

import { submitSearch } from '../actions/search'
import { pushNewProfile } from '../actions/profile'
import React, { Component, ListView, StyleSheet, TouchableHighlight, Text, TextInput, View, Image } from 'react-native'
import commonStyles from '../styles/common'
import Immutable from 'immutable'

function renderTextWithHighlight (text, highlight, style) {
  const idx = text.toLowerCase().indexOf(highlight.toLowerCase())
  if (idx === -1) {
    return <Text>{text}</Text>
  }
  return (
    <Text>
      {text.substr(0, idx)}
      <Text style={style}>
        {text.substr(idx, highlight.length)}
      </Text>
      {text.substr(idx + highlight.length)}
    </Text>
  )
}

export default class Search extends Component {
  constructor (...args) {
    super(...args)
    this.dataSource = new ListView.DataSource({
      rowHasChanged: (r1, r2) => r1 !== r2
    })
  }

  onPress (rowData) {
    this.props.pushNewProfile(rowData.get('username'))
  }

  renderRow (rowData, sectionID, rowID) {
    const profile = this.props.profile.get(rowData.get('username'), Immutable.Map())
    const thumbnail = profile.getIn(['summary', 'thumbnail'])
    const fullName = profile.getIn(['summary', 'fullName'])
    return (
      <View>
        <TouchableHighlight underlayColor='#ccc' onPress={() => { this.onPress(rowData) }}>
          <View style={{flexDirection: 'row'}}>
            <View style={styles.photoWrapper}>
              {thumbnail ? <Image style={styles.photo} source={{uri: thumbnail}}/> : null}
            </View>
            {rowData.get('tracking') ? <View style={styles.trackingIndicator} /> : null}
            <View style={styles.username}>
              {renderTextWithHighlight(rowData.get('username'), this.props.term, styles.highlight)}
            </View>
            {fullName ? <Text style={styles.fullName}>
              {renderTextWithHighlight(fullName, this.props.term, styles.highlight)}
            </Text> : null}
          </View>
        </TouchableHighlight>
        {this.renderSeparator()}
      </View>
    )
  }

  renderSeparator () {
    return <View style={commonStyles.separator} />
  }

  onInput (search) {
    this.props.submitSearch(this.props.base, search)
  }

  render () {
    return (
      <View style={styles.container}>
        <TextInput
          style={styles.input}
          placeholder='Search'
          value={this.props.term}
          enablesReturnKeyAutomatically
          returnKeyType='next'
          autoCorrect={false}
          autoCapitalize='none'
          autoFocus
          clearButtonMode='always'
          onChangeText={(search) => this.onInput(search)}
        />
        <View style={styles.divider}/>
        <ListView style={{flex: 1}}
          dataSource={this.dataSource.cloneWithRows((this.props.results || Immutable.List()).toArray())}
          renderRow={(...args) => { return this.renderRow(...args) }}
          keyboardDismissMode='on-drag'
          pageSize={20}
        />
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath, uri) {
    const base = uri.pop()
    return {
      componentAtTop: {
        mapStateToProps: (state) => ({
          ...state.search.get(base).toObject(),
          profile: state.profile
        }),
        props: {
          submitSearch: (base, search) => store.dispatch(submitSearch(base, search)),
          pushNewProfile: username => store.dispatch(pushNewProfile(username))
        }
      }
    }
  }
}

Search.propTypes = {
  submitSearch: React.PropTypes.func.isRequired,
  pushNewProfile: React.PropTypes.func.isRequired,
  base: React.PropTypes.object.isRequired,
  term: React.PropTypes.string,
  results: React.PropTypes.object,
  error: React.PropTypes.object,
  waitingForServer: React.PropTypes.bool.isRequired,
  profile: React.PropTypes.object.isRequired
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    backgroundColor: '#F5FCFF'
  },
  divider: {
    height: 0.5,
    backgroundColor: '#0f0f0f'
  },
  input: {
    height: 40,
    borderBottomWidth: 0.5,
    fontSize: 13,
    padding: 10
  },
  submitWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10
  },
  photoWrapper: {
    width: 32,
    height: 32,
    overflow: 'hidden',
    borderRadius: 16,
    margin: 10,
    backgroundColor: 'grey'
  },
  photo: {
    width: 32,
    height: 32
  },
  trackingIndicator: {
    backgroundColor: 'red',
    width: 10,
    height: 10,
    borderRadius: 5,
    position: 'absolute',
    bottom: 10,
    left: 10
  },
  username: {
    height: 10,
    flex: 1,
    paddingVertical: 10,
    paddingRight: 1
  },
  fullName: {
    position: 'absolute',
    top: 10,
    right: 10
  },
  highlight: {
    fontWeight: 'bold'
  }
})
