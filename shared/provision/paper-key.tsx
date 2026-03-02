import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {SignupScreen, errorBanner} from '../signup/common'
import {useProvisionState} from '@/stores/provision'

const Container = () => {
  const error = useProvisionState(s => s.error)
  const hint = useProvisionState(s => `${s.codePageOtherDevice.name || ''}...`)
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyProvision)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    navigateUp()
  }
  const onSubmit = useProvisionState(s => s.dispatch.dynamic.setPassphrase)
  const props = {
    error: error,
    hint: hint,
    onBack: onBack,
    onSubmit: (paperkey: string) => !waiting && onSubmit?.(paperkey),
    waiting: waiting,
  }
  return <PaperKey {...props} />
}

type Props = {
  onBack?: () => void
  onSubmit: (paperKey: string) => void
  hint: string
  error: string
  waiting: boolean
}

export const PaperKey = (props: Props) => {
  const [paperKey, setPaperKey] = React.useState('')

  const _onSubmit = () => {
    props.onSubmit(paperKey)
  }

  return (
    <SignupScreen
      banners={errorBanner(props.error)}
      buttons={[
        {
          disabled: !paperKey,
          label: 'Continue',
          onClick: _onSubmit,
          type: 'Success',
          waiting: props.waiting,
        },
      ]}
      noBackground={true}
      onBack={props.onBack}
      title={C.isMobile ? 'Enter paper key' : 'Enter your paper key'}
    >
      <Kb.Box2
        direction="vertical"
        style={styles.contents}
        centerChildren={!Kb.Styles.isAndroid /* android keyboardAvoiding doesnt work well */}
        gap={Kb.Styles.isMobile ? 'tiny' : 'medium'}
      >
        <Kb.Box2 direction="vertical" gap="tiny" centerChildren={true} gapEnd={true}>
          <Kb.Icon type="icon-paper-key-64" />
          <Kb.Text type="Header">{props.hint}</Kb.Text>
        </Kb.Box2>
        <Kb.Input3
          autoFocus={true}
          multiline={true}
          rowsMax={3}
          placeholder="Type in your entire paper key"
          textType="Body"
          containerStyle={styles.container2}
          inputStyle={styles.inputText}
          onEnterKeyDown={_onSubmit}
          onChangeText={setPaperKey}
          value={paperKey}
        />
      </Kb.Box2>
    </SignupScreen>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container2: {
        minHeight: 77,
        padding: Kb.Styles.globalMargins.small,
        width: '100%',
      },
      contents: Kb.Styles.platformStyles({
        common: {
          flexGrow: 1,
          width: '100%',
        },
        isElectron: {maxWidth: 460},
        isMobile: {maxWidth: 300},
        isTablet: {maxWidth: 460},
      }),
      inputText: {
        ...Kb.Styles.globalStyles.fontTerminal,
        color: Kb.Styles.globalColors.black,
      },
    }) as const
)

export default Container
