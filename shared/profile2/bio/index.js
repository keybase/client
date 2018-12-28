// @flow
import * as React from 'react'
// import * as Types from '../../constants/types/profile2'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
// import * as Flow from '../../util/flow'

type Props = {|
  bio: ?string,
  followThem: ?boolean,
  followersCount: ?number,
  followingCount: ?number,
  followsYou: ?boolean,
  fullname: ?string,
  location: ?string,
|}

const Bio = (p: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container} centerChildren={true} gap="xtiny">
    <Kb.Text type="BodyBig" lineClamp={1} style={styles.text}>
      {p.fullname}
    </Kb.Text>
    {p.followersCount !== null && (
      <Kb.Text type="BodySmall">
        <Kb.Text type="BodySmall">{p.followersCount} Followers </Kb.Text>
        <Kb.Text type="BodySmall"> · </Kb.Text>
        <Kb.Text type="BodySmall">Following {p.followersCount} </Kb.Text>
      </Kb.Text>
    )}
    {!!p.bio && (
      <Kb.Text type="Body" lineClamp={2} style={styles.text}>
        {p.bio}
      </Kb.Text>
    )}
    {!!p.location && (
      <Kb.Text type="BodySmall" lineClamp={1} style={styles.text}>
        {p.location}
      </Kb.Text>
    )}
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
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
