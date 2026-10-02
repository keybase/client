import * as Kb from '@/common-adapters'
import * as React from 'react'
import {NavigationContext} from '@react-navigation/core'
import {navigateUp} from '@/constants/router'
import {getRecoverPasswordPgpPrompt} from './flow'

const PgpWarning = () => {
  const styles = useStyles()
  const [prompt] = React.useState(getRecoverPasswordPgpPrompt)
  // Absent outside a navigator (storybook).
  const navigation = React.useContext(NavigationContext)

  React.useEffect(() => {
    if (!navigation) return
    return navigation.addListener('beforeRemove', e => {
      // Only the user taking the warning away is a decline: the header Cancel, Android back or a native
      // dismissal (REMOVE). Resets elsewhere also remove screens and are not answers.
      const {type} = e.data.action
      if (type === 'POP' || type === 'GO_BACK' || type === 'REMOVE') {
        prompt?.respond(false)
      }
    })
  }, [navigation, prompt])

  const onContinue = () => {
    prompt?.respond(true)
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
