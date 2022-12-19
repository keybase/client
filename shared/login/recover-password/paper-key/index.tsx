import * as React from 'react'
import * as Constants from '../../../constants/recover-password'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {SignupScreen, InfoIcon} from '../../../signup/common'
import type {ButtonType} from '../../../common-adapters/button'

export type Props = {
  error: string
  onBack: () => void
  onSubmit: (paperKey: string) => void
}

const PaperKey = (props: Props) => {
  const [paperKey, setPaperKey] = React.useState('')
  const _onSubmit = props.onSubmit
  const onSubmit = React.useCallback(() => paperKey && _onSubmit(paperKey), [paperKey, _onSubmit])

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

PaperKey.navigationOptions = {
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
