import React, {Component, Text, View} from '../../base-react'
import commonStyles from '../../styles/common'

export default class GenPaperKeyRender extends Component {
  render () {
    return (
      <View style={{flex: 1}}>
        <Text style={commonStyles.h1}>Generate a new paper key</Text>
        <Text style={[commonStyles.h2, {marginTop: 20}]}>Here is your paper key for Keybase. Please write this down on a piece of paper and keep it somewhere safe, as this will be used to lorem ipsum leorem</Text>
        <View style={{backgroundColor: 'grey', padding: 20, margin: 20, marginTop: 40, flexDirection: 'row', alignItems: 'center'}}>
          <Text style={{marginRight: 20, height: 60, textAlign: 'center'}}>[Icon]</Text>
          {this.props.paperKey && <Text style={{flex: 1}}>{this.props.paperKey}</Text>}
          {!this.props.paperKey && <Text>Loading...</Text>}
        </View>
      </View>
    )
  }
}

GenPaperKeyRender.propTypes = {
  paperKey: React.PropTypes.string
}
