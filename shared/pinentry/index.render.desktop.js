// @flow

import React, {Component} from 'react'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {autoResize} from '../desktop/renderer/remote-component-helper'
import {Button, FormWithCheckbox, Header, Text, Box, Icon} from '../common-adapters'
import {PassphraseCommonPassphraseType} from '../constants/types/flow-types'
import type {Props, DefaultProps} from './index.render'

type State = {
  features: {[key: string]: boolean},
  passphrase: string,
  showTyping: boolean,
}

export default class PinentryRender extends Component<DefaultProps, Props, State> {
  static defaultProps: DefaultProps
  state: State

  constructor(props: Props) {
    super(props)

    const state = {
      passphrase: '',
      features: {},
      showTyping: false,
    }
    for (const feature in this.props.features) {
      state.features[feature] = this.props.features[feature].defaultValue

      if (feature === 'showTyping') {
        state.showTyping = this.props.features[feature].defaultValue
      }
    }

    this.state = state
  }

  onCheck(feature: string, checked: boolean) {
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

  componentDidMount() {
    autoResize()
  }

  render() {
    const submitPassphrase = () => this.props.onSubmit(this.state.passphrase, this.state.features)

    const isPaperKey = this.props.type === PassphraseCommonPassphraseType.paperKey
    const typeStyle: $Shape<{
      hintText: string,
      style: Object,
      multiline: boolean,
      rowsMax: number,
      floatingHintTextOverride: string,
    }> = {
      [PassphraseCommonPassphraseType.verifyPassPhrase]: {
        hintText: 'Verify Passphrase',
        style: {marginBottom: 0},
      },
      [PassphraseCommonPassphraseType.passPhrase]: {
        hintText: 'Passphrase',
        style: {marginBottom: 0},
      },
      [PassphraseCommonPassphraseType.paperKey]: {
        floatingHintTextOverride: 'Paperkey',
        multiline: true,
        rowsMax: 2,
        hintText:
          'elephont sturm cectus opp blezzard tofi pando agg whi pany yaga jocket daubt ruril globil cose',
      },
    }[this.props.type]

    const checkboxContainerStyle = {
      [PassphraseCommonPassphraseType.verifyPassPhrase]: null,
      [PassphraseCommonPassphraseType.passPhrase]: null,
      [PassphraseCommonPassphraseType.paperKey]: {bottom: 0},
    }[this.props.type]

    const inputProps = {
      onChangeText: passphrase => this.setState({passphrase}),
      onEnterKeyDown: () => submitPassphrase(),
      type: this.state.showTyping ? 'passwordVisible' : 'password',
      errorText: this.props.retryLabel,
      autoFocus: true,
      ...typeStyle,
    }

    const checkboxProps = (Object.keys(this.props.features) || []).map(feature => {
      return {
        label: this.props.features[feature].label,
        checked: this.state.features[feature],
        key: feature,
        name: feature,
        style: checkboxStyle,
        onCheck: checked => this.onCheck(feature, checked),
      }
    })

    return (
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          backgroundColor: globalColors.white,
          paddingBottom: globalMargins.medium,
        }}
      >
        <Header icon={true} title="" onClose={() => this.props.onCancel()} />
        <Box style={{...globalStyles.flexBoxColumn, paddingLeft: 30, paddingRight: 30}}>
          <Text type="Body" style={{textAlign: 'center'}}>
            {this.props.prompt}
          </Text>
          {isPaperKey && <Icon type="icon-paper-key-48" style={{alignSelf: 'center'}} />}
          <FormWithCheckbox
            inputProps={inputProps}
            checkboxContainerStyle={{paddingLeft: 60, paddingRight: 60, ...checkboxContainerStyle}}
            checkboxesProps={checkboxProps}
          />
          <Button
            style={{alignSelf: 'center'}}
            type="Primary"
            label={this.props.submitLabel}
            onClick={submitPassphrase}
            disabled={!this.state.passphrase}
          />
        </Box>
      </Box>
    )
  }
}

PinentryRender.defaultProps = {
  retryLabel: null,
  submitLabel: 'Continue',
}

const checkboxStyle = {
  ...globalStyles.topMost,
  color: globalColors.black,
  marginLeft: 10,
}
