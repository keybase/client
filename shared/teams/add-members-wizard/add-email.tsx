import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {addMembersToWizardAndNav, searchResultsToMembers, type AddMembersWizard} from './state'

type Props = {
  wizard: AddMembersWizard
  errorMessage?: string
}

const waitingKey = 'emailLookup'

const AddEmail = (props: Props) => {
  const styles = useStyles()
  const [invitees, setInvitees] = React.useState('')
  const [error, setError] = React.useState('')
  const disabled = invitees.length < 1
  const waiting = C.Waiting.useAnyWaiting(waitingKey)

  const emailsToAssertionsRPC = C.useRPC(T.RPCGen.userSearchBulkEmailOrPhoneSearchRpcPromise)
  const onContinue = () => {
    setError('')
    emailsToAssertionsRPC(
      [{emails: invitees}, waitingKey],
      r => {
        if (!r?.length) {
          setError('You must enter at least one valid email address.')
          return
        }
        C.ignorePromise(addMembersToWizardAndNav(props.wizard, searchResultsToMembers(r), setError))
      },
      err => setError(err.message)
    )
  }

  const maybeSubmit = (evt: React.KeyboardEvent) => {
    if (!disabled && evt.key === 'Enter' && (evt.ctrlKey || evt.metaKey)) {
      onContinue()
    }
  }

  return (
    <Kb.ModalScreen
      banner={<Kb.ErrorBanner error={error} />}
      footer={
        <Kb.Button fullWidth={true} label="Continue" onClick={onContinue} disabled={disabled} waiting={waiting} />
      }
    >
      <Kb.Box2 direction="vertical" fullWidth={true} gap={isMobile ? 'tiny' : 'xsmall'}>
        <Kb.Text type="Body">Enter one or multiple email addresses:</Kb.Text>
        <Kb.Box2 direction="vertical" gap="tiny" alignItems="flex-start">
          <Kb.Input3
            textType="BodySemibold"
            autoFocus={true}
            error={!!props.errorMessage}
            multiline={true}
            onChangeText={text => setInvitees(text)}
            placeholder="Email addresses"
            rowsMin={3}
            rowsMax={8}
            value={invitees}
            onKeyDown={maybeSubmit}
          />
          {!!props.errorMessage && (
            <Kb.Text type="BodySmall" style={styles.errorText}>
              {props.errorMessage}
            </Kb.Text>
          )}
        </Kb.Box2>
        <Kb.Text type="BodySmall">Separate all addresses with commas.</Kb.Text>
      </Kb.Box2>
    </Kb.ModalScreen>
  )
}

const useStyles = Kb.Styles.createStyleHook(theme => ({
  errorText: {color: theme.redDark},
}))

export default AddEmail
