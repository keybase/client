import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/settings'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Styles from '../../styles'
import * as SettingsGen from '../../actions/settings-gen'
import {EnterEmailBody} from '../../signup/email/'
import AddPhone from '../../signup/phone-number/container'
import {Props as HeaderHocProps} from '../../common-adapters/header-hoc/types'

export const Email = () => {
  const dispatch = Container.useDispatch()
  const onClose = React.useCallback(() => dispatch(RouteTreeGen.createNavigateUp()), [dispatch])
  const [email, onChangeEmail] = React.useState('')
  const [allowSearch, onChangeAllowSearch] = React.useState(true)
  const emailError = Container.useSelector(state => state.settings.email.error)
  const disabled = !email
  const waiting = Container.useAnyWaiting(Constants.addEmailWaitingKey)
  const onContinue = React.useCallback(
    () =>
      disabled || waiting ? null : dispatch(SettingsGen.createAddEmail({email, searchable: allowSearch})),
    [dispatch, disabled, email, allowSearch, waiting]
  )
  return (
    <Kb.Modal
      onClose={onClose}
      header={{title: 'Add an email address'}}
      footer={{
        content: (
          <Kb.ButtonBar style={styles.buttonBar} fullWidth={true}>
            {!Styles.isMobile && (
              <Kb.Button type="Dim" label="Cancel" fullWidth={true} onClick={onClose} disabled={waiting} />
            )}
            <Kb.Button
              label="Continue"
              fullWidth={true}
              onClick={onContinue}
              disabled={disabled}
              waiting={waiting}
            />
          </Kb.ButtonBar>
        ),
        style: styles.footer,
      }}
      mode="Wide"
    >
      <Kb.Box2
        direction="vertical"
        centerChildren={true}
        fullWidth={true}
        fullHeight={true}
        style={styles.body}
      >
        <EnterEmailBody
          email={email}
          onChangeEmail={onChangeEmail}
          showAllowSearch={true}
          allowSearch={allowSearch}
          onChangeAllowSearch={onChangeAllowSearch}
          onContinue={onContinue}
          icon={<Kb.Icon type={Styles.isMobile ? 'icon-email-add-64' : 'icon-email-add-48'} />}
        />
        {!!emailError && <Kb.Banner color="red" text={emailError.message} style={styles.banner} />}
      </Kb.Box2>
    </Kb.Modal>
  )
}
export const Phone = props => (
  <Kb.Modal>
    <AddPhone {...props} />
  </Kb.Modal>
)

const styles = Styles.styleSheetCreate({
  banner: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  body: {
    ...Styles.padding(
      Styles.isMobile ? Styles.globalMargins.tiny : Styles.globalMargins.xlarge,
      Styles.globalMargins.small,
      0
    ),
    backgroundColor: Styles.globalColors.blueGrey,
    flexGrow: 1,
    position: 'relative',
  },
  buttonBar: {
    minHeight: undefined,
  },
  footer: {
    ...Styles.padding(Styles.globalMargins.small),
  },
})
