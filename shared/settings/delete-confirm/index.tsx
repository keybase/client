import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {useSafeNavigation} from '@/util/safe-navigation'
import {usePWState} from '@/stores/settings-password'
import {useSettingsState} from '@/stores/settings'
import {useCurrentUserState} from '@/stores/current-user'

type CheckboxesProps = {
  checkData: boolean
  checkTeams: boolean
  checkUsername: boolean
  onCheckData: (checked: boolean) => void
  onCheckTeams: (checked: boolean) => void
  onCheckUsername: (checked: boolean) => void
}

const Checkboxes = (props: CheckboxesProps) => (
  <Kb.Box2 direction="vertical" style={styles.checkbox} fullWidth={true} gap="tiny">
    <Kb.Checkbox
      checked={props.checkUsername}
      label="No one will be able to use this username ever, including yourself."
      onCheck={checked => props.onCheckUsername(checked)}
    />
    <Kb.Checkbox
      checked={props.checkData}
      label="You will lose your personal chats, files and git data."
      onCheck={checked => props.onCheckData(checked)}
    />
    <Kb.Checkbox
      checked={props.checkTeams}
      label="You will be removed from teams. If you were the last owner or admin of a team, it'll be orphaned and unrecoverable."
      onCheck={checked => props.onCheckTeams(checked)}
    />
  </Kb.Box2>
)

const DeleteConfirm = () => {
  const hasPassword = usePWState(s => !s.randomPW)
  const deleteAccountForever = useSettingsState(s => s.dispatch.deleteAccountForever)
  const username = useCurrentUserState(s => s.username)
  const [checkData, setCheckData] = React.useState(false)
  const [checkTeams, setCheckTeams] = React.useState(false)
  const [checkUsername, setCheckUsername] = React.useState(false)
  const nav = useSafeNavigation()
  const onCancel = () => nav.safeNavigateUp()
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onDeleteForever = () => {
    if (C.androidIsTestDevice) {
      // dont do this in a preflight test
      return
    }
    if (Kb.Styles.isMobile && hasPassword) {
      navigateAppend('checkPassphraseBeforeDeleteAccount')
    } else {
      deleteAccountForever()
    }
  }

  return (
    <Kb.ConfirmModal
      confirmText="Yes, permanently delete it"
      content={
        <Checkboxes
          checkData={checkData}
          checkTeams={checkTeams}
          checkUsername={checkUsername}
          onCheckData={setCheckData}
          onCheckTeams={setCheckTeams}
          onCheckUsername={setCheckUsername}
        />
      }
      description="This cannot be undone. By deleting this account, you agree that:"
      header={
        <>
          <Kb.Avatar username={username} size={64} />
          <Kb.Icon type="icon-team-delete-28" style={{marginRight: -60, marginTop: -20, zIndex: 1}} />
        </>
      }
      onCancel={onCancel}
      onConfirm={onDeleteForever}
      onConfirmDeactivated={!checkUsername || !checkData || !checkTeams}
      prompt="Permanently delete your account?"
    />
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  checkbox: Kb.Styles.platformStyles({
    isMobile: {
      padding: Kb.Styles.globalMargins.mediumLarge,
    },
  }),
}))

export default DeleteConfirm
