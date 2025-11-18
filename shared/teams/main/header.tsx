import * as Kb from '@/common-adapters'

export type HeaderButtonProps = {
  iconType: Kb.IconType
  label: string
  onClick: () => void
}

export type Props = {
  onCreateTeam: () => void
  onJoinTeam: () => void
}

const HeaderRightActions = (props: Props) => (
  <Kb.Box2
    gap="tiny"
    direction="horizontal"
    alignItems="center"
    style={Kb.Styles.platformStyles({
      common: {marginBottom: Kb.Styles.globalMargins.xtiny, paddingRight: Kb.Styles.globalMargins.small},
      isElectron: {...Styles.desktopStyles.windowDraggingClickable},
    })}
  >
    <Kb.Button label="Create a team" onClick={props.onCreateTeam} small={true} />
    <Kb.Button label="Join a team" onClick={props.onJoinTeam} small={true} type="Default" mode="Secondary" />
  </Kb.Box2>
)

export {HeaderRightActions}
