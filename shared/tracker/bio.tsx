import * as Kb from '@/common-adapters'
type Props = {
  bio?: string
  blocked: boolean
  followThem: boolean
  followersCount?: number
  followingCount?: number
  followsYou: boolean
  fullname?: string
  hidFromFollowers: boolean
  inTracker: boolean
  location?: string
  sbsDescription?: string
  username: string
}

const Container = (props: Props) => {
  const {
    bio,
    blocked,
    followThem,
    followersCount,
    followingCount,
    followsYou,
    fullname,
    hidFromFollowers,
    inTracker,
    location,
    sbsDescription,
    username,
  } = props
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container} centerChildren={true} gap="xtiny">
      <Kb.Box2 direction="horizontal" style={styles.fullNameContainer} gap="tiny">
        <Kb.Text center={true} type="BodyBig" lineClamp={inTracker ? 1 : undefined} selectable={true}>
          {fullname}
        </Kb.Text>
      </Kb.Box2>
      <FollowText followThem={followThem} followsYou={followsYou} />
      {followersCount !== undefined && (
        <Kb.Text type="BodySmall">
          <Kb.Text type="BodySmall">
            <Kb.Text type="BodySmall" style={styles.bold}>
              {followersCount}
            </Kb.Text>{' '}
            Followers{' '}
          </Kb.Text>
          <Kb.Text type="BodySmall"> · </Kb.Text>
          <Kb.Text type="BodySmall">
            {' '}
            Following{' '}
            <Kb.Text type="BodySmall" style={styles.bold}>
              {followingCount}{' '}
            </Kb.Text>
          </Kb.Text>
        </Kb.Text>
      )}
      {!!bio && (
        <Kb.Text
          type="Body"
          center={true}
          lineClamp={inTracker ? 2 : undefined}
          style={styles.text}
          selectable={true}
        >
          {bio}
        </Kb.Text>
      )}
      {!!location && (
        <Kb.Text
          type="BodySmall"
          center={true}
          lineClamp={inTracker ? 1 : undefined}
          style={styles.text}
          selectable={true}
        >
          {location}
        </Kb.Text>
      )}
      {!!sbsDescription && (
        <Kb.Text
          type="BodySmall"
          center={true}
          lineClamp={inTracker ? 1 : undefined}
          style={styles.text}
          selectable={true}
        >
          {sbsDescription}
        </Kb.Text>
      )}
      {blocked ? (
        <Kb.Text type="BodySmallError" center={true} style={styles.blockedBackgroundText}>
          <Kb.Text type="BodySmallError" center={true} style={styles.text} selectable={true}>
            You blocked them.{' '}
          </Kb.Text>
          <Kb.Text type="BodySmallError" center={true} style={styles.text} selectable={true}>
            {username} won’t be able to chat with you or add you to teams.
          </Kb.Text>
        </Kb.Text>
      ) : (
        hidFromFollowers && (
          <Kb.Text type="BodySmallError" center={true} style={styles.blockedBackgroundText}>
            <Kb.Text type="BodySmallError" center={true} style={styles.text} selectable={true}>
              You hid them from your followers.
            </Kb.Text>
          </Kb.Text>
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
  return text ? <Kb.Text type="BodySmall">{text}</Kb.Text> : null
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
