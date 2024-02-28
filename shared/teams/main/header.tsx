import * as Kb from '@/common-adapters'
import * as Styles from '@/styles'

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
    style={Styles.platformStyles({
      common: {marginBottom: Styles.globalMargins.xtiny, paddingRight: Styles.globalMargins.small},
      isElectron: {...Styles.desktopStyles.windowDraggingClickable},
    })}
  >
    <Kb.Button label="Create a team" onClick={props.onCreateTeam} small={true} />
    <Kb.Button label="Join a team" onClick={props.onJoinTeam} small={true} type="Default" mode="Secondary" />
  </Kb.Box2>
)

export {HeaderRightActions}
