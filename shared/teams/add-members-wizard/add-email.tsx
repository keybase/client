import * as C from '../../constants'
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as RPCGen from '../../constants/types/rpc-gen'
import {ModalTitle} from '../common'

type Props = {
  errorMessage?: string
}

const waitingKey = 'emailLookup'

const AddEmail = (props: Props) => {
  const [invitees, setInvitees] = React.useState('')
  const [error, setError] = React.useState('')
  const nav = Container.useSafeNavigation()
  const onBack = () => nav.safeNavigateUp()
  const disabled = invitees.length < 1
  const waiting = Container.useAnyWaiting(waitingKey)
  const teamID = C.useTeamsState(s => s.addMembersWizard.teamID)
  const addMembersWizardPushMembers = C.useTeamsState(s => s.dispatch.addMembersWizardPushMembers)

  const emailsToAssertionsRPC = Container.useRPC(RPCGen.userSearchBulkEmailOrPhoneSearchRpcPromise)
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
    if (!disabled && evt && evt.key === 'Enter' && (evt.ctrlKey || evt.metaKey)) {
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
        gap={Styles.isMobile ? 'tiny' : 'xsmall'}
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

const styles = Styles.styleSheetCreate(() => ({
  body: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.small),
      backgroundColor: Styles.globalColors.blueGrey,
      flex: 1,
    },
    isMobile: {...Styles.globalStyles.flexOne},
  }),
  container: {
    padding: Styles.globalMargins.small,
  },
  errorText: {color: Styles.globalColors.redDark},
  wordBreak: Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
}))

export default AddEmail
