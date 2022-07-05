import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import * as SettingsGen from '../../actions/settings-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'

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
  const hasPassword = Container.useSelector(state => !state.settings.password.randomPW)
  const username = Container.useSelector(state => state.config.username)

  const [checkData, setCheckData] = React.useState(false)
  const [checkTeams, setCheckTeams] = React.useState(false)
  const [checkUsername, setCheckUsername] = React.useState(false)

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const onCancel = () => dispatch(nav.safeNavigateUpPayload())
  const onDeleteForever = () =>
    Styles.isMobile && hasPassword
      ? dispatch(RouteTreeGen.createNavigateAppend({path: ['checkPassphraseBeforeDeleteAccount']}))
      : dispatch(SettingsGen.createDeleteAccountForever())

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

const styles = Styles.styleSheetCreate(() => ({
  checkbox: Styles.platformStyles({
    isMobile: {
      padding: Styles.globalMargins.mediumLarge,
    },
  }),
}))

export default DeleteConfirm
