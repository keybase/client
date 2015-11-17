'use strict'

import React, {Component, Text, View, StyleSheet} from '../../base-react'
import {connect} from '../../base-redux'
import commonStyles from '../../styles/common'
import {generatePaperKey} from '../../actions/devices'

class GenPaperKey extends Component {
  constructor (props) {
    super(props)

    this.props.generatePaperKey()
  }

  render () {
    return (
      <View style={{flex: 1}}>
        <Text style={commonStyles.h1}>Generate a new paper key</Text>
        <Text style={[commonStyles.h2, {marginTop: 20}]}>Here is your paper key for Keybase. Please write this down on a piece of paper and keep it somewhere safe, as this will be used to lorem ipsum leorem</Text>
        <View style={styles.paperKey}>
          <Text style={{marginRight: 20, height: 60, textAlign: 'center'}}>[Icon]</Text>
          {this.props.paperKey && <Text style={{flex: 1}}>{this.props.paperKey}</Text>}
          {!this.props.paperKey && <Text>Loading...</Text>}
        </View>
      </View>
    )
  }

  static parseRoute () {
    return {componentAtTop: {}}
  }
}

GenPaperKey.propTypes = {
  generatePaperKey: React.PropTypes.func.isRequired,
  paperKey: React.PropTypes.string
}

const styles = StyleSheet.create({
  paperKey: {
    backgroundColor: 'grey',
    padding: 20,
    margin: 20,
    marginTop: 40,
    flexDirection: 'row',
    alignItems: 'center'
  }
})

export default connect(
  state => {
    const {paperKey} = state.devices
    return {paperKey}
  },
  dispatch => {
    return {
      generatePaperKey: () => dispatch(generatePaperKey())
    }
  }
)(GenPaperKey)
