import * as React from 'react'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {FollowButton, WaveButton} from './buttons'

type ResolvedContactEntry = {
  username: string
  contactLabel: string
}
type Props = Container.RouteProps<{
  people: Array<ResolvedContactEntry>
}>

const ContactsJoinedModal = (props: Props) => {
  const people = Container.getRouteProps(props, 'people', [])
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onClose = () => dispatch(nav.safeNavigateUpPayload())
  return (
    <Kb.Modal
      header={{
        leftButton: (
          <Kb.Text type="BodyBigLink" onClick={onClose}>
            Done
          </Kb.Text>
        ),
      }}
    >
      <Kb.Text type="Body" style={styles.woot} center={true}>
        Woot! Some of your contacts are already on Keybase.
      </Kb.Text>
      <Kb.ScrollView>
        <Kb.Box2 direction="vertical" fullWidth={true}>
          {people.map(({username, contactLabel}) => (
            <Kb.Box2 direction="horizontal" key={username} fullWidth={true}>
              <Kb.Box style={styles.avatar}>
                <Kb.Avatar username={username} size={48} />
              </Kb.Box>
              <Kb.Box2 direction="vertical" style={styles.rightBox}>
                <Kb.ConnectedUsernames colorFollowing={true} type="BodySemibold" usernames={[username]} />
                <Kb.Text type="BodySmall">{contactLabel}</Kb.Text>
                <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true} style={styles.buttons}>
                  <FollowButton username={username} small={true} />
                  <WaveButton username={username} small={true} />
                </Kb.Box2>
                <Kb.Divider style={styles.divider} />
              </Kb.Box2>
            </Kb.Box2>
          ))}
        </Kb.Box2>
      </Kb.ScrollView>
    </Kb.Modal>
  )
}

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
