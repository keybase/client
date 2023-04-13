import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as RPCGen from '../../constants/types/rpc-gen'
import * as TeamsGen from '../../actions/teams-gen'
import * as SettingsGen from '../../actions/settings-gen'
import {ModalTitle, usePhoneNumberList} from '../common'

const waitingKey = 'phoneLookup'

const AddPhone = () => {
  const teamID = Container.useSelector(s => s.teams.addMembersWizard.teamID)
  const [error, setError] = React.useState('')

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onBack = () => dispatch(nav.safeNavigateUpPayload())

  const {phoneNumbers, setPhoneNumber, addPhoneNumber, removePhoneNumber} = usePhoneNumberList()
  const disabled = !phoneNumbers.length || phoneNumbers.some(pn => !pn.valid)
  const waiting = Container.useAnyWaiting(waitingKey)

  const defaultCountry = Container.useSelector(s => s.settings.phoneNumbers.defaultCountry)

  React.useEffect(() => {
    if (!defaultCountry) {
      dispatch(SettingsGen.createLoadDefaultPhoneNumberCountry())
    }
  }, [defaultCountry, dispatch])

  const emailsToAssertionsRPC = Container.useRPC(RPCGen.userSearchBulkEmailOrPhoneSearchRpcPromise)
  const onContinue = () => {
    setError('')
    emailsToAssertionsRPC(
      [{emails: '', phoneNumbers: phoneNumbers.map(pn => pn.phoneNumber)}, waitingKey],
      r =>
        r?.length
          ? dispatch(
              TeamsGen.createAddMembersWizardPushMembers({
                members: r.map(m => ({
                  ...(m.foundUser
                    ? {assertion: m.username, resolvedFrom: m.assertion}
                    : {assertion: m.assertion}),
                  role: 'writer',
                })),
              })
            )
          : setError('You must enter at least one valid phone number.'),
      err => setError(err.message)
    )
  }

  const maybeSubmit = (evt?: any) => {
    if (!disabled && evt && evt.key === 'Enter' && (evt.ctrlKey || evt.metaKey)) {
      onContinue()
    }
  }

  return (
    <Kb.Modal
      mode="DefaultFullHeight"
      header={{
        leftButton: <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />,
        title: <ModalTitle teamID={teamID} title="Phone list" />,
      }}
      allowOverflow={true}
      footer={{
        content: (
          <Kb.Button
            waiting={waiting}
            fullWidth={true}
            label="Continue"
            onClick={onContinue}
            disabled={disabled}
          />
        ),
      }}
      banners={
        error ? (
          <Kb.Banner color="red" key="err">
            {error}
          </Kb.Banner>
        ) : null
      }
    >
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.body} gap="tiny">
        <Kb.Text type="Body">Enter one or multiple phone numbers:</Kb.Text>
        <Kb.Box2 direction="vertical" gap="medium" fullWidth={true} alignItems="flex-start">
          {phoneNumbers.map((pn, idx) => (
            <Kb.PhoneInput
              key={pn.key}
              autoFocus={idx === 0}
              defaultCountry={defaultCountry}
              onChangeNumber={(phoneNumber, valid) => setPhoneNumber(idx, phoneNumber, valid)}
              onClear={phoneNumbers.length === 1 ? undefined : () => removePhoneNumber(idx)}
              onEnterKeyDown={maybeSubmit}
            />
          ))}
          <Kb.Button mode="Secondary" icon="iconfont-new" onClick={addPhoneNumber} />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  body: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.small),
      ...Styles.globalStyles.flexOne,
      backgroundColor: Styles.globalColors.blueGrey,
    },
    isMobile: {...Styles.globalStyles.flexOne},
  }),
  container: {
    padding: Styles.globalMargins.small,
  },
  wordBreak: Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
}))

export default AddPhone
