// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/profile2'
import * as Styles from '../../styles'
import Assertion from '../assertion/container'

type Props = {|
  assertions: ?$ReadOnlyArray<string>,
  bio: ?string,
  followThem: ?boolean,
  followersCount: ?number,
  followingCount: ?number,
  followsYou: ?boolean,
  guiID: ?string,
  location: ?string,
  publishedTeams: ?$ReadOnlyArray<string>,
  state: Types.AssertionState,
  username: string,
|}

const Tracker = (props: Props) => {
  let assertions
  if (props.assertions) {
    assertions = props.assertions.map(a => <Assertion key={a} username={props.username} assertion={a} />)
  } else {
    // TODO could do a loading thing before we know about the list at all?
    assertions = null
  }

  let backgroundColor
  if (props.state === 'error') {
    backgroundColor = Styles.globalColors.red
  } else {
    backgroundColor = props.followThem ? Styles.globalColors.green : Styles.globalColors.blue
  }

  return (
    <Kb.Box2 direction="vertical" style={Styles.collapseStyles([styles.container, {backgroundColor}])}>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.avatarContainer}>
        <Kb.Box2 direction="vertical" style={styles.avatarBackground} />
        <Kb.ConnectedNameWithIcon
          onClick="profile"
          username={props.username}
          colorFollowing={true}
          notFollowingColorOverride={Styles.globalColors.orange}
        />
      </Kb.Box2>
      <Kb.Box2 direction="vertical" style={styles.assertions}>
        {assertions}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const avatarSize = 96

const styles = Styles.styleSheetCreate({
  assertions: {
    backgroundColor: Styles.globalColors.white,
    flexShrink: 0,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.small,
  },
  avatarBackground: {
    backgroundColor: Styles.globalColors.white,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: avatarSize / 2,
  },
  avatarContainer: {flexShrink: 0, position: 'relative'},
  container: Styles.platformStyles({
    isElectron: {overflowY: 'auto'},
  }),
})

export default Tracker
