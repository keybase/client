import * as React from 'react'
import * as Kb from '../../common-adapters'
import {WaveButton} from '../../settings/contacts-joined/buttons'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as ProfileGen from '../../actions/profile-gen'
// import * as RouteTreeGen from '../../actions/route-tree-gen'
type Props = {adder: string; others?: Array<string>; team?: string}

const todo = () => console.log('TODO')
const BlockButtons = (props: Props) => {
  const dispatch = Container.useDispatch()
  return (
    <Kb.Box2 direction="vertical" gap="tiny" centerChildren={true} gapEnd={true}>
      <Kb.Text type="BodySmall">
        {props.team ? `${props.adder} added you to this team.` : `You don't seem to know ${props.adder}.`}
      </Kb.Text>
      {!props.team && (
        <WaveButton usernames={[props.adder, ...(props.others || [])].join(',')} style={styles.button} />
      )}
      {!props.team && !props.others && (
        <Kb.Button
          label="View Profile"
          style={styles.button}
          mode="Secondary"
          onClick={() => dispatch(ProfileGen.createShowUserProfile({username: props.adder}))}
        />
      )}
      {props.team && (
        <Kb.Button
          label="View team"
          style={styles.button}
          mode="Secondary"
          onClick={
            () => {} // TODO: team name vs id
            //dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamID}, selected: 'team'}]}))
          }
        />
      )}
      <Kb.Button label="Block" type="Danger" style={styles.button} onClick={todo} />
    </Kb.Box2>
  )
}

export default BlockButtons

export const InvitationToBlock = (props: {conversationIDKey: string}) => {
  const conversationMeta = Container.useSelector(state => state.chat2.metaMap.get(props.conversationIDKey))
  const blockButtonsMap = Container.useSelector(state => state.chat2.blockButtonsMap)
  const currentUser = Container.useSelector(state => state.config.username)
  if (!conversationMeta) {
    return null
  }

  const teamID = conversationMeta.teamID
  const blockButtonInfo = blockButtonsMap.get(teamID)
  if (!blockButtonInfo) {
    return null
  }

  const adder = blockButtonInfo.adder
  const others = conversationMeta.participants.filter(person => person !== currentUser && person !== adder)
  const team = conversationMeta.teamname || undefined

  // TODO: collapse this all into one component and then make the stories work again
  return <BlockButtons adder={adder} others={others.length === 0 ? undefined : others} team={team} />
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      button: {
        ...Styles.padding(0, Styles.globalMargins.small),
        width: '100%',
      },
    } as const)
)
