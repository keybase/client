import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {isMobile} from '../../constants/platform'
import {SignupScreen, errorBanner} from '../../signup/common'

type Props = {
  onBack?: () => void
  onSubmit: (paperKey: string) => void
  hint: string
  error: string
  waiting: boolean
}

class PaperKey extends React.Component<Props, {paperKey: string}> {
  static navigationOptions = {
    header: null,
    headerBottomStyle: {height: undefined},
    headerLeft: null, // no back button
  }

  state = {paperKey: ''}
  _onSubmit = () => this.props.onSubmit(this.state.paperKey)

  render() {
    const props = this.props

    return (
      <SignupScreen
        banners={errorBanner(props.error)}
        buttons={[
          {
            disabled: !this.state.paperKey,
            label: 'Continue',
            onClick: this._onSubmit,
            type: 'Success',
            waiting: props.waiting,
          },
        ]}
        noBackground={true}
        onBack={this.props.onBack}
        title={isMobile ? 'Enter paper key' : 'Enter your paper key'}
      >
        <Kb.Box2
          direction="vertical"
          style={styles.contents}
          centerChildren={!Styles.isAndroid /* android keyboardAvoiding doesnt work well */}
          gap={Styles.isMobile ? 'tiny' : 'medium'}
        >
          <Kb.Box2 direction="vertical" gap="tiny" centerChildren={true} gapEnd={true}>
            <Kb.Icon type="icon-paper-key-64" />
            <Kb.Text type="Header">{props.hint}</Kb.Text>
          </Kb.Box2>
          <Kb.Box2 direction="vertical" style={styles.inputContainer}>
            <Kb.PlainInput
              autoFocus={true}
              multiline={true}
              rowsMax={3}
              placeholder="Type in your entire paper key"
              textType="Body"
              style={styles.input}
              onEnterKeyDown={this._onSubmit}
              onChangeText={paperKey => this.setState({paperKey})}
              value={this.state.paperKey}
            />
          </Kb.Box2>
        </Kb.Box2>
      </SignupScreen>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
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
      contents: Styles.platformStyles({
        common: {
          flexGrow: 1,
          width: '100%',
        },
        isElectron: {maxWidth: 460},
        isMobile: {maxWidth: 300},
        isTablet: {maxWidth: 460},
      }),
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
    } as const)
)

export default PaperKey
