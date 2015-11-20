import React, {Component, StyleSheet} from '../../../base-react'
import {TextField, RaisedButton} from 'material-ui'

export default class PaperKeyRender extends Component {
  render () {
    return (
      <div style={styles.container}>
        <h1>Register with a paper key</h1>
        <h2>Lorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsum Lorem ipsum </h2>
        <TextField
          style={{width: '100%'}}
          hintText='Enter your paper key'
          floatingLabelText='Paper Key'
          onEnterKeyDown={() => this.props.onSubmit()}
          ref='paperKey'
          onChange={event => this.props.onChangePaperKey(event.target.value)}
          value={this.props.paperKey}
        />
        <RaisedButton
          style={{alignSelf: 'flex-end', marginTop: 20}}
          label='Submit & Log in'
          primary
          onClick={() => this.props.onSubmit()}
          enabled={this.props.paperKey}
        />
      </div>
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
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch'
  }
})
