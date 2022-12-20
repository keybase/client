import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import type * as Types from '../../constants/types/settings'
import type {Props} from './index'

type GroupProps = {
  allowEdit: boolean
  groupName: string
  label?: string
  onToggle: (groupName: string, name: string) => void
  onToggleUnsubscribeAll?: () => void
  settings: Array<Types.NotificationsSettingsState> | null
  title?: string
  unsub?: string
  unsubscribedFromAll: boolean
}

export const Group = (props: GroupProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    {!!props.title && <Kb.Text type="Header">{props.title}</Kb.Text>}
    {!!props.label && (
      <Kb.Text type="BodySmall" style={styles.label}>
        {props.label}
      </Kb.Text>
    )}
    <Kb.Box2
      direction="vertical"
      gap="xtiny"
      gapStart={true}
      gapEnd={true}
      alignSelf="flex-start"
      fullWidth={true}
    >
      {!!props.settings &&
        props.settings.map(s => (
          <Kb.Checkbox
            key={props.groupName + s.name}
            disabled={!props.allowEdit}
            onCheck={() => props.onToggle(props.groupName, s.name)}
            checked={s.subscribed}
            label={s.description}
          />
        ))}
    </Kb.Box2>
    {!!props.unsub && (
      <Kb.Box2 direction="vertical" alignSelf="flex-start" fullWidth={true}>
        <Kb.Text type="BodySmall">Or</Kb.Text>
        <Kb.Checkbox
          style={{marginTop: Styles.globalMargins.xtiny}}
          onCheck={props.onToggleUnsubscribeAll || null}
          disabled={!props.allowEdit}
          checked={!!props.unsubscribedFromAll}
          label={`Unsubscribe from all ${props.unsub} notifications`}
        />
      </Kb.Box2>
    )}
  </Kb.Box2>
)
const EmailSection = (props: Props) => (
  <Group
    allowEdit={props.allowEdit}
    groupName="email"
    label="All email notifications will be sent to your primary email address."
    onToggle={props.onToggle}
    onToggleUnsubscribeAll={() => props.onToggleUnsubscribeAll('email')}
    title="Email notifications"
    unsub="email"
    settings={props.groups.get('email')!.settings}
    unsubscribedFromAll={props.groups.get('email')!.unsub}
  />
)
const PhoneSection = (props: Props) => (
  <Group
    allowEdit={props.allowEdit}
    label="Notifications sent directly to your phone."
    groupName="app_push"
    onToggle={props.onToggle}
    onToggleUnsubscribeAll={() => props.onToggleUnsubscribeAll('app_push')}
    title="Phone notifications"
    unsub="phone"
    settings={props.groups.get('app_push')!.settings}
    unsubscribedFromAll={props.groups.get('app_push')!.unsub}
  />
)
const Notifications = (props: Props) => {
  const mobileHasPermissions = Container.useSelector(state => state.push.hasPermissions)
  return !props.groups || !props.groups.get('email')?.settings ? (
    <Kb.Box2 direction="vertical" style={styles.loading}>
      <Kb.ProgressIndicator type="Small" style={{width: Styles.globalMargins.medium}} />
    </Kb.Box2>
  ) : (
    <Kb.Box style={styles.main}>
      {props.showEmailSection ? (
        <EmailSection {...props} />
      ) : (
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Text type="Header">Email notifications</Kb.Text>
          <Kb.Text type="BodySmall">
            Go to{' '}
            <Kb.Text type="BodySmallSemiboldSecondaryLink" onClick={props.onClickYourAccount}>
              Your account
            </Kb.Text>{' '}
            and add an email address.
          </Kb.Text>
        </Kb.Box2>
      )}
      {(!Styles.isMobile || mobileHasPermissions) && !!props.groups.get('app_push')?.settings ? (
        <>
          <Kb.Divider style={styles.divider} />
          <PhoneSection {...props} />
        </>
      ) : null}
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      checkbox: {marginRight: 0, marginTop: Styles.globalMargins.xtiny},
      divider: {
        marginBottom: Styles.globalMargins.small,
        marginLeft: -Styles.globalMargins.small,
        marginTop: Styles.globalMargins.small,
      },
      label: {marginBottom: Styles.globalMargins.xtiny, marginTop: Styles.globalMargins.xtiny},
      loading: {alignItems: 'center', flex: 1, justifyContent: 'center'},
      main: Styles.platformStyles({
        common: {flex: 1, padding: Styles.globalMargins.small, paddingRight: 0, width: '100%'},
        isElectron: Styles.desktopStyles.scrollable,
      }),
    } as const)
)

export default Notifications
