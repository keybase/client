import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Container from '../../../../util/container'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Chat2Constants from '../../../../constants/chat2'
import * as TeamConstants from '../../../../constants/teams'
import * as Styles from '../../../../styles'

type Props = {
  teamID: string
}
const AddBotRow = (props: Props) => {
  const {teamID} = props
  const dispatch = Container.useDispatch()
  const generalChannel = Container.useSelector(state =>
    Chat2Constants.getChannelForTeam(state, TeamConstants.getTeamNameFromID(state, teamID) ?? '', 'general')
  )
  const onBotAdd = () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {
              conversationIDKey: generalChannel.conversationIDKey,
              namespace: 'chat2',
            },
            selected: 'chatSearchBots',
          },
        ],
      })
    )

  return (
    <Kb.Box2 direction="horizontal" alignItems="center" style={styles.container}>
      <Kb.Button type="Default" mode="Secondary" label="Install more bots" onClick={onBotAdd} />
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
