import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import Group from '../group'
import {usePushState} from '@/stores/push'
import {useShellState} from '@/stores/shell'
import * as C from '@/constants'

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

const DesktopSection = () => {
  const {desktopNotifications, loaded, setDesktopNotifications} = useShellState(
    C.useShallow(s => ({
      desktopNotifications: s.desktopNotifications,
      loaded: s.desktopNotificationsLoaded,
      setDesktopNotifications: s.dispatch.setDesktopNotifications,
    }))
  )
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
      <Kb.Text type="Header">Desktop notifications</Kb.Text>
      <Kb.Checkbox
        checked={desktopNotifications}
        disabled={!loaded}
        label="Show desktop notifications"
        labelSubtitle="Messages, Files alerts and app updates on this computer."
        onCheck={setDesktopNotifications}
      />
    </Kb.Box2>
  )
}

const Spinner = () => (
  <Kb.Box2 alignSelf="center" direction="vertical" centerChildren={true} flex={1}>
    <Kb.ProgressIndicator type="Small" style={{width: Kb.Styles.globalMargins.medium}} />
  </Kb.Box2>
)

const Notifications = (props: Props) => {
  const styles = useStyles()
  const {allowEdit, groups, onClickYourAccount, onToggle, onToggleUnsubscribeAll, showEmailSection} = props
  const mobileHasPermissions = usePushState(s => s.hasPermissions)
  const hasLoadedGroups = groups.size > 0
  // Desktop settings are local, so they show while the server's groups load
  if (!hasLoadedGroups && isMobile) return <Spinner />

  const emailGroup = groups.get('email')
  const sections: Array<{key: string; node: React.ReactNode}> = []
  if (!isMobile) {
    sections.push({key: 'desktop', node: <DesktopSection />})
  }
  if (hasLoadedGroups) {
    if (emailGroup) {
      sections.push({
        key: 'email',
        node: (
          <Group
            allowEdit={allowEdit}
            groupName="email"
            label="All email notifications will be sent to your primary email address."
            onToggle={onToggle}
            onToggleUnsubscribeAll={() => onToggleUnsubscribeAll('email')}
            title="Email notifications"
            unsub="email"
            settings={emailGroup.settings}
            unsubscribedFromAll={emailGroup.unsub}
          />
        ),
      })
    } else if (!showEmailSection) {
      sections.push({
        key: 'email',
        node: (
          <Kb.Box2 direction="vertical" fullWidth={true}>
            <Kb.Text type="Header">Email notifications</Kb.Text>
            <Kb.Text type="BodySmall">
              Go to{' '}
              <Kb.Text type="BodySmallSemiboldSecondaryLink" onClick={onClickYourAccount}>
                Your account
              </Kb.Text>{' '}
              and add an email address.
            </Kb.Text>
          </Kb.Box2>
        ),
      })
    }
    const pushGroup = groups.get('app_push')
    if ((!isMobile || mobileHasPermissions) && pushGroup?.settings) {
      sections.push({
        key: 'phone',
        node: (
          <Group
            allowEdit={allowEdit}
            label="Notifications sent directly to your phone."
            groupName="app_push"
            onToggle={onToggle}
            onToggleUnsubscribeAll={() => onToggleUnsubscribeAll('app_push')}
            title="Phone notifications"
            unsub="phone"
            settings={pushGroup.settings}
            unsubscribedFromAll={pushGroup.unsub}
          />
        ),
      })
    }
  }

  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      flex={1}
      style={styles.main}
      testID={hasLoadedGroups ? TestIDs.SETTINGS_NOTIFICATIONS : undefined}
    >
      {sections.map((section, i) => (
        <React.Fragment key={section.key}>
          {i > 0 ? <Kb.Divider style={styles.divider} /> : null}
          {section.node}
        </React.Fragment>
      ))}
      {hasLoadedGroups ? null : <Spinner />}
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  () =>
    ({
      divider: {
        marginBottom: Kb.Styles.globalMargins.small,
        marginLeft: -Kb.Styles.globalMargins.small,
        marginTop: Kb.Styles.globalMargins.small,
      },
      main: Kb.Styles.platformStyles({
        common: {padding: Kb.Styles.globalMargins.small, paddingRight: 0},
        isElectron: Kb.Styles.desktopStyles.scrollable,
      }),
    }) as const
)

export default Notifications
