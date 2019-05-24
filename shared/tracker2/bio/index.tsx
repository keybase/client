import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import flags from '../../util/feature-flags'

type Props = {
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

const Bio = (p: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container} centerChildren={true} gap="xtiny">
    <Kb.Box2 direction="horizontal" style={styles.fullNameContainer} gap="tiny">
      <Kb.Text type="BodyBig" lineClamp={p.inTracker ? 1 : undefined} selectable={true}>
        {p.fullname}
      </Kb.Text>
      {flags.airdrop && p.registeredForAirdrop && (
        <Kb.WithTooltip text="Lucky airdropee">
          <Kb.Icon type="icon-airdrop-star-16" style={styles.star} />
        </Kb.WithTooltip>
      )}
    </Kb.Box2>
    {p.followThem && p.followsYou && <Kb.Text type="BodySmall">YOU FOLLOW EACH OTHER</Kb.Text>}
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
