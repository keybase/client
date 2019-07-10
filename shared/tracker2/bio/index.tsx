import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import flags from '../../util/feature-flags'

type Props = {
  airdropIsLive: boolean | null
  bio: string | null
  followThem: boolean | null
  followersCount: number | null
  followingCount: number | null
  followsYou: boolean | null
  fullname: string | null
  inTracker: boolean
  location: string | null
  registeredForAirdrop: boolean | null
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
      <Kb.Text type="BodyBig" lineClamp={p.inTracker ? 1 : undefined} selectable={true}>
        {p.fullname}
      </Kb.Text>
      {flags.airdrop && p.airdropIsLive && p.registeredForAirdrop && (
        <Kb.WithTooltip text="Lucky airdropee">
          <Kb.Icon type="icon-airdrop-star-16" style={styles.star} />
        </Kb.WithTooltip>
      )}
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
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  bold: {...Styles.globalStyles.fontBold},
  container: {backgroundColor: Styles.globalColors.white, flexShrink: 0},
  fullName: Styles.platformStyles({
    isElectron: {wordBreak: 'break-any'},
  }),
  fullNameContainer: {
    paddingLeft: Styles.globalMargins.mediumLarge,
    paddingRight: Styles.globalMargins.mediumLarge,
  },
  star: {alignSelf: 'center'},
  text: Styles.platformStyles({
    common: {
      paddingLeft: Styles.globalMargins.mediumLarge,
      paddingRight: Styles.globalMargins.mediumLarge,
    },
    isElectron: {
      wordBreak: 'break-word',
    },
    isMobile: {
      lineHeight: 21,
    },
  }),
})

export default Bio
