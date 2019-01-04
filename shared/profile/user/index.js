// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/tracker2'
// import * as Constants from '../../constants/tracker2'
import * as Styles from '../../styles'
import Bio from '../../tracker2/bio/container'
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

const Header = ({onBack}) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.header}>
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

const headerBackgroundColor = (state, followThem) => {
  if (['broken', 'error'].includes(state)) {
    return Styles.globalColors.red
  } else {
    return followThem ? Styles.globalColors.green : Styles.globalColors.blue
  }
}

const DesktopLayout = (p: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      style={Styles.collapseStyles([
        styles.backgroundColor,
        {backgroundColor: headerBackgroundColor(p.state, p.followThem)},
      ])}
    />
    <Header onBack={p.onBack} />
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.bioAndProofs}>
      <BioLayout {...p} />
    </Kb.Box2>
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
  backgroundColor: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.fillAbsolute,
      bottom: undefined,
      height: avatarSize / 2 + headerHeight,
    },
    isMobile: {}, // TODO
  }),
  backButton: {
    color: Styles.globalColors.white,
  },
  bio: Styles.platformStyles({
    isElectron: {maxWidth: 350},
    isMobile: {width: '100%'},
  }),
  bioAndProofs: {
    justifyContent: 'space-around',
  },
  container: {
    position: 'relative',
  },
  header: {
    alignItems: 'center',
    height: headerHeight,
    padding: Styles.globalMargins.small,
  },
})

export default User
