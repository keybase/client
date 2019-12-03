import * as React from 'react'
import * as Kb from '../../common-adapters'
import {WaveButton} from '../../settings/contacts-joined/buttons'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as ProfileGen from '../../actions/profile-gen'
import * as Chat2Gen from '../../actions/chat2-gen'
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

  const buttonRow = (
    <Kb.ButtonBar
      fullWidth={Styles.isMobile}
      direction={Styles.isMobile ? 'column' : 'row'}
      style={styles.button}
    >
      {!team && (
        <WaveButton small={true} usernames={[adder, ...(others || [])].join(',')} style={styles.button} />
      )}
      {!team && others.length === 0 && (
        <Kb.Button
          label="View profile"
          style={styles.button}
          small={true}
          mode="Secondary"
          onClick={() => dispatch(ProfileGen.createShowUserProfile({username: adder}))}
        />
      )}
      {team && (
        <Kb.Button
          label="View team"
          style={styles.button}
          mode="Secondary"
          small={true}
          onClick={() =>
            dispatch(nav.safeNavigateAppendPayload({path: [{props: {teamID}, selected: 'team'}]}))
          }
        />
      )}
      <Kb.Button
        label="Block"
        type="Danger"
        mode="Secondary"
        style={styles.button}
        small={true}
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
    </Kb.ButtonBar>
  )
  return Styles.isMobile ? (
    <Kb.Box2
      direction="vertical"
      centerChildren={true}
      gap="tiny"
      style={{marginBottom: Styles.globalMargins.xsmall}}
      fullWidth={true}
    >
      <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true} centerChildren={true}>
        <Kb.Text type="BodySmall">
          {team ? `${adder} added you to this team.` : `You don't seem to know ${adder}.`}
        </Kb.Text>
        <Kb.Icon type="iconfont-remove" onClick={() => Chat2Gen.createDismissBlockButtons({teamID})} />
      </Kb.Box2>
      <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true}>
        {buttonRow}
      </Kb.Box2>
    </Kb.Box2>
  ) : (
    <Kb.Box2 direction="horizontal" gap="xsmall" style={styles.container} centerChildren={false}>
      <Kb.Text type="BodySmall">
        {team ? `${adder} added you to this team.` : `You don't seem to know ${adder}.`}
      </Kb.Text>
      {buttonRow}
      <Kb.Icon type="iconfont-remove" onClick={() => Chat2Gen.createDismissBlockButtons({teamID})} />
    </Kb.Box2>
  )
}

export default BlockButtons

const styles = Styles.styleSheetCreate(
  () =>
    ({
      button: Styles.platformStyles({
        isElectron: {
          width: '',
        },
        isMobile: {
          ...Styles.padding(0, Styles.globalMargins.small),
        },
      }),
      container: Styles.platformStyles({
        common: {
          alignItems: 'center',
        },
        isElectron: {
          alignSelf: 'flex-start',
          marginLeft: Styles.globalMargins.small + 1,
        },
        isMobile: {
          marginBottom: Styles.globalMargins.tiny,
        },
      }),
    } as const)
)
