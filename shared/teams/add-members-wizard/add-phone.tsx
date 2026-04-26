import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {usePhoneNumberList} from '../common'
import {useDefaultPhoneCountry} from '@/util/phone-numbers'
import {addMembersToWizard, type AddMembersWizard} from './state'

const waitingKey = 'phoneLookup'

const AddPhone = ({wizard}: {wizard: AddMembersWizard}) => {
  const [error, setError] = React.useState('')

  const {phoneNumbers, setPhoneNumber, addPhoneNumber, removePhoneNumber} = usePhoneNumberList()
  const disabled = !phoneNumbers.length || phoneNumbers.some(pn => !pn.valid)
  const waiting = C.Waiting.useAnyWaiting(waitingKey)

  const defaultCountry = useDefaultPhoneCountry()

  const emailsToAssertionsRPC = C.useRPC(T.RPCGen.userSearchBulkEmailOrPhoneSearchRpcPromise)
  const navUpToScreen = C.Router2.navUpToScreen
  const onContinue = () => {
    setError('')
    emailsToAssertionsRPC(
      [{emails: '', phoneNumbers: phoneNumbers.map(pn => pn.phoneNumber)}, waitingKey],
      r => {
        if (!r?.length) {
          setError('You must enter at least one valid phone number.')
          return
        }
        const f = async () => {
          try {
            const nextWizard = await addMembersToWizard(
              wizard,
              r.map(m => ({
                ...(m.foundUser ? {assertion: m.username, resolvedFrom: m.assertion} : {assertion: m.assertion}),
                role: 'writer',
              }))
            )
            navUpToScreen({name: 'teamAddToTeamConfirm', params: {wizard: nextWizard}}, true)
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
          }
        }
        C.ignorePromise(f())
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
      {error ? (
        <Kb.Banner color="red" key="err">
          {error}
        </Kb.Banner>
      ) : null}
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.body} gap="tiny">
        <Kb.Text type="Body">Enter one or multiple phone numbers:</Kb.Text>
        <Kb.Box2 direction="vertical" gap="medium" fullWidth={true} alignItems="flex-start">
          {phoneNumbers.map((pn, idx) => (
            <Kb.PhoneInput
              key={pn.key}
              autoFocus={idx === 0}
              {...(defaultCountry === undefined ? {} : {defaultCountry})}
              onChangeNumber={(phoneNumber, valid) => setPhoneNumber(idx, phoneNumber, valid)}
              {...(phoneNumbers.length === 1 ? {} : {onClear: () => removePhoneNumber(idx)})}
              onEnterKeyDown={maybeSubmit}
            />
          ))}
          <Kb.IconButton mode="Secondary" icon="iconfont-new" onClick={addPhoneNumber} />
        </Kb.Box2>
      </Kb.Box2>
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.modalFooter}>
          <Kb.Button
            waiting={waiting}
            fullWidth={true}
            label="Continue"
            onClick={onContinue}
            disabled={disabled}
          />
      </Kb.Box2>
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
  modalFooter: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
      borderStyle: 'solid' as const,
      borderTopColor: Kb.Styles.globalColors.black_10,
      borderTopWidth: 1,
      minHeight: 56,
    },
    isElectron: {
      borderBottomLeftRadius: Kb.Styles.borderRadius,
      borderBottomRightRadius: Kb.Styles.borderRadius,
      overflow: 'hidden',
    },
  }),
}))

export default AddPhone
