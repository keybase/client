import * as C from '../../../../constants'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

type Props = {
  teamID: string
}
const AddBotRow = (props: Props) => {
  const {teamID} = props
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onBotAdd = () => navigateAppend({props: {teamID}, selected: 'chatSearchBots'})

  return (
    <Kb.Box2 direction="horizontal" alignItems="center" style={styles.container}>
      <Kb.Button type="Default" mode="Secondary" label="Install bots" onClick={onBotAdd} />
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        marginTop: Styles.globalMargins.medium,
      },
    }) as const
)

export default AddBotRow
