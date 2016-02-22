import React, {Component} from 'react'
import {globalStyles, globalColors} from '../styles/style-guide'
import {autoResize} from '../../desktop/renderer/remote-component-helper'
import {Checkbox, Header, Input, Text, Button} from '../common-adapters'

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

    return (
      <div style={{...globalStyles.flexBoxColumn, alignItems: 'center', justifyContent: 'center', backgroundColor: 'blue'}}>
        <div style={styles.container}>
          <Header
            icon
            title={this.props.windowTitle}
            onClose={() => this.props.onCancel()}
          />
          <div style={styles.body}>
            <Text type='Body'>{this.props.prompt}</Text>
            <div style={styles.checkContainer}>
              {Object.keys(this.props.features).map(feature => {
                return (
                  <Checkbox
                    style={styles.checkbox}
                    key={feature}
                    name={feature}
                    checked={this.state.features[feature]}
                    label={this.props.features[feature].label}
                    onCheck={checked => this.onCheck(feature, checked)}/>
                )
              })}
            </div>
            <Input
              errorText={this.props.retryLabel}
              style={styles.input}
              onChange={e => this.setState({passphrase: e.target.value})}
              value={this.state.passphrase}
              type={this.state.showTyping ? 'text' : 'password'}
              onEnterKeyDown={submitPassphrase}
              floatingLabelText='Your passphrase'
              autoFocus
            />
          </div>
          <div style={styles.action}>
            <Button type='Secondary' label={this.props.cancelLabel || 'Cancel'} onClick={() => this.props.onCancel()} />
            <Button type='Primary' label={this.props.submitLabel || 'Close'} onClick={submitPassphrase} />
          </div>
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
    ...globalStyles.fontRegular,
    backgroundColor: 'white',
    fontSize: 15,
    width: 513
  },
  body: {
    ...globalStyles.flexBoxColumn,
    padding: 20,
    backgroundColor: globalColors.grey5,
    position: 'relative'
  },
  action: {
    ...globalStyles.flexBoxRow,
    justifyContent: 'flex-end',
    alignItems: 'center',
    height: 50,
    padding: 10
  },
  checkContainer: {
    ...globalStyles.flexBoxRow,
    justifyContent: 'flex-end',
    marginTop: 22,
    marginBottom: 2,
    flex: 1
  },
  checkbox: {
    ...globalStyles.topMost,
    color: globalColors.black,
    marginLeft: 10
  },
  input: {
    marginTop: -35
  }
}
