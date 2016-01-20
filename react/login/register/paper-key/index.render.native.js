import React, {Component, StyleSheet, Text, TextInput, View} from '../../../base-react'
import commonStyles from '../../../styles/common'
import Button from '../../../common-adapters/button'

export default class PaperKeyRender extends Component {
  render () {
    return (
      <View style={[styles.container, {backgroundColor: 'red', paddingTop: 200}]}>
        <Text style={[commonStyles.h1, {padding: 10}]}>Register with a paper key</Text>
        <Text style={[commonStyles.h2, {padding: 10, marginBottom: 20}]}>Lorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsum Lorem ipsum </Text>
        <TextInput style={commonStyles.textInput}
          value={this.props.paperKey}
          placeholder='Enter your paper key'
          onSubmitEditing={() => this.props.onSubmit()}
          onChangeText={paperKey => this.props.onChangePaperKey(paperKey)}
        />
        <Button
          style={{alignSelf: 'flex-end', marginRight: 10}}
          onPress={() => this.props.onSubmit()}
          title='Submit & Log in'
          enabled={this.props.paperKey}/>
      </View>
    )
  }
}

PaperKeyRender.propTypes = {
  onSubmit: React.PropTypes.func.isRequired,
  onChangePaperKey: React.PropTypes.func.isRequired,
  paperKey: React.PropTypes.string
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'flex-start'
  }
})
