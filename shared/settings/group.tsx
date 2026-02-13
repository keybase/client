import * as Kb from '@/common-adapters'
import type {NotificationsSettingsState} from '@/stores/settings-notifications'

type GroupProps = {
  allowEdit: boolean
  groupName: string
  label?: string
  onToggle: (groupName: string, name: string) => void
  onToggleUnsubscribeAll?: () => void
  settings?: ReadonlyArray<NotificationsSettingsState>
  title?: string
  unsub?: string
  unsubscribedFromAll: boolean
}

const Group = (props: GroupProps) => (
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
          style={{marginTop: Kb.Styles.globalMargins.xtiny}}
          onCheck={props.onToggleUnsubscribeAll}
          disabled={!props.allowEdit}
          checked={!!props.unsubscribedFromAll}
          label={`Unsubscribe from all ${props.unsub} notifications`}
        />
      </Kb.Box2>
    )}
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      label: {marginBottom: Kb.Styles.globalMargins.xtiny, marginTop: Kb.Styles.globalMargins.xtiny},
    }) as const
)

export default Group
