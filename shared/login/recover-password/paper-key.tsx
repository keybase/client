import * as Constants from '../../constants/recover-password'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as React from 'react'
import * as RecoverPasswordGen from '../../actions/recover-password-gen'
import * as Styles from '../../styles'
import HiddenString from '../../util/hidden-string'
import type {ButtonType} from '../../common-adapters/button'
import {SignupScreen, InfoIcon} from '../../signup/common'

const PaperKey = () => {
  const error = Container.useSelector(state => state.recoverPassword.paperKeyError.stringValue())
  const dispatch = Container.useDispatch()
  const onBack = () => {
    dispatch(RecoverPasswordGen.createAbortPaperKey())
  }
  const props = {error, onBack}
  const [paperKey, setPaperKey] = React.useState('')
  const onSubmit = React.useCallback(() => {
    if (paperKey) {
      dispatch(RecoverPasswordGen.createSubmitPaperKey({paperKey: new HiddenString(paperKey)}))
    }
  }, [paperKey, dispatch])

  return (
    <SignupScreen
      buttons={[
        {
          disabled: !paperKey,
          label: 'Continue',
          onClick: onSubmit,
          type: 'Default' as ButtonType,
          waitingKey: Constants.waitingKey,
        },
      ]}
      onBack={props.onBack}
      title="Recover password"
    >
      <Kb.Box2 alignItems="center" direction="vertical" fullHeight={true} fullWidth={true} gap="small">
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          style={styles.contents}
          centerChildren={!Styles.isAndroid /* android keyboardAvoiding doesnt work well */}
          gap={Styles.isMobile ? 'tiny' : 'medium'}
        >
          <Kb.Box2 direction="vertical" gap="tiny" centerChildren={true} gapEnd={true}>
            <Kb.Icon type="icon-paper-key-96" />
          </Kb.Box2>
          <Kb.Box2 direction="vertical" style={styles.inputContainer} fullWidth={true}>
            <Kb.LabeledInput
              autoFocus={true}
              multiline={true}
              rowsMax={3}
              hoverPlaceholder="Ex: garage blue three..."
              placeholder="Type your paper key"
              textType="Header"
              style={styles.input}
              onEnterKeyDown={onSubmit}
              onChangeText={paperKey => setPaperKey(paperKey)}
              value={paperKey}
            />
          </Kb.Box2>
          {!!props.error && <Kb.Text type="BodySmallError">{props.error}</Kb.Text>}
        </Kb.Box2>
      </Kb.Box2>
    </SignupScreen>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  contents: {
    flexGrow: 1,
    maxWidth: Styles.isMobile ? '100%' : 460,
    width: '100%',
  },
  input: {
    ...Styles.globalStyles.fontTerminal,
    color: Styles.globalColors.black,
    marginTop: 10,
    width: '100%',
  },
  inputContainer: {
    width: '100%',
  },
}))

export const options = {
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
  headerRightActions: () => (
    <Kb.Box2
      direction="horizontal"
      style={Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.tiny, 0)}
    >
      <InfoIcon />
    </Kb.Box2>
  ),
}

export default PaperKey
