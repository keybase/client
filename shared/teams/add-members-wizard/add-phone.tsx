import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {usePhoneNumberList} from '../common'
import {useDefaultPhoneCountry} from '@/util/phone-numbers'
import {addMembersToWizardAndNav, searchResultsToMembers, type AddMembersWizard} from './state'

const waitingKey = 'phoneLookup'

const AddPhone = ({wizard}: {wizard: AddMembersWizard}) => {
  const [error, setError] = React.useState('')

  const {phoneNumbers, setPhoneNumber, addPhoneNumber, removePhoneNumber} = usePhoneNumberList()
  const disabled = !phoneNumbers.length || phoneNumbers.some(pn => !pn.valid)
  const waiting = C.Waiting.useAnyWaiting(waitingKey)

  const defaultCountry = useDefaultPhoneCountry()

  const emailsToAssertionsRPC = C.useRPC(T.RPCGen.userSearchBulkEmailOrPhoneSearchRpcPromise)
  const onContinue = () => {
    setError('')
    emailsToAssertionsRPC(
      [{emails: '', phoneNumbers: phoneNumbers.map(pn => pn.phoneNumber)}, waitingKey],
      r => {
        if (!r?.length) {
          setError('You must enter at least one valid phone number.')
          return
        }
        C.ignorePromise(addMembersToWizardAndNav(wizard, searchResultsToMembers(r), setError))
      },
      err => setError(err.message)
    )
  }

  const maybeSubmit = (evt?: React.KeyboardEvent) => {
    if (!disabled && evt?.key === 'Enter' && (evt.ctrlKey || evt.metaKey)) {
      onContinue()
    }
  }

  return (
    <>
      <Kb.ErrorBanner error={error} />
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
          <Kb.IconButton mode="Secondary" icon="iconfont-new" onClick={addPhoneNumber} />
        </Kb.Box2>
      </Kb.Box2>
      <Kb.ModalFooter>
        <Kb.Button waiting={waiting} fullWidth={true} label="Continue" onClick={onContinue} disabled={disabled} />
      </Kb.ModalFooter>
    </>
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
}))

export default AddPhone
