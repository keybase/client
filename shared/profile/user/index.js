// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/tracker2'
import * as Constants from '../../constants/tracker2'
import * as Styles from '../../styles'
import Bio from '../../tracker2/bio/container'
import Assertion from '../../tracker2/assertion/container'
import Actions from './actions'

export type Props = {|
  assertionKeys: ?$ReadOnlyArray<string>,
  bio: ?string,
  followThem: ?boolean,
  followersCount: ?number,
  followingCount: ?number,
  followsYou: ?boolean,
  guiID: ?string,
  location: ?string,
  onFollow: () => void,
  onUnfollow: () => void,
  onBack: () => void,
  onChat: () => void,
  onClose: () => void,
  onReload: () => void,
  onIgnoreFor24Hours: () => void,
  onAccept: () => void,
  reason: string,
  state: Types.DetailsState,
  teamShowcase: ?$ReadOnlyArray<Types._TeamShowcase>,
  username: string,
|}

const Header = ({onBack, state, followThem}) => (
  <Kb.Box2
    direction="horizontal"
    fullWidth={true}
    style={Styles.collapseStyles([
      styles.header,
      {backgroundColor: headerBackgroundColor(state, followThem)},
    ])}
  >
    <Kb.BackButton iconColor={Styles.globalColors.white} textStyle={styles.backButton} onClick={onBack} />
    <Kb.Text type="Body">TODO search</Kb.Text>
  </Kb.Box2>
)

const BioLayout = p => (
  <Kb.Box2 direction="vertical" style={styles.bio}>
    <Kb.ConnectedNameWithIcon
      username={p.username}
      colorFollowing={true}
      notFollowingColorOverride={Styles.globalColors.orange}
      avatarSize={avatarSize}
    />
    <Kb.Box2 direction="vertical" fullWidth={true} gap="small">
      <Bio inTracker={false} username={p.username} />
      <Actions {...p} />
    </Kb.Box2>
  </Kb.Box2>
)

const TeamShowcase = ({name}) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" style={styles.teamShowcase}>
    <Kb.Avatar size={32} teamname={name} isTeam={true} />
    <Kb.Text type="BodySemibold">{name}</Kb.Text>
  </Kb.Box2>
)

const Teams = p =>
  p.teamShowcase && p.teamShowcase.length > 0 ? (
    <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true} style={styles.teamShowcases}>
      <Kb.Text type="BodySmallSemibold">Teams</Kb.Text>
      {p.teamShowcase.map(t => (
        <TeamShowcase key={t.name} name={t.name} />
      ))}
    </Kb.Box2>
  ) : null

const Proofs = p => {
  let assertions
  if (p.assertionKeys) {
    // $ForceType readOnlyArray doens't like sort()
    assertions = p.assertionKeys
      .sort(Constants.sortAssertionKeys)
      .map(a => <Assertion key={a} username={p.username} assertionKey={a} />)
  } else {
    assertions = null
  }

  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      {assertions}
    </Kb.Box2>
  )
}

const headerBackgroundColor = (state, followThem) => {
  if (['broken', 'error'].includes(state)) {
    return Styles.globalColors.red
  } else {
    return followThem ? Styles.globalColors.green : Styles.globalColors.blue
  }
}

const DesktopLayout = (p: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
    <Header onBack={p.onBack} state={p.state} followThem={p.followThem} />
    <Kb.ScrollView>
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.bioAndProofs}>
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          style={Styles.collapseStyles([
            styles.backgroundColor,
            {backgroundColor: headerBackgroundColor(p.state, p.followThem)},
          ])}
        />
        <BioLayout {...p} />
        <Kb.Box2 direction="vertical" style={styles.proofs}>
          <Teams {...p} />
          <Proofs {...p} />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.ScrollView>
  </Kb.Box2>
)

const MobileLayout = (p: Props) => <Kb.SectionList />

class User extends React.PureComponent<Props> {
  componentDidMount() {
    this.props.onReload()
  }
  render() {
    return Styles.isMobile ? <MobileLayout {...this.props} /> : <DesktopLayout {...this.props} />
  }
}

const avatarSize = 128
const headerHeight = 48

const styles = Styles.styleSheetCreate({
  backButton: {
    color: Styles.globalColors.white,
  },
  backgroundColor: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.fillAbsolute,
      bottom: undefined,
      height: avatarSize / 2,
    },
    isMobile: {}, // TODO
  }),
  bio: Styles.platformStyles({
    common: {alignSelf: 'flex-start'},
    isElectron: {maxWidth: 350},
    isMobile: {width: '100%'},
  }),
  bioAndProofs: {
    justifyContent: 'space-around',
    position: 'relative',
  },
  container: {},
  header: {
    alignItems: 'center',
    flexShrink: 0,
    height: headerHeight,
    padding: Styles.globalMargins.small,
  },
  proofs: Styles.platformStyles({
    isElectron: {
      flexShrink: 0,
      marginTop: avatarSize / 2,
      maxWidth: 350,
      paddingTop: Styles.globalMargins.small,
    },
    isMobile: {width: '100%'},
  }),
  teamShowcase: {alignItems: 'center'},
  teamShowcases: {
    flexShrink: 0,
    paddingBottom: Styles.globalMargins.small,
  },
})

export default User
