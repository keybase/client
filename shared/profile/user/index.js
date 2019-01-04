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
  <Kb.Box2 direction="horizontal" fullWidth={true}>
    <Kb.BackButton onClick={onBack} />
    <Kb.Text type="Body">TODO search</Kb.Text>
  </Kb.Box2>
)

const BioLayout = p => (
  <Kb.Box2 direction="vertical" style={styles.bio}>
    <Kb.ConnectedNameWithIcon
      username={p.username}
      colorFollowing={true}
      notFollowingColorOverride={Styles.globalColors.orange}
    />
    <Kb.Box2 direction="vertical" fullWidth={true} gap="small">
      <Bio inTracker={false} username={p.username} />
      <Actions {...p} />
    </Kb.Box2>
  </Kb.Box2>
)

const DesktopLayout = (p: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
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

const styles = Styles.styleSheetCreate({
  bio: Styles.platformStyles({
    isMobile: {width: '100%'},
    isElectron: {maxWidth: 350},
  }),
  bioAndProofs: {
    justifyContent: 'space-around',
  },
})

export default User
