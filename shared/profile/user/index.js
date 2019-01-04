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
  backgroundColor: string,
  onFollow: () => void,
  onUnfollow: () => void,
  onBack: () => void,
  onChat: () => void,
  onClose: () => void,
  onReload: () => void,
  onIgnoreFor24Hours: () => void,
  onAccept: () => void,
  state: Types.DetailsState,
  teamShowcase: ?$ReadOnlyArray<Types._TeamShowcase>,
  username: string,
|}

const Header = ({onBack, state, backgroundColor}) => (
  <Kb.Box2
    direction="horizontal"
    fullWidth={true}
    style={Styles.collapseStyles([styles.header, {backgroundColor}])}
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

class FriendshipTabs extends React.Component<Props> {
  _tab = following => (
    <Kb.ClickableBox
      style={Styles.collapseStyles([
        styles.followTab,
        following === this.props.selectedFollowing && styles.followTabSelected,
      ])}
    >
      <Kb.Text
        type="BodySmallSemibold"
        onClick={() => this.props.onChangeFollowing(following)}
        style={
          following === this.props.selectedFollowing ? styles.followTabTextSelected : styles.followTabText
        }
      >
        {following ? 'Following' : 'Followers'} (TODO)
      </Kb.Text>
    </Kb.ClickableBox>
  )

  render() {
    return (
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.followTabContainer}>
        {this._tab(false)}
        {this._tab(true)}
      </Kb.Box2>
    )
  }
}

type LayoutProps = {...Props, onChangeFollowing: boolean => void, selectedFollowing: boolean}

const DesktopLayout = (p: LayoutProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
    <Header onBack={p.onBack} state={p.state} backgroundColor={p.backgroundColor} />
    <Kb.ScrollView>
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.bioAndProofs}>
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          style={Styles.collapseStyles([styles.backgroundColor, {backgroundColor: p.backgroundColor}])}
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

class MobileLayout extends React.Component<LayoutProps> {
  _renderSectionHeader = ({section}) => {
    if (section === this._bioTeamProofsSection) {
      return (
        <Header
          onBack={this.props.onBack}
          state={this.props.state}
          backgroundColor={this.props.backgroundColor}
        />
      )
    }
    return <FriendshipTabs {...this.props} />
  }

  _renderBioTeamProofs = () => (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.bioAndProofs}>
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={Styles.collapseStyles([styles.backgroundColor, {backgroundColor: this.props.backgroundColor}])}
      />
      <BioLayout {...this.props} />
    </Kb.Box2>
  )

  _renderOtherUsers = ({item}) => {
    return <Kb.Text type="Body">{item}</Kb.Text>
  }

  _bioTeamProofsSection = {data: ['bioTeamProofs'], renderItem: this._renderBioTeamProofs}

  render() {
    const following = ['inga', 'ingb', 'ingc', 'ingd', 'inge']
    const followers = ['a', 'b', 'c', 'd', 'e']
    return (
      <Kb.Box2 directio="vertical" fullWidth={true} fullHeight={true}>
        <Kb.SafeAreaViewTop style={{backgroundColor: this.props.backgroundColor, flexGrow: 0}} />
        <Kb.SectionList
          stickySectionHeadersEnabled={true}
          renderSectionHeader={this._renderSectionHeader}
          sections={[
            this._bioTeamProofsSection,
            {data: this.props.selectedFollowing ? following : followers, renderItem: this._renderOtherUsers},
          ]}
          style={{backgroundColor: this.props.backgroundColor}}
          contentContainerStyle={styles.sectionListContentStyle}
        />
      </Kb.Box2>
    )
  }
}

// don't bother to keep this in the store
const usernameSelectedFollowing = {}

type State = {|
  selectedFollowing: boolean,
|}

class User extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {selectedFollowing: !!usernameSelectedFollowing[props.username]}
  }

  _changeFollowing = following => {
    this.setState(p => {
      if (p.selectedFollowing === following) return
      const selectedFollowing = !p.selectedFollowing
      usernameSelectedFollowing[this.props.username] = selectedFollowing
      return {selectedFollowing}
    })
  }

  componentDidMount() {
    this.props.onReload()
  }
  render() {
    return Styles.isMobile ? (
      <MobileLayout
        {...this.props}
        onChangeFollowing={this._changeFollowing}
        selectedFollowing={this.state.selectedFollowing}
      />
    ) : (
      <DesktopLayout
        {...this.props}
        onChangeFollowing={this._changeFollowing}
        selectedFollowing={this.state.selectedFollowing}
      />
    )
  }
}

const avatarSize = 128
const headerHeight = 48

const styles = Styles.styleSheetCreate({
  backButton: {color: Styles.globalColors.white},
  backgroundColor: {
    ...Styles.globalStyles.fillAbsolute,
    bottom: undefined,
    height: avatarSize / 2,
  },
  bio: Styles.platformStyles({
    common: {alignSelf: 'flex-start'},
    isElectron: {maxWidth: 350},
    isMobile: {width: '100%'},
  }),
  bioAndProofs: Styles.platformStyles({
    common: {
      justifyContent: 'space-around',
      position: 'relative',
    },
    isMobile: {paddingBottom: Styles.globalMargins.small},
  }),
  followTab: {
    alignItems: 'center',
    borderBottomColor: 'white',
    borderBottomWidth: 2,
    height: Styles.globalMargins.large,
    justifyContent: 'center',
    width: '50%',
  },
  followTabContainer: {
    alignItems: 'flex-end',
    borderBottomColor: Styles.globalColors.black_10,
    borderBottomWidth: 1,
  },
  followTabSelected: {
    borderBottomColor: Styles.globalColors.blue,
  },
  followTabText: {color: Styles.globalColors.black_60},
  followTabTextSelected: {color: Styles.globalColors.black_75},
  header: Styles.platformStyles({
    common: {
      alignItems: 'center',
      flexShrink: 0,
    },
    isElectron: {
      height: headerHeight,
      padding: Styles.globalMargins.small,
    },
    isMobile: {},
  }),
  proofs: Styles.platformStyles({
    isElectron: {
      flexShrink: 0,
      marginTop: avatarSize / 2,
      maxWidth: 350,
      paddingTop: Styles.globalMargins.small,
    },
    isMobile: {width: '100%'},
  }),
  sectionListContentStyle: {backgroundColor: Styles.globalColors.white, minHeight: '100%'},
  teamShowcase: {alignItems: 'center'},
  teamShowcases: {
    flexShrink: 0,
    paddingBottom: Styles.globalMargins.small,
  },
})

export default User
