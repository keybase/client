import * as C from '@/constants'
import * as Kb from '@/common-adapters'

type Props = {
  teamID: string
}
const AddBotRow = (props: Props) => {
  const styles = useStyles()
  const {teamID} = props

  return (
    <Kb.Box2 direction="horizontal" alignItems="center" style={styles.container}>
      <Kb.Button
        type="Default"
        mode="Secondary"
        label="Install bots"
        onClick={() => C.Router2.navigateAppend({name: 'chatSearchBots', params: {teamID}})}
      />
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  () =>
    ({
      container: {
        marginTop: Kb.Styles.globalMargins.medium,
      },
    }) as const
)

export default AddBotRow
