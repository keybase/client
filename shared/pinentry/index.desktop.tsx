import * as React from 'react'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {autoResize} from '../desktop/remote/util.desktop'
import {Button, FormWithCheckbox, Header, Text, Box, Icon} from '../common-adapters'
import * as RPCTypes from '../constants/types/rpc-gen'

export type Props = {
  onSubmit: (password: string) => void
  onCancel: () => void
  showTyping: RPCTypes.Feature
  type: RPCTypes.PassphraseType
  prompt: string
  retryLabel?: string
  submitLabel?: string
}

type DefaultProps = {
  retryLabel: string
  submitLabel: string
}

type State = {
  password: string
  showTyping: boolean
}

class Pinentry extends React.Component<Props, State> {
  static defaultProps: DefaultProps
  state: State

  constructor(props: Props) {
    super(props)

    this.state = {
      password: '',
      showTyping: this.props.showTyping.defaultValue,
    }
  }

  _onCheck = (showTyping: boolean) => {
    this.setState({showTyping})
  }

  _onSubmit = () => {
    this.props.onSubmit(this.state.password)
    this.setState({password: ''})
  }

  componentDidMount() {
    autoResize()
  }

  render() {
    const isPaperKey = this.props.type === RPCTypes.PassphraseType.paperKey
    const typeStyle = {
      [RPCTypes.PassphraseType.verifyPassPhrase]: {
        hintText: 'Verify Password',
        style: {marginBottom: 0},
      },
      [RPCTypes.PassphraseType.passPhrase]: {
        hintText: 'Password',
        style: {marginBottom: 0},
      },
      [RPCTypes.PassphraseType.paperKey]: {
        floatingHintTextOverride: 'Paperkey',
        hintText:
          'elephont sturm cectus opp blezzard tofi pando agg whi pany yaga jocket daubt ruril globil cose',
        multiline: true,
        rowsMax: 2,
      },
    }[this.props.type]

    const checkboxContainerStyle = {
      [RPCTypes.PassphraseType.verifyPassPhrase]: null,
      [RPCTypes.PassphraseType.passPhrase]: null,
      [RPCTypes.PassphraseType.paperKey]: {bottom: 0},
    }[this.props.type]

    return (
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          backgroundColor: globalColors.white,
          paddingBottom: globalMargins.medium,
          paddingTop: globalMargins.medium,
        }}
      >
        <Header icon={true} title="" onClose={this.props.onCancel} />
        <Box style={{...globalStyles.flexBoxColumn, paddingLeft: 30, paddingRight: 30}}>
          <Text type="Body" center={true}>
            {this.props.prompt}
          </Text>
          {isPaperKey && <Icon type="icon-paper-key-48" style={{alignSelf: 'center'}} />}
          <FormWithCheckbox
            inputProps={{
              autoFocus: true,
              errorText: this.props.retryLabel,
              onChangeText: password => this.setState({password}),
              onEnterKeyDown: this._onSubmit,
              type: this.state.showTyping ? 'passwordVisible' : 'password',
              value: this.state.password,
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
                      onCheck: this._onCheck,
                      style: checkboxStyle,
                    },
                  ]
                : []
            }
          />
          <Button
            style={{alignSelf: 'center'}}
            label={this.props.submitLabel}
            onClick={this._onSubmit}
            disabled={!this.state.password}
          />
        </Box>
      </Box>
    )
  }
}

Pinentry.defaultProps = {
  retryLabel: '',
  submitLabel: 'Continue',
}

const checkboxStyle = {
  color: globalColors.black,
  marginLeft: 10,
  zIndex: 9999,
}

export default Pinentry
