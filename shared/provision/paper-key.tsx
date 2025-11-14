import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {SignupScreen, errorBanner} from '../signup/common'
import {isMobile} from '@/constants/platform'

export const PaperKey = () => {
  const error = C.useProvisionState(s => s.error)
  const hint = C.useProvisionState(s => `${s.codePageOtherDevice.name || ''}...`)
  const waiting = C.Waiting.useAnyWaiting(C.Provision.waitingKey)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    navigateUp()
  }
  const _onSubmit = C.useProvisionState(s => s.dispatch.dynamic.setPassphrase)
  const onSubmit = (paperkey: string) => !waiting && _onSubmit?.(paperkey)
  const [paperKey, setPaperKey] = React.useState('')

  const _onSubmitClick = () => {
    onSubmit(paperKey)
  }

  return (
    <SignupScreen
      banners={errorBanner(error)}
      buttons={[
        {
          disabled: !paperKey,
          label: 'Continue',
          onClick: _onSubmitClick,
          type: 'Success',
          waiting,
        },
      ]}
      noBackground={true}
      onBack={onBack}
      title={isMobile ? 'Enter paper key' : 'Enter your paper key'}
    >
      <Kb.Box2
        direction="vertical"
        style={styles.contents}
        centerChildren={!Kb.Styles.isAndroid /* android keyboardAvoiding doesnt work well */}
        gap={Kb.Styles.isMobile ? 'tiny' : 'medium'}
      >
        <Kb.Box2 direction="vertical" gap="tiny" centerChildren={true} gapEnd={true}>
          <Kb.Icon type="icon-paper-key-64" />
          <Kb.Text type="Header">{hint}</Kb.Text>
        </Kb.Box2>
        <Kb.Box2 direction="vertical" style={styles.inputContainer}>
          <Kb.PlainInput
            autoFocus={true}
            multiline={true}
            rowsMax={3}
            placeholder="Type in your entire paper key"
            textType="Body"
            style={styles.input}
            onEnterKeyDown={_onSubmitClick}
            onChangeText={setPaperKey}
            value={paperKey}
          />
        </Kb.Box2>
      </Kb.Box2>
    </SignupScreen>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      backButton: Kb.Styles.platformStyles({
        isElectron: {
          marginLeft: Kb.Styles.globalMargins.medium,
          marginTop: Kb.Styles.globalMargins.medium,
        },
        isMobile: {
          marginLeft: 0,
          marginTop: 0,
        },
      }),
      contents: Kb.Styles.platformStyles({
        common: {
          flexGrow: 1,
          width: '100%',
        },
        isElectron: {maxWidth: 460},
        isMobile: {maxWidth: 300},
        isTablet: {maxWidth: 460},
      }),
      input: {
        color: Kb.Styles.globalColors.black,
        ...Kb.Styles.globalStyles.fontTerminal,
      },
      inputContainer: {
        borderColor: Kb.Styles.globalColors.black_10,
        borderRadius: 4,
        borderStyle: 'solid',
        borderWidth: 1,
        minHeight: 77,
        padding: Kb.Styles.globalMargins.small,
        width: '100%',
      },
    }) as const
)

export default PaperKey
