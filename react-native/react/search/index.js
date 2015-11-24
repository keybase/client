import React, {Component, ListView, StyleSheet, TouchableHighlight, Text, TextInput, View, Image} from '../base-react'
import {connect} from '../base-redux'
import {selectService, submitSearch} from '../actions/search'
import {pushNewProfile} from '../actions/profile'
import commonStyles from '../styles/common'
import Immutable from 'immutable'
import ScopeBar from './scope-bar'
import {services as serviceIcons} from '../constants/images'

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

class Search extends Component {
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
    const summary = this.props.profile.getIn([rowData.get('username'), 'summary'], Immutable.Map())
    const thumbnail = summary.get('thumbnail')
    const fullName = summary.get('fullName')
    const socialProofs = summary.getIn(['proofs', 'social'], Immutable.List())
    const matchingProof = socialProofs.find(val => val.get('proofName').toLowerCase().indexOf(this.props.term.toLowerCase()) !== -1)
    return (
      <View>
        <TouchableHighlight underlayColor='#ccc' onPress={() => { this.onPress(rowData) }}>
          <View style={{flexDirection: 'row'}}>
            <View style={styles.photoWrapper}>
              {thumbnail ? <Image style={styles.photo} source={{uri: thumbnail}}/> : null}
            </View>
            {rowData.get('tracking') ? <View style={styles.trackingIndicator} /> : null}
            <View style={{flex: 1}}>
              <View style={styles.username}>
                {renderTextWithHighlight(rowData.get('username'), this.props.term, styles.highlight)}
              </View>
              {fullName ? (
                <Text style={styles.fullName}>
                  {renderTextWithHighlight(fullName, this.props.term, styles.highlight)}
                </Text>
              ) : null}
              <View style={styles.services}>
                {socialProofs.map(proof => <View key={proof.get('proofType')} style={styles.service}>
                    <Image style={styles.serviceIcon} source={serviceIcons[proof.get('proofType')]}/>
                    {proof === matchingProof && (
                      <Text style={styles.serviceName}>
                        {renderTextWithHighlight(proof.get('proofName'), this.props.term, styles.highlight)}
                      </Text>
                    )}
                </View>).toArray()}
              </View>
            </View>
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
          onChangeText={search => this.onInput(search)}
        />
        <View style={styles.divider}/>
        <ListView style={{flex: 1}}
          dataSource={this.dataSource.cloneWithRows((this.props.results || Immutable.List()).toArray())}
          renderHeader={() => <View>
            <ScopeBar
              selectedService={this.props.service}
              onSelectService={service => this.props.selectService(this.props.base, service)}
            />
            <View style={styles.divider}/>
          </View>}
          renderRow={(...args) => { return this.renderRow(...args) }}
          keyboardDismissMode='on-drag'
          pageSize={20}
        />
      </View>
    )
  }

  static parseRoute (_, uri) {
    const base = uri.pop()
    return {componentAtTop: {props: {base}}}
  }
}

Search.propTypes = {
  submitSearch: React.PropTypes.func.isRequired,
  pushNewProfile: React.PropTypes.func.isRequired,
  base: React.PropTypes.object.isRequired,
  term: React.PropTypes.string,
  service: React.PropTypes.string,
  results: React.PropTypes.object,
  error: React.PropTypes.object,
  waitingForServer: React.PropTypes.bool.isRequired,
  profile: React.PropTypes.object.isRequired,
  selectService: React.PropTypes.func.isRequired
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
    flex: 1,
    paddingTop: 5,
    paddingBottom: 3,
    paddingRight: 1
  },
  fullName: {
    position: 'absolute',
    top: 10,
    right: 10
  },
  highlight: {
    fontWeight: 'bold'
  },
  services: {
    flexDirection: 'row'
  },
  service: {
    flexDirection: 'row',
    marginRight: 5,
    alignItems: 'center'
  },
  serviceIcon: {
    width: 20,
    height: 20,
    borderRadius: 10
  },
  serviceName: {
    fontSize: 11,
    marginLeft: 3
  }
})

export default connect(
  state => state,
  dispatch => {
    return {
      submitSearch: (base, search) => dispatch(submitSearch(base, search)),
      pushNewProfile: username => dispatch(pushNewProfile(username)),
      selectService: (base, service) => dispatch(selectService(base, service))
    }
  },
  (stateProps, dispatchProps, ownProps) => {
    return {
      ...ownProps,
      ...{
        profile: stateProps.profile,
        ...stateProps.search.get(ownProps.base).toObject()
      },
      ...dispatchProps
    }
  }
)(Search)
