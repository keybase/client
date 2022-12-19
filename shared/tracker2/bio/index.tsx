import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

export type Props = {
  bio?: string
  blocked: boolean
  followThem?: boolean
  followersCount?: number
  followingCount?: number
  followsYou?: boolean
  fullname?: string
  hidFromFollowers: boolean
  inTracker: boolean
  location?: string
  onBack?: () => void
  username: string
  sbsDescription?: string
}

const FollowText = ({followThem, followsYou}) => {
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

const Bio = (p: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container} centerChildren={true} gap="xtiny">
    <Kb.Box2 direction="horizontal" style={styles.fullNameContainer} gap="tiny">
      <Kb.Text center={true} type="BodyBig" lineClamp={p.inTracker ? 1 : undefined} selectable={true}>
        {p.fullname}
      </Kb.Text>
    </Kb.Box2>
    <FollowText followThem={p.followThem} followsYou={p.followsYou} />
    {p.followersCount !== null && (
      <Kb.Text type="BodySmall">
        <Kb.Text type="BodySmall">
          <Kb.Text type="BodySmall" style={styles.bold}>
            {p.followersCount}
          </Kb.Text>{' '}
          Followers{' '}
        </Kb.Text>
        <Kb.Text type="BodySmall"> · </Kb.Text>
        <Kb.Text type="BodySmall">
          {' '}
          Following{' '}
          <Kb.Text type="BodySmall" style={styles.bold}>
            {p.followingCount}{' '}
          </Kb.Text>
        </Kb.Text>
      </Kb.Text>
    )}
    {!!p.bio && (
      <Kb.Text
        type="Body"
        center={true}
        lineClamp={p.inTracker ? 2 : undefined}
        style={styles.text}
        selectable={true}
      >
        {p.bio}
      </Kb.Text>
    )}
    {!!p.location && (
      <Kb.Text
        type="BodySmall"
        center={true}
        lineClamp={p.inTracker ? 1 : undefined}
        style={styles.text}
        selectable={true}
      >
        {p.location}
      </Kb.Text>
    )}
    {!!p.sbsDescription && (
      <Kb.Text
        type="BodySmall"
        center={true}
        lineClamp={p.inTracker ? 1 : undefined}
        style={styles.text}
        selectable={true}
      >
        {p.sbsDescription}
      </Kb.Text>
    )}
    {p.blocked ? (
      <Kb.Text type="BodySmallError" center={true} style={styles.blockedBackgroundText}>
        <Kb.Text type="BodySmallError" center={true} style={styles.text} selectable={true}>
          You blocked them.{' '}
        </Kb.Text>
        <Kb.Text type="BodySmallError" center={true} style={styles.text} selectable={true}>
          {p.username} won’t be able to chat with you or add you to teams.
        </Kb.Text>
      </Kb.Text>
    ) : (
      p.hidFromFollowers && (
        <Kb.Text type="BodySmallError" center={true} style={styles.blockedBackgroundText}>
          <Kb.Text type="BodySmallError" center={true} style={styles.text} selectable={true}>
            You hid them from your followers.
          </Kb.Text>
        </Kb.Text>
      )
    )}
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      blockedBackgroundText: {
        backgroundColor: Styles.globalColors.red_20,
        borderRadius: Styles.borderRadius,
        margin: Styles.globalMargins.small,
        paddingBottom: Styles.globalMargins.tiny,
        paddingLeft: Styles.globalMargins.small,
        paddingRight: Styles.globalMargins.small,
        paddingTop: Styles.globalMargins.tiny,
      },
      bold: {...Styles.globalStyles.fontBold},
      container: {backgroundColor: Styles.globalColors.white, flexShrink: 0},
      floatingContainer: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.purple,
        },
        isElectron: {
          maxWidth: 200,
        },
      }),
      fullName: Styles.platformStyles({
        isElectron: {wordBreak: 'break-all'} as const,
      }),
      fullNameContainer: {
        paddingLeft: Styles.globalMargins.mediumLarge,
        paddingRight: Styles.globalMargins.mediumLarge,
      },
      learnButton: {alignSelf: 'center', marginTop: Styles.globalMargins.tiny},
      star: {alignSelf: 'center', marginBottom: Styles.globalMargins.tiny},
      text: Styles.platformStyles({
        common: {
          paddingLeft: Styles.globalMargins.mediumLarge,
          paddingRight: Styles.globalMargins.mediumLarge,
        },
        isElectron: {
          wordBreak: 'break-word',
        } as const,
      }),
    } as const)
)

export default Bio
