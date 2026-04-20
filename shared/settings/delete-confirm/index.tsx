import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {useSafeNavigation} from '@/util/safe-navigation'
import {useDeleteAccount} from '../use-delete-account'
import {useCurrentUserState} from '@/stores/current-user'
import {useRandomPWState} from '../use-random-pw'

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
  const {randomPW, reload} = useRandomPWState()
  const needsMobilePassphraseCheck = Kb.Styles.isMobile && randomPW !== true
  const deleteAccountForever = useDeleteAccount()
  const username = useCurrentUserState(s => s.username)
  const [checkData, setCheckData] = React.useState(false)
  const [checkTeams, setCheckTeams] = React.useState(false)
  const [checkUsername, setCheckUsername] = React.useState(false)
  const nav = useSafeNavigation()
  const onCancel = () => nav.safeNavigateUp()
  const navigateAppend = C.Router2.navigateAppend
  const onDeleteForever = () => {
    if (C.androidIsTestDevice) {
      // dont do this in a preflight test
      return
    }
    if (needsMobilePassphraseCheck) {
      navigateAppend({name: 'checkPassphraseBeforeDeleteAccount', params: {}})
    } else {
      deleteAccountForever()
    }
  }

  return (
    <Kb.ConfirmModal
      confirmText="Yes, permanently delete it"
      content={
        <Kb.Box2 direction="vertical" fullWidth={true}>
          {randomPW === undefined ? (
            <Kb.Box2 direction="vertical" gap="xtiny" style={styles.randomPWStatus} fullWidth={true}>
              <Kb.Text type="BodySmall">
                Still checking whether this account has a password. You can continue, or retry the check.
              </Kb.Text>
              <Kb.Text type="BodySmallPrimaryLink" onClick={reload}>
                Retry password check
              </Kb.Text>
            </Kb.Box2>
          ) : null}
          <Checkboxes
            checkData={checkData}
            checkTeams={checkTeams}
            checkUsername={checkUsername}
            onCheckData={setCheckData}
            onCheckTeams={setCheckTeams}
            onCheckUsername={setCheckUsername}
          />
        </Kb.Box2>
      }
      description="This cannot be undone. By deleting this account, you agree that:"
      header={
        <>
          <Kb.Avatar username={username} size={64} />
          <Kb.ImageIcon type="icon-team-delete-28" style={{marginRight: -60, marginTop: -20, zIndex: 1}} />
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
  randomPWStatus: {
    padding: Kb.Styles.globalMargins.small,
    paddingBottom: 0,
  },
}))

export default DeleteConfirm
