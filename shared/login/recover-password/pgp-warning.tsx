import * as Kb from '@/common-adapters'
import * as React from 'react'
import {navigateUp} from '@/constants/router'
import {continueRecoverPasswordPgp, markRecoverPasswordPgpShown} from './flow'
import {useRecoverPromptBack, useRecoverPromptSelfClose} from './use-prompt-back'

// recoverRunId: the run that showed it, which takes its own screens away when it fails
type Props = {route: {params: {promptId: number; recoverRunId: string}}}

const PgpWarning = ({route}: Props) => {
  const {promptId} = route.params
  const styles = useStyles()
  // The user taking the warning away (the header Cancel, Android back, a native dismissal) declines it
  useRecoverPromptBack(promptId)
  useRecoverPromptSelfClose(promptId, 'recoverPasswordPgpWarning')

  React.useEffect(() => {
    markRecoverPasswordPgpShown(promptId)
  }, [promptId])

  const onContinue = () => {
    continueRecoverPasswordPgp(promptId)
    navigateUp()
  }

  return (
    <>
      <Kb.ScrollView alwaysBounceVertical={false} style={Kb.Styles.globalStyles.flexOne}>
        <Kb.Box2
          centerChildren={!Kb.Styles.isTablet}
          direction="vertical"
          fullHeight={true}
          flex={1}
          gap="small"
          padding="small"
          style={styles.container}
        >
          <Kb.Text type="Body" center={true}>
            Your account has PGP keys stored on Keybase, encrypted with your old password.
          </Kb.Text>
          <Kb.Text type="Body" center={true}>
            If you reset your password you will lose them.
          </Kb.Text>
        </Kb.Box2>
      </Kb.ScrollView>
      <Kb.ModalFooter>
        <Kb.ButtonBar align="center" direction="row" fullWidth={true} style={styles.buttonBar}>
          <Kb.Button fullWidth={true} label="Continue" onClick={onContinue} type="Danger" />
        </Kb.ButtonBar>
      </Kb.ModalFooter>
    </>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      buttonBar: {minHeight: undefined},
      container: {backgroundColor: theme.blueGrey},
    }) as const
)

export default PgpWarning
