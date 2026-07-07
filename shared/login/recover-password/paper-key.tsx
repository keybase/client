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
          centerChildren={!isAndroid /* android keyboardAvoiding doesnt work well */}
          gap={isMobile ? 'tiny' : 'medium'}
        >
          <Kb.ImageIcon type="icon-paper-key-96" style={styles.icon} />
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
          {!!error && <Kb.Text type="BodySmallError">{error}</Kb.Text>}
        </Kb.Box2>
      </Kb.Box2>
    </SignupScreen>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  contents: {
    maxWidth: isMobile ? '100%' : 460,
  },
  icon: {
    // parent Box2 is alignItems stretch on android (centerChildren off there)
    alignSelf: 'center',
    marginBottom: Kb.Styles.globalMargins.tiny,
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
