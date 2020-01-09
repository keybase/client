import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Container from '../../../../util/container'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Styles from '../../../../styles'

type Props = {
  teamID: string
}
const AddBotRow = (props: Props) => {
  const {teamID} = props
  const dispatch = Container.useDispatch()
  const onBotAdd = () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {
              namespace: 'chat2',
              teamID,
            },
            selected: 'chatSearchBots',
          },
        ],
      })
    )

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
        marginTop: Styles.globalMargins.tiny,
      },
    } as const)
)

export default AddBotRow
