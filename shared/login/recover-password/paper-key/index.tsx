import * as React from 'react'
import * as Kb from '../../../common-adapters'
import {SignupScreen} from '../../../signup/common'
import {ButtonType} from '../../../common-adapters/button'
import * as Styles from '../../../styles'

export type Props = {
  error: string
  onBack: () => void
  onSubmit: (paperKey: string) => void
}

const PaperKey = (props: Props) => {
  const [paperKey, setPaperKey] = React.useState('')
  const onSubmit = React.useCallback(() => props.onSubmit(paperKey), [paperKey])

  return (
    <SignupScreen
      banners={[]}
      buttons={[
        {
          disabled: !paperKey,
          label: 'Continue',
          onClick: onSubmit,
          type: 'Default' as ButtonType,
        },
      ]}
      onBack={props.onBack}
      title="Recover password"
    >
      <Kb.Box2 alignItems="center" direction="vertical" fullHeight={true} fullWidth={true} gap="small">
        <Kb.Box2
          direction="vertical"
          style={styles.contents}
          centerChildren={!Styles.isAndroid /* android keyboardAvoiding doesnt work well */}
          gap={Styles.isMobile ? 'tiny' : 'medium'}
        >
          <Kb.Box2 direction="vertical" gap="tiny" centerChildren={true} gapEnd={true}>
            <Kb.Icon type="icon-paper-key-48" />
          </Kb.Box2>
          <Kb.Box2 direction="vertical" style={styles.inputContainer}>
            <Kb.PlainInput
              autoFocus={true}
              multiline={true}
              rowsMax={3}
              placeholder="Type in your paper key"
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
    maxWidth: Styles.isMobile ? 300 : 460,
    width: '100%',
  },
  input: {
    color: Styles.globalColors.black,
    ...Styles.globalStyles.fontTerminal,
  },
  inputContainer: {
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.black_10,
    borderRadius: 4,
    borderStyle: 'solid',
    borderWidth: 1,
    minHeight: 77,
    padding: Styles.globalMargins.small,
    width: '100%',
  },
}))

export default PaperKey
