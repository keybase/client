import React, {Component} from 'react'
import {globalStyles, globalColorsDZ2} from '../styles/style-guide'
import {autoResize} from '../../desktop/renderer/remote-component-helper'
import {Button, FormWithCheckbox, Header, Text} from '../common-adapters'

export default class PinentryRender extends Component {
  constructor (props) {
    super(props)

    this.state = {
      passphrase: '',
      features: {},
      showTyping: false
    }
    for (const feature in this.props.features) {
      this.state.features[feature] = this.props.features[feature].defaultValue

      if (feature === 'showTyping') {
        this.state.showTyping = this.props.features[feature].defaultValue
      }
    }
  }

  onCheck (feature, checked) {
    this.setState({
      features: {
        ...this.state.features,
        [feature]: checked
      }
    })

    if (feature === 'showTyping') {
      this.setState({showTyping: checked})
    }
  }

  componentDidMount () {
    autoResize()
  }

  render () {
    const submitPassphrase = () => this.props.onSubmit(this.state.passphrase, this.state.features)

    const inputProps = {
      dz2: true,
      floatingLabelText: 'Passphrase',
      style: {marginBottom: 0},
      onChange: event => this.setState({passphrase: event.target.value}),
      onEnterKeyDown: () => submitPassphrase(),
      type: this.state.showTyping ? 'text' : 'password',
      errorText: this.props.retryLabel,
      autoFocus: true
    }

    const checkboxProps = Object.keys(this.props.features).map(feature => {
      return ({
        label: this.props.features[feature].label,
        checked: this.state.features[feature],
        key: feature,
        name: feature,
        style: styles.checkbox,
        onCheck: checked => this.onCheck(feature, checked)
      })
    })

    return (
      <div>
        <Header icon title='' onClose={() => this.props.onCancel()} />
        <div style={{...styles.container, textAlign: 'center', paddingLeft: 30, paddingRight: 30}}>
          <Text dz2 type='Body'>{this.props.prompt}</Text>
        </div>
        <div style={{...styles.container, alignItems: 'center', paddingLeft: 30, paddingRight: 30}}>
          <FormWithCheckbox
            style={{alignSelf: 'stretch'}}
            inputProps={inputProps}
            checkboxContainerStyle={{paddingLeft: 60, paddingRight: 60}}
            checkboxesProps={checkboxProps}
          />
        </div>
        <div style={{...styles.container, alignItems: 'flex-end', paddingLeft: 30, paddingRight: 30, paddingBottom: 30}}>
          <Button dz2 type='Primary' label='Continue' onClick={submitPassphrase} disabled={!this.state.passphrase}/>
        </div>
      </div>
    )
  }
}

PinentryRender.propTypes = {
  onSubmit: React.PropTypes.func.isRequired,
  onCancel: React.PropTypes.func.isRequired,
  features: React.PropTypes.object.isRequired,
  prompt: React.PropTypes.string.isRequired,
  retryLabel: React.PropTypes.string.isRequired,
  cancelLabel: React.PropTypes.string,
  submitLabel: React.PropTypes.string,
  windowTitle: React.PropTypes.string.isRequired
}

const styles = {
  container: {
    ...globalStyles.flexBoxColumn,
    backgroundColor: globalColorsDZ2.white
  },
  checkbox: {
    ...globalStyles.topMost,
    color: globalColorsDZ2.black100,
    marginLeft: 10
  }
}
