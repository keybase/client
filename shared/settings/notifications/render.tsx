import * as Kb from '@/common-adapters'
import Group from '../group'
import {usePushState} from '@/stores/push'

type Props = {
  allowEdit: boolean
  groups: ReadonlyMap<
    string,
    {
      settings: ReadonlyArray<{
        description: string
        name: string
        subscribed: boolean
      }>
      unsub: boolean
    }
  >
  onClickYourAccount: () => void
  onToggle: (groupName: string, name: string) => void
  onToggleUnsubscribeAll: (groupName: string) => void
  showEmailSection: boolean
}

const EmailSection = (props: Pick<Props, 'allowEdit' | 'onToggle' | 'onToggleUnsubscribeAll' | 'groups'>) => (
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
  const mobileHasPermissions = usePushState(s => s.hasPermissions)
  return !props.groups.get('email')?.settings ? (
    <Kb.Box2 direction="vertical" justifyContent="center" flex={1} style={styles.loading}>
      <Kb.ProgressIndicator type="Small" style={{width: Kb.Styles.globalMargins.medium}} />
    </Kb.Box2>
  ) : (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.main}>
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
      {(!Kb.Styles.isMobile || mobileHasPermissions) && !!props.groups.get('app_push')?.settings ? (
        <>
          <Kb.Divider style={styles.divider} />
          <PhoneSection {...props} />
        </>
      ) : null}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      divider: {
        marginBottom: Kb.Styles.globalMargins.small,
        marginLeft: -Kb.Styles.globalMargins.small,
        marginTop: Kb.Styles.globalMargins.small,
      },
      loading: {alignItems: 'center'},
      main: Kb.Styles.platformStyles({
        common: {flex: 1, padding: Kb.Styles.globalMargins.small, paddingRight: 0},
        isElectron: Kb.Styles.desktopStyles.scrollable,
      }),
    }) as const
)

export default Notifications
