import * as React from 'react'
import * as Constants from '../../constants/provision'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {
  onBack?: () => void
  onSubmit: (paperKey: string) => void
  hint: string
  error: string
}

class PaperKey extends React.Component<Props, {paperKey: string}> {
  state = {paperKey: ''}
  _onSubmit = () => this.props.onSubmit(this.state.paperKey)

  render() {
    const props = this.props

    return (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} gap="medium">
        <Kb.Box2
          direction="vertical"
          style={styles.contents}
          centerChildren={!Styles.isAndroid /* android keyboardAvoiding doesnt work well */}
          gap={Styles.isMobile ? 'tiny' : 'medium'}
        >
          <Kb.Box2 direction="vertical" gap="tiny" centerChildren={true} gapEnd={true}>
            <Kb.Icon type="icon-paper-key-48" />
            <Kb.Text type="Header" style={styles.hint}>
              {props.hint}
            </Kb.Text>
          </Kb.Box2>
          <Kb.Box2 direction="vertical" style={styles.inputContainer}>
            <Kb.PlainInput
              autoFocus={true}
              multiline={true}
              rowsMax={3}
              placeholder="Type in your paper key"
              textType="Header"
              style={styles.input}
              onEnterKeyDown={this._onSubmit}
              onChangeText={paperKey => this.setState({paperKey})}
              value={this.state.paperKey}
            />
          </Kb.Box2>
          {!!props.error && <Kb.Text type="BodySmallError">{props.error}</Kb.Text>}
          <Kb.ButtonBar fullWidth={true}>
            <Kb.WaitingButton
              label="Continue"
              fullWidth={true}
              onClick={this._onSubmit}
              disabled={!this.state.paperKey}
              waitingKey={Constants.waitingKey}
            />
          </Kb.ButtonBar>
          {props.onBack && <Kb.Button label="Back to my existing account" onClick={props.onBack} />}
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  backButton: Styles.platformStyles({
    isElectron: {
      marginLeft: Styles.globalMargins.medium,
      marginTop: Styles.globalMargins.medium,
    },
    isMobile: {
      marginLeft: 0,
      marginTop: 0,
    },
  }),
  contents: {
    flexGrow: 1,
    maxWidth: Styles.isMobile ? 300 : 460,
    width: '100%',
  },
  hint: {
    ...Styles.globalStyles.italic,
  },
  input: {
    color: Styles.globalColors.black,
    ...Styles.globalStyles.fontTerminal,
  },
  inputContainer: {
    borderColor: Styles.globalColors.black_10,
    borderRadius: 4,
    borderStyle: 'solid',
    borderWidth: 1,
    minHeight: 77,
    padding: Styles.globalMargins.small,
    width: '100%',
  },
})

export default PaperKey
