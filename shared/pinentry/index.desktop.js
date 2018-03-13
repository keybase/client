// @flow
import React, {Component} from 'react'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {autoResize} from '../desktop/remote/util'
import {Button, FormWithCheckbox, Header, Text, Box, Icon} from '../common-adapters'
import * as RPCTypes from '../constants/types/rpc-gen'

export type Props = {
  onSubmit: (passphrase: string) => void,
  onCancel: () => void,
  showTyping: RPCTypes.Feature,
  type: RPCTypes.PassphraseType,
  prompt: string,
  retryLabel?: string,
  submitLabel?: string,
}

type DefaultProps = {
  retryLabel: ?string,
  submitLabel: string,
}

type State = {
  passphrase: string,
  showTyping: boolean,
}

class Pinentry extends Component<Props, State> {
  static defaultProps: DefaultProps
  state: State

  constructor(props: Props) {
    super(props)

    this.state = {
      passphrase: '',
      showTyping: this.props.showTyping.defaultValue,
    }
  }

  _onCheck = (showTyping: boolean) => {
    this.setState({showTyping})
  }

  _onSubmit = () => {
    this.props.onSubmit(this.state.passphrase)
    this.setState({passphrase: ''})
  }

  componentDidMount() {
    autoResize()
  }

  render() {
    const isPaperKey = this.props.type === RPCTypes.passphraseCommonPassphraseType.paperKey
    const typeStyle: $Shape<{
      hintText: string,
      style: Object,
      multiline: boolean,
      rowsMax: number,
      floatingHintTextOverride: string,
    }> = {
      [RPCTypes.passphraseCommonPassphraseType.verifyPassPhrase]: {
        hintText: 'Verify Passphrase',
        style: {marginBottom: 0},
      },
      [RPCTypes.passphraseCommonPassphraseType.passPhrase]: {
        hintText: 'Passphrase',
        style: {marginBottom: 0},
      },
      [RPCTypes.passphraseCommonPassphraseType.paperKey]: {
        floatingHintTextOverride: 'Paperkey',
        multiline: true,
        rowsMax: 2,
        hintText:
          'elephont sturm cectus opp blezzard tofi pando agg whi pany yaga jocket daubt ruril globil cose',
      },
    }[this.props.type]

    const checkboxContainerStyle = {
      [RPCTypes.passphraseCommonPassphraseType.verifyPassPhrase]: null,
      [RPCTypes.passphraseCommonPassphraseType.passPhrase]: null,
      [RPCTypes.passphraseCommonPassphraseType.paperKey]: {bottom: 0},
    }[this.props.type]

    return (
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          backgroundColor: globalColors.white,
          paddingBottom: globalMargins.medium,
        }}
      >
        <Header icon={true} title="" onClose={this.props.onCancel} />
        <Box style={{...globalStyles.flexBoxColumn, paddingLeft: 30, paddingRight: 30}}>
          <Text type="Body" style={{textAlign: 'center'}}>
            {this.props.prompt}
          </Text>
          {isPaperKey && <Icon type="icon-paper-key-48" style={{alignSelf: 'center'}} />}
          <FormWithCheckbox
            inputProps={{
              autoFocus: true,
              errorText: this.props.retryLabel,
              onChangeText: passphrase => this.setState({passphrase}),
              onEnterKeyDown: this._onSubmit,
              type: this.state.showTyping ? 'passwordVisible' : 'password',
              value: this.state.passphrase,
              ...typeStyle,
            }}
            checkboxContainerStyle={{paddingLeft: 60, paddingRight: 60, ...checkboxContainerStyle}}
            checkboxesProps={
              this.props.showTyping && this.props.showTyping.allow
                ? [
                    {
                      checked: this.state.showTyping,
                      key: 'showTyping',
                      label: this.props.showTyping.label,
                      name: 'showTyping',
                      onCheck: this._onCheck,
                      style: checkboxStyle,
                    },
                  ]
                : []
            }
          />
          <Button
            style={{alignSelf: 'center'}}
            type="Primary"
            label={this.props.submitLabel}
            onClick={this._onSubmit}
            disabled={!this.state.passphrase}
          />
        </Box>
      </Box>
    )
  }
}

Pinentry.defaultProps = {
  retryLabel: null,
  submitLabel: 'Continue',
}

const checkboxStyle = {
  zIndex: 9999,
  color: globalColors.black,
  marginLeft: 10,
}

export default Pinentry
