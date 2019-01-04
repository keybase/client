// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {|
  bio: ?string,
  followThem: ?boolean,
  followersCount: ?number,
  followingCount: ?number,
  followsYou: ?boolean,
  fullname: ?string,
  inTracker: boolean,
  location: ?string,
|}

const Bio = (p: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container} centerChildren={true} gap="xtiny">
    <Kb.Text type="BodyBig" lineClamp={p.inTracker ? 1 : undefined} style={styles.text}>
      {p.fullname}
    </Kb.Text>
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
      <Kb.Text type="Body" lineClamp={p.inTracker ? 2 : undefined} style={styles.text}>
        {p.bio}
      </Kb.Text>
    )}
    {!!p.location && (
      <Kb.Text type="BodySmall" lineClamp={p.inTracker ? 1 : undefined} style={styles.text}>
        {p.location}
      </Kb.Text>
    )}
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  bold: {...Styles.globalStyles.fontBold},
  container: {backgroundColor: Styles.globalColors.white, flexShrink: 0},
  text: Styles.platformStyles({
    common: {
      paddingLeft: Styles.globalMargins.mediumLarge,
      paddingRight: Styles.globalMargins.mediumLarge,
      textAlign: 'center',
    },
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
})

export default Bio
