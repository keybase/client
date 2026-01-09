import * as C from '@/constants'
import * as React from 'react'
import {useTeamsState} from '@/stores/teams'
import * as Kb from '@/common-adapters'
import {useSafeNavigation} from '@/util/safe-navigation'
import * as T from '@/constants/types'
import {ModalTitle} from '../common'

type Props = {
  errorMessage?: string
}

const waitingKey = 'emailLookup'

const AddEmail = (props: Props) => {
  const [invitees, setInvitees] = React.useState('')
  const [error, setError] = React.useState('')
  const nav = useSafeNavigation()
  const onBack = () => nav.safeNavigateUp()
  const disabled = invitees.length < 1
  const waiting = C.Waiting.useAnyWaiting(waitingKey)
  const teamID = useTeamsState(s => s.addMembersWizard.teamID)
  const addMembersWizardPushMembers = useTeamsState(s => s.dispatch.addMembersWizardPushMembers)

  const emailsToAssertionsRPC = C.useRPC(T.RPCGen.userSearchBulkEmailOrPhoneSearchRpcPromise)
  const onContinue = () => {
    setError('')
    emailsToAssertionsRPC(
      [{emails: invitees}, waitingKey],
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
          : setError('You must enter at least one valid email address.'),
      err => setError(err.message)
    )
  }

  const maybeSubmit = (evt: React.KeyboardEvent) => {
    if (!disabled && evt.key === 'Enter' && (evt.ctrlKey || evt.metaKey)) {
      onContinue()
    }
  }

  return (
    <Kb.Modal
      header={{
        leftButton: <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />,
        title: <ModalTitle teamID={teamID} title="Email list" />,
      }}
      allowOverflow={true}
      footer={{
        content: (
          <Kb.Button
            fullWidth={true}
            label="Continue"
            onClick={onContinue}
            disabled={disabled}
            waiting={waiting}
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
      mode="DefaultFullHeight"
    >
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={styles.body}
        gap={Kb.Styles.isMobile ? 'tiny' : 'xsmall'}
      >
        <Kb.Text type="Body">Enter one or multiple email addresses:</Kb.Text>
        <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true} alignItems="flex-start">
          <Kb.LabeledInput
            autoFocus={true}
            error={!!props.errorMessage}
            multiline={true}
            onChangeText={text => setInvitees(text)}
            placeholder="Email addresses"
            hoverPlaceholder="Ex: daniel@domain.com, kim@domain.com, etc."
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
    </Kb.Modal>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  body: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
      backgroundColor: Kb.Styles.globalColors.blueGrey,
      flex: 1,
    },
    isMobile: {...Kb.Styles.globalStyles.flexOne},
  }),
  container: {
    padding: Kb.Styles.globalMargins.small,
  },
  errorText: {color: Kb.Styles.globalColors.redDark},
  wordBreak: Kb.Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
}))

export default AddEmail
