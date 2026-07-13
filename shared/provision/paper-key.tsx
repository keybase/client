import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {SignupScreen, errorBanner} from '../signup/common'
import {submitProvisionPassphrase} from './flow'

type RouteProps = {
  route: {
    params: {
      deviceName: string
      error?: string
    }
  }
}

const Container = ({route}: RouteProps) => {
  const error = route.params.error ?? ''
  const hint = `${route.params.deviceName || ''}...`
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyProvision)
  return (
    <PaperKey
      error={error}
      hint={hint}
      onBack={C.Router2.navigateUp}
      onSubmit={(paperkey: string) => !waiting && submitProvisionPassphrase(paperkey)}
      waiting={waiting}
    />
  )
}

type Props = {
  onBack?: () => void
  onSubmit: (paperKey: string) => void
  hint: string
  error: string
  waiting: boolean
}

export const PaperKey = (props: Props) => {
  const {onSubmit: onSubmitFunc} = props
  const [paperKey, setPaperKey] = React.useState('')
  const onSubmit = () => onSubmitFunc(paperKey)

  return (
    <SignupScreen
      hideDesktopHeader={!isMobile}
      banners={errorBanner(props.error)}
      buttons={[
        {
          disabled: !paperKey,
          label: 'Continue',
          onClick: onSubmit,
          type: 'Success',
          waiting: props.waiting,
        },
      ]}
      noBackground={true}
      onBack={props.onBack}
      title={isMobile ? 'Enter paper key' : 'Enter your paper key'}
    >
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={styles.contents}
        centerChildren={!isAndroid /* android keyboardAvoiding doesnt work well */}
        gap={isMobile ? 'tiny' : 'medium'}
      >
        <Kb.Box2 direction="vertical" gap="tiny" centerChildren={true} gapEnd={true}>
          <Kb.ImageIcon type="icon-paper-key-64" />
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
          onEnterKeyDown={onSubmit}
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
