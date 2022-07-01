import * as React from 'react'
import * as Kb from '../common-adapters'
import DragHeader from '../desktop/remote/drag-header.desktop'
import * as Styles from '../styles'
import {_setDarkModePreference} from '../styles/dark-mode'
import * as RPCTypes from '../constants/types/rpc-gen'

export type Props = {
  darkMode: boolean
  onSubmit: (password: string) => void
  onCancel: () => void
  showTyping?: RPCTypes.Feature
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
      showTyping: this.props.showTyping?.defaultValue ?? false,
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.showTyping !== this.props.showTyping) {
      this.setState({showTyping: this.props.showTyping?.defaultValue ?? false})
    }
  }

  _onCheck = (showTyping: boolean) => {
    this.setState({showTyping})
  }

  _onSubmit = () => {
    this.props.onSubmit(this.state.password)
    this.setState({password: ''})
  }

  render() {
    _setDarkModePreference(this.props.darkMode ? 'alwaysDark' : 'alwaysLight')
    const isPaperKey = this.props.type === RPCTypes.PassphraseType.paperKey
    return (
      <Kb.Box
        style={styles.container}
        className={this.props.darkMode ? 'darkMode' : 'lightMode'}
        key={this.props.darkMode ? 'darkMode' : 'light'}
      >
        <DragHeader icon={false} title="" onClose={this.props.onCancel} windowDragging={true} />
        <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, paddingLeft: 30, paddingRight: 30}}>
          <Kb.Text type="Body" center={true}>
            {this.props.prompt}
          </Kb.Text>
          {isPaperKey && <Kb.Icon type="icon-paper-key-48" style={{alignSelf: 'center'}} />}
          <Kb.Box2
            alignSelf="center"
            direction="vertical"
            fullWidth={true}
            gap="tiny"
            gapEnd={true}
            gapStart={true}
            style={styles.inputContainer}
          >
            <Kb.LabeledInput
              autoFocus={true}
              error={!!this.props.retryLabel}
              onChangeText={password => this.setState({password})}
              onEnterKeyDown={this._onSubmit}
              placeholder="Password"
              type={this.state.showTyping ? 'passwordVisible' : 'password'}
              value={this.state.password}
            />
            {!!this.props.retryLabel && (
              <Kb.Text style={styles.alignment} type="BodySmallError">
                {this.props.retryLabel}
              </Kb.Text>
            )}
            {this.props.showTyping && this.props.showTyping.allow && (
              <Kb.Checkbox
                checked={this.state.showTyping}
                label={this.props.showTyping.label}
                onCheck={this._onCheck}
                style={styles.alignment}
              />
            )}
          </Kb.Box2>
          <Kb.Button
            style={{alignSelf: 'center'}}
            label={this.props.submitLabel}
            onClick={this._onSubmit}
            disabled={!this.state.password}
          />
        </Kb.Box>
      </Kb.Box>
    )
  }
}

Pinentry.defaultProps = {
  retryLabel: '',
  submitLabel: 'Continue',
}

const styles = Styles.styleSheetCreate(() => ({
  alignment: {marginLeft: Styles.globalMargins.xsmall},
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    backgroundColor: Styles.globalColors.white,
    paddingBottom: Styles.globalMargins.medium,
  },
  inputContainer: {maxWidth: 428},
}))

export default Pinentry
