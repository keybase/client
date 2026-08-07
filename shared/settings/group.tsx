import * as Kb from '@/common-adapters'

type GroupProps = {
  allowEdit: boolean
  groupName: string
  label?: string
  onToggle: (groupName: string, name: string) => void
  onToggleUnsubscribeAll?: () => void
  settings?: ReadonlyArray<{
    description: string
    name: string
    subscribed: boolean
  }>
  title?: string
  unsub?: string
  unsubscribedFromAll: boolean
}

const Group = (props: GroupProps) => {
  const styles = useStyles()
  const {
    allowEdit,
    groupName,
    label,
    onToggle,
    onToggleUnsubscribeAll,
    settings,
    title,
    unsub,
    unsubscribedFromAll,
  } = props
  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      {!!title && <Kb.Text type="Header">{title}</Kb.Text>}
      {!!label && (
        <Kb.Text type="BodySmall" style={styles.label}>
          {label}
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
        {!!settings &&
          settings.map(s => (
            <Kb.Checkbox
              key={groupName + s.name}
              disabled={!allowEdit}
              onCheck={() => onToggle(groupName, s.name)}
              checked={s.subscribed}
              label={s.description}
            />
          ))}
      </Kb.Box2>
      {!!unsub && (
        <Kb.Box2 direction="vertical" alignSelf="flex-start" fullWidth={true}>
          <Kb.Text type="BodySmall">Or</Kb.Text>
          <Kb.Checkbox
            style={{marginTop: Kb.Styles.globalMargins.xtiny}}
            onCheck={onToggleUnsubscribeAll}
            disabled={!allowEdit}
            checked={!!unsubscribedFromAll}
            label={`Unsubscribe from all ${unsub} notifications`}
          />
        </Kb.Box2>
      )}
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  () =>
    ({
      label: {...Kb.Styles.marginV(Kb.Styles.globalMargins.xtiny)},
    }) as const
)

export default Group
