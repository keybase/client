import * as React from 'react'
// import * as Container from '../util/container'
// import * as Constants from '../constants/settings'
// import * as SettingsGen from '../actions/settings-gen'
// import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import FollowButton from '../../profile/user/actions/follow-button'

type ResolvedContactEntry = {
  username: string
  contactLabel: string
}
type Props = {
  people: Array<ResolvedContactEntry>
}
const todo = () => console.log('TODO')
const ContactsJoinedModal = (props: Props) => (
  <Kb.Modal
    header={{
      leftButton: (
        <Kb.Text type="BodyBigLink" onClick={todo}>
          Done
        </Kb.Text>
      ),
    }}
  >
    <Kb.Text type="Body" style={styles.woot} center>
      Woot! Some of your contacts are already on Keybase.
    </Kb.Text>
    <Kb.ScrollView>
      <Kb.Box2 direction="vertical" fullWidth>
        {props.people.map(({username, contactLabel}) => (
          <Kb.Box2 direction="horizontal" key={username} fullWidth>
            <Kb.Box style={styles.avatar}>
              <Kb.Avatar username={username} size={48} />
            </Kb.Box>
            <Kb.Box2 direction="vertical" style={styles.rightBox}>
              <Kb.ConnectedUsernames colorFollowing={true} type="BodySemibold" usernames={[username]} />
              <Kb.Text type="BodySmall">{contactLabel}</Kb.Text>
              <Kb.Box2 direction="horizontal" gap="tiny" fullWidth style={styles.buttons}>
                <FollowButton onFollow={todo} onUnfollow={todo} waitingKey={getWaitingKey(username)} small />
                <WaveButton username={username} small />
              </Kb.Box2>
              <Kb.Divider style={styles.divider} />
            </Kb.Box2>
          </Kb.Box2>
        ))}
      </Kb.Box2>
    </Kb.ScrollView>
  </Kb.Modal>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      avatar: {
        marginLeft: Styles.globalMargins.tiny,
        marginRight: Styles.globalMargins.small,
      },
      buttons: {
        marginBottom: Styles.globalMargins.tiny,
        marginTop: Styles.globalMargins.xtiny,
      },
      divider: {
        marginBottom: Styles.globalMargins.tiny,
        marginTop: Styles.globalMargins.tiny,
      },
      rightBox: {flexGrow: 1},
      woot: {
        marginBottom: Styles.globalMargins.small,
        marginLeft: Styles.globalMargins.medium,
        marginRight: Styles.globalMargins.medium,
        marginTop: Styles.globalMargins.small,
      },
    } as const)
)

export default ContactsJoinedModal
