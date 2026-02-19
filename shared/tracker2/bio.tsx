import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {useTrackerState} from '@/stores/tracker2'
import {useFollowerState} from '@/stores/followers'

type OwnProps = {
  inTracker: boolean
  username: string
}

const Container = (ownProps: OwnProps) => {
  const {inTracker, username} = ownProps
  const stateProps = useTrackerState(
    C.useShallow(s => {
      const d = s.getDetails(username)
      const common = {
        blocked: d.blocked,
        followThem: undefined,
        followersCount: undefined,
        followingCount: undefined,
        followsYou: undefined,
        hidFromFollowers: d.hidFromFollowers,
        location: undefined,
        sbsDescription: undefined,
      }

      if (d.state === 'notAUserYet') {
        const nonUser = s.getNonUserDetails(username)
        return {
          ...common,
          bio: nonUser.bio,
          followThem: false,
          followsYou: false,
          fullname: nonUser.fullName,
          sbsDescription: nonUser.description,
        }
      } else {
        return {
          ...common,
          bio: d.bio,
          followersCount: d.followersCount,
          followingCount: d.followingCount,
          fullname: d.fullname,
          location: d.location,
        }
      }
    })
  )
  const {bio, followersCount, followingCount, fullname, location, blocked, hidFromFollowers, sbsDescription} =
    stateProps
  const followThem = useFollowerState(s => s.following.has(username))
  const followsYou = useFollowerState(s => s.followers.has(username))

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container} centerChildren={true} gap="xtiny">
      <Kb.Box2 direction="horizontal" style={styles.fullNameContainer} gap="tiny">
        <Kb.Text3 center={true} type="BodyBig" lineClamp={inTracker ? 1 : undefined} selectable={true}>
          {fullname}
        </Kb.Text3>
      </Kb.Box2>
      <FollowText followThem={followThem} followsYou={followsYou} />
      {followersCount !== undefined && (
        <Kb.Text3 type="BodySmall">
          <Kb.Text3 type="BodySmall">
            <Kb.Text3 type="BodySmall" style={styles.bold}>
              {followersCount}
            </Kb.Text3>{' '}
            Followers{' '}
          </Kb.Text3>
          <Kb.Text3 type="BodySmall"> · </Kb.Text3>
          <Kb.Text3 type="BodySmall">
            {' '}
            Following{' '}
            <Kb.Text3 type="BodySmall" style={styles.bold}>
              {followingCount}{' '}
            </Kb.Text3>
          </Kb.Text3>
        </Kb.Text3>
      )}
      {!!bio && (
        <Kb.Text3
          type="Body"
          center={true}
          lineClamp={inTracker ? 2 : undefined}
          style={styles.text}
          selectable={true}
        >
          {bio}
        </Kb.Text3>
      )}
      {!!location && (
        <Kb.Text3
          type="BodySmall"
          center={true}
          lineClamp={inTracker ? 1 : undefined}
          style={styles.text}
          selectable={true}
        >
          {location}
        </Kb.Text3>
      )}
      {!!sbsDescription && (
        <Kb.Text3
          type="BodySmall"
          center={true}
          lineClamp={inTracker ? 1 : undefined}
          style={styles.text}
          selectable={true}
        >
          {sbsDescription}
        </Kb.Text3>
      )}
      {blocked ? (
        <Kb.Text3 type="BodySmallError" center={true} style={styles.blockedBackgroundText}>
          <Kb.Text3 type="BodySmallError" center={true} style={styles.text} selectable={true}>
            You blocked them.{' '}
          </Kb.Text3>
          <Kb.Text3 type="BodySmallError" center={true} style={styles.text} selectable={true}>
            {username} won’t be able to chat with you or add you to teams.
          </Kb.Text3>
        </Kb.Text3>
      ) : (
        hidFromFollowers && (
          <Kb.Text3 type="BodySmallError" center={true} style={styles.blockedBackgroundText}>
            <Kb.Text3 type="BodySmallError" center={true} style={styles.text} selectable={true}>
              You hid them from your followers.
            </Kb.Text3>
          </Kb.Text3>
        )
      )}
    </Kb.Box2>
  )
}

const FollowText = ({followThem, followsYou}: {followThem?: boolean; followsYou?: boolean}) => {
  let text: string = ''
  if (followThem) {
    if (followsYou) {
      text = 'YOU FOLLOW EACH OTHER'
    } else {
      text = 'YOU FOLLOW THEM'
    }
  } else if (followsYou) {
    text = 'FOLLOWS YOU'
  }
  return text ? <Kb.Text3 type="BodySmall">{text}</Kb.Text3> : null
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      blockedBackgroundText: {
        backgroundColor: Kb.Styles.globalColors.red_20,
        borderRadius: Kb.Styles.borderRadius,
        margin: Kb.Styles.globalMargins.small,
        paddingBottom: Kb.Styles.globalMargins.tiny,
        paddingLeft: Kb.Styles.globalMargins.small,
        paddingRight: Kb.Styles.globalMargins.small,
        paddingTop: Kb.Styles.globalMargins.tiny,
      },
      bold: {...Kb.Styles.globalStyles.fontBold},
      container: {backgroundColor: Kb.Styles.globalColors.white, flexShrink: 0},
      fullNameContainer: {
        paddingLeft: Kb.Styles.globalMargins.mediumLarge,
        paddingRight: Kb.Styles.globalMargins.mediumLarge,
      },
      text: Kb.Styles.platformStyles({
        common: {
          paddingLeft: Kb.Styles.globalMargins.mediumLarge,
          paddingRight: Kb.Styles.globalMargins.mediumLarge,
        },
        isElectron: {wordBreak: 'break-word'} as const,
      }),
    }) as const
)

export default Container
