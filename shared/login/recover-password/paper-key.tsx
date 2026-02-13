import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import type {ButtonType} from '@/common-adapters/button'
import {SignupScreen} from '@/signup/common'
import {useState as useRecoverState} from '@/stores/recover-password'

const PaperKey = () => {
  const error = useRecoverState(s => s.paperKeyError)
  const cancel = useRecoverState(s => s.dispatch.dynamic.cancel)
  const submitPaperKey = useRecoverState(s => s.dispatch.dynamic.submitPaperKey)
  const onBack = () => {
    cancel?.()
  }
  const props = {error, onBack}
  const [paperKey, setPaperKey] = React.useState('')
  const onSubmit = React.useCallback(() => {
    if (paperKey) {
      submitPaperKey?.(paperKey)
    }
  }, [paperKey, submitPaperKey])

  return (
    <SignupScreen
      buttons={[
        {
          disabled: !paperKey,
          label: 'Continue',
          onClick: onSubmit,
          type: 'Default' as ButtonType,
          waitingKey: C.waitingKeyRecoverPassword,
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
          centerChildren={!Kb.Styles.isAndroid /* android keyboardAvoiding doesnt work well */}
          gap={Kb.Styles.isMobile ? 'tiny' : 'medium'}
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  contents: {
    flexGrow: 1,
    maxWidth: Kb.Styles.isMobile ? '100%' : 460,
    width: '100%',
  },
  input: {
    ...Kb.Styles.globalStyles.fontTerminal,
    color: Kb.Styles.globalColors.black,
    marginTop: 10,
    width: '100%',
  },
  inputContainer: {
    width: '100%',
  },
}))
export default PaperKey
