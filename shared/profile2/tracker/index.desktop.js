// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/profile2'
import * as Types from '../../constants/types/profile2'
import * as Styles from '../../styles'
import Assertion from '../assertion/container'
import Bio from '../bio/container'

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
  reason: string,
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

  const buttons = [
    <Kb.WaitingButton type="Secondary" key="Close" label="Close" waitingKey={Constants.waitingKey} />,
  ]

  // In order to keep the 'effect' of the card sliding up on top of the text the text is below the scroll area. We still need the spacing so we draw the text inside the scroll but invisible

  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      fullHeight={true}
      style={Styles.collapseStyles([styles.container, {backgroundColor}])}
    >
      <Kb.Text type="BodySmallSemibold" style={styles.reason}>
        {props.reason}
      </Kb.Text>
      <Kb.ScrollView style={styles.scrollView}>
        <Kb.Box2 direction="vertical">
          <Kb.Text type="BodySmallSemibold" style={styles.reasonInvisible}>
            {props.reason}
          </Kb.Text>
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.avatarContainer}>
            <Kb.Box2 direction="vertical" style={styles.avatarBackground} />
            <Kb.ConnectedNameWithIcon
              onClick="profile"
              username={props.username}
              colorFollowing={true}
              notFollowingColorOverride={Styles.globalColors.orange}
            />
          </Kb.Box2>
          <Bio username={props.username} />
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.assertions}>
            {assertions}
          </Kb.Box2>
          {buttons.length && <Kb.Box2 direction="vertical" style={styles.spaceUnderButtons} />}
        </Kb.Box2>
      </Kb.ScrollView>
      {buttons.length && (
        <Kb.Box2 direction="horizontal" style={styles.buttons}>
          {buttons}
        </Kb.Box2>
      )}
    </Kb.Box2>
  )
}

const avatarSize = 96
const barHeight = 62
const reason = {
  alignSelf: 'center',
  color: Styles.globalColors.white,
  paddingBottom: Styles.globalMargins.small,
  paddingLeft: Styles.globalMargins.medium,
  paddingRight: Styles.globalMargins.medium,
  paddingTop: Styles.globalMargins.small,
  textAlign: 'center',
}

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
  buttons: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white_90,
      bottom: 0,
      flexShrink: 0,
      height: barHeight,
      justifyContent: 'space-around',
      left: 0,
      position: 'absolute',
      right: 0,
    },
    isElectron: {boxShadow: 'rgba(0, 0, 0, 0.15) 0px 0px 3px'},
  }),
  container: {
    backgroundColor: Styles.globalColors.white,
    position: 'relative',
  },
  reason: {
    ...reason,
    ...Styles.globalStyles.fillAbsolute,
    bottom: undefined,
  },
  reasonInvisible: {
    ...reason,
    opacity: 0,
  },
  scrollView: {
    ...Styles.globalStyles.fillAbsolute,
  },
  spaceUnderButtons: {
    flexShrink: 0,
    height: barHeight,
  },
})

export default Tracker
