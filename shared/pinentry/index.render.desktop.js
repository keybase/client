// @flow

import React, {Component} from 'react'
import {globalStyles, globalColors} from '../styles/style-guide'
import {autoResize} from '../../desktop/renderer/remote-component-helper'
import {Button, FormWithCheckbox, Header, Text} from '../common-adapters'

import type {Props, DefaultProps} from './index.render'

type State = {
  features: {[key: string]: boolean},
  passphrase: string,
  showTyping: boolean
}

export default class PinentryRender extends Component<DefaultProps, Props, State> {
  static defaultProps: DefaultProps;
  state: State;

  constructor (props: Props) {
    super(props)

    this.state = {
      passphrase: '',
      features: {},
      showTyping: false,
    }
    for (const feature in this.props.features) {
      this.state.features[feature] = this.props.features[feature].defaultValue

      if (feature === 'showTyping') {
        this.state.showTyping = this.props.features[feature].defaultValue
      }
    }
  }

  onCheck (feature: string, checked: boolean) {
    this.setState({
      features: {
        ...this.state.features,
        [feature]: checked,
      },
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
      floatingLabelText: 'Passphrase',
      style: {marginBottom: 0},
      onChange: event => this.setState({passphrase: event.target.value}),
      onEnterKeyDown: () => submitPassphrase(),
      type: this.state.showTyping ? 'passwordVisible' : 'password',
      errorText: this.props.retryLabel,
      autoFocus: true,
    }

    const checkboxProps = Object.keys(this.props.features).map(feature => {
      return ({
        label: this.props.features[feature].label,
        checked: this.state.features[feature],
        key: feature,
        name: feature,
        style: styles.checkbox,
        onCheck: checked => this.onCheck(feature, checked),
      })
    })

    return (
      <div>
        <Header icon title='' onClose={() => this.props.onCancel()} />
        <div style={{...styles.container, textAlign: 'center', paddingLeft: 30, paddingRight: 30}}>
          <Text type='Body'>{this.props.prompt}</Text>
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
          <Button type='Primary' label={this.props.submitLabel} onClick={submitPassphrase} disabled={!this.state.passphrase} />
        </div>
      </div>
    )
  }
}

PinentryRender.defaultProps = {
  retryLabel: null,
  submitLabel: 'Continue',
}

const styles = {
  container: {
    ...globalStyles.flexBoxColumn,
    backgroundColor: globalColors.white,
  },
  checkbox: {
    ...globalStyles.topMost,
    color: globalColors.black,
    marginLeft: 10,
  },
}
