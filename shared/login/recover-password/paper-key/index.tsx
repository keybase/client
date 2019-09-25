import * as React from 'react'
import * as Constants from '../../../constants/recover-password'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {SignupScreen, InfoIcon} from '../../../signup/common'
import {ButtonType} from '../../../common-adapters/button'

export type Props = {
  error: string
  onBack: () => void
  onSubmit: (paperKey: string) => void
}

const PaperKey = (props: Props) => {
  const [paperKey, setPaperKey] = React.useState('')
  const onSubmit = React.useCallback(() => paperKey && props.onSubmit(paperKey), [paperKey])

  return (
    <SignupScreen
      buttons={[
        {
          disabled: !paperKey,
          label: 'Continue',
          onClick: onSubmit,
          type: 'Default' as ButtonType,
          waitingKey: Constants.getPaperKeyWaitingKey,
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

PaperKey.navigationOptions = {
  header: null,
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
