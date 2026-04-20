import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import type {ButtonType} from '@/common-adapters/button'
import {SignupScreen} from '@/signup/common'
import {cancelRecoverPassword, submitRecoverPasswordPaperKey} from './flow'

type Props = {route: {params: {error?: string}}}

const PaperKey = ({route}: Props) => {
  const {error} = route.params
  const onBack = () => {
    cancelRecoverPassword()
  }
  const [paperKey, setPaperKey] = React.useState('')
  const onSubmit = () => {
    if (paperKey) {
      submitRecoverPasswordPaperKey(paperKey)
    }
  }

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
      onBack={onBack}
      title="Recover password"
    >
      <Kb.Box2 alignItems="center" direction="vertical" fullHeight={true} fullWidth={true} gap="small">
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          flex={1}
          style={styles.contents}
          centerChildren={!Kb.Styles.isAndroid /* android keyboardAvoiding doesnt work well */}
          gap={Kb.Styles.isMobile ? 'tiny' : 'medium'}
        >
          <Kb.Box2 direction="vertical" gap="tiny" centerChildren={true} gapEnd={true}>
            <Kb.ImageIcon type="icon-paper-key-96" />
          </Kb.Box2>
          <Kb.Box2 direction="vertical" style={styles.inputContainer} fullWidth={true}>
            <Kb.Input3
              autoFocus={true}
              multiline={true}
              rowsMax={3}
              placeholder="Type your paper key"
              textType="Header"
              containerStyle={styles.inputContainer2}
              inputStyle={styles.inputText}
              onEnterKeyDown={onSubmit}
              onChangeText={paperKey => setPaperKey(paperKey)}
              value={paperKey}
            />
          </Kb.Box2>
          {!!error && <Kb.Text type="BodySmallError">{error}</Kb.Text>}
        </Kb.Box2>
      </Kb.Box2>
    </SignupScreen>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  contents: {
    maxWidth: Kb.Styles.isMobile ? '100%' : 460,
    width: '100%',
  },
  inputContainer: {
    width: '100%',
  },
  inputContainer2: {
    marginTop: 10,
  },
  inputText: {
    ...Kb.Styles.globalStyles.fontTerminal,
    color: Kb.Styles.globalColors.black,
  },
}))
export default PaperKey
