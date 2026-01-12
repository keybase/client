import * as C from '@/constants'
import * as React from 'react'
import {useTeamsState} from '@/stores/teams'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {ModalTitle, usePhoneNumberList} from '../common'
import {useSafeNavigation} from '@/util/safe-navigation'
import {useSettingsPhoneState} from '@/stores/settings-phone'

const waitingKey = 'phoneLookup'

const AddPhone = () => {
  const teamID = useTeamsState(s => s.addMembersWizard.teamID)
  const [error, setError] = React.useState('')
  const nav = useSafeNavigation()
  const onBack = () => nav.safeNavigateUp()

  const {phoneNumbers, setPhoneNumber, addPhoneNumber, removePhoneNumber} = usePhoneNumberList()
  const disabled = !phoneNumbers.length || phoneNumbers.some(pn => !pn.valid)
  const waiting = C.Waiting.useAnyWaiting(waitingKey)

  const defaultCountry = useSettingsPhoneState(s => s.defaultCountry)
  const loadDefaultPhoneCountry = useSettingsPhoneState(s => s.dispatch.loadDefaultPhoneCountry)

  React.useEffect(() => {
    if (!defaultCountry) {
      loadDefaultPhoneCountry()
    }
  }, [defaultCountry, loadDefaultPhoneCountry])

  const emailsToAssertionsRPC = C.useRPC(T.RPCGen.userSearchBulkEmailOrPhoneSearchRpcPromise)
  const addMembersWizardPushMembers = useTeamsState(s => s.dispatch.addMembersWizardPushMembers)
  const onContinue = () => {
    setError('')
    emailsToAssertionsRPC(
      [{emails: '', phoneNumbers: phoneNumbers.map(pn => pn.phoneNumber)}, waitingKey],
      r =>
        r?.length
          ? addMembersWizardPushMembers(
              r.map(m => ({
                ...(m.foundUser
                  ? {assertion: m.username, resolvedFrom: m.assertion}
                  : {assertion: m.assertion}),
                role: 'writer',
              }))
            )
          : setError('You must enter at least one valid phone number.'),
      err => setError(err.message)
    )
  }

  const maybeSubmit = (evt?: React.KeyboardEvent) => {
    if (!disabled && evt?.key === 'Enter' && (evt.ctrlKey || evt.metaKey)) {
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  body: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
      ...Kb.Styles.globalStyles.flexOne,
      backgroundColor: Kb.Styles.globalColors.blueGrey,
    },
    isMobile: {...Kb.Styles.globalStyles.flexOne},
  }),
  container: {
    padding: Kb.Styles.globalMargins.small,
  },
  wordBreak: Kb.Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
}))

export default AddPhone
