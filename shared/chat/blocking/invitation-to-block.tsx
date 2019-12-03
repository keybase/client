import * as React from 'react'
import * as Kb from '../../common-adapters'
import {WaveButton} from '../../settings/contacts-joined/buttons'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as ProfileGen from '../../actions/profile-gen'
type Props = {conversationID: string}

const BlockButtons = (props: Props) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const conversationMeta = Container.useSelector(state => state.chat2.metaMap.get(props.conversationID))
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

  return (
    <Kb.Box2 direction="vertical" gap="tiny" centerChildren={true} gapEnd={true}>
      <Kb.Text type="BodySmall">
        {team ? `${adder} added you to this team.` : `You don't seem to know ${adder}.`}
      </Kb.Text>
      {!team && <WaveButton usernames={[adder, ...(others || [])].join(',')} style={styles.button} />}
      {!team && others.length === 0 && (
        <Kb.Button
          label="View Profile"
          style={styles.button}
          mode="Secondary"
          onClick={() => dispatch(ProfileGen.createShowUserProfile({username: adder}))}
        />
      )}
      {team && (
        <Kb.Button
          label="View team"
          style={styles.button}
          mode="Secondary"
          onClick={() =>
            dispatch(nav.safeNavigateAppendPayload({path: [{props: {teamID}, selected: 'team'}]}))
          }
        />
      )}
      <Kb.Button
        label="Block"
        type="Danger"
        style={styles.button}
        onClick={() =>
          dispatch(
            nav.safeNavigateAppendPayload({
              path: [
                {
                  props: {
                    blockByDefault: true,
                    convID: props.conversationID,
                    others: others,
                    team: team,
                    username: adder,
                  },
                  selected: 'chatBlockingModal',
                },
              ],
            })
          )
        }
      />
    </Kb.Box2>
  )
}

export default BlockButtons

const styles = Styles.styleSheetCreate(
  () =>
    ({
      button: {
        ...Styles.padding(0, Styles.globalMargins.small),
        width: '100%',
      },
    } as const)
)
