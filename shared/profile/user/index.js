// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/tracker2'
import * as Constants from '../../constants/tracker2'
import * as Styles from '../../styles'
import {chunk} from 'lodash-es'
import Bio from '../../tracker2/bio/container'
import Assertion from '../../tracker2/assertion/container'
import Actions from './actions'
import Friend from './friend/container'
import Measure from './measure'

export type Props = {|
  assertionKeys: ?$ReadOnlyArray<string>,
  followThem: boolean,
  followers: $ReadOnlyArray<string>,
  following: $ReadOnlyArray<string>,
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

type LayoutProps = {...Props, onChangeFollowing: boolean => void, selectedFollowing: boolean}

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
      <Actions
        followThem={p.followThem}
        onFollow={p.onFollow}
        onUnfollow={p.onUnfollow}
        onBack={p.onBack}
        onChat={p.onChat}
        onClose={p.onClose}
        onReload={p.onReload}
        onIgnoreFor24Hours={p.onIgnoreFor24Hours}
        onAccept={p.onAccept}
        state={p.state}
      />
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

class FriendshipTabs extends React.Component<LayoutProps> {
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
        {following
          ? `Following (${this.props.following.length})`
          : `Followers (${this.props.followers.length})`}
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

class FriendRow extends React.PureComponent<{|usernames: Array<string>, itemWidth: number|}> {
  render() {
    return (
      <Kb.Box2 direction="horizontal" fullWidth={true} gap="xxtiny" style={styles.friendRow}>
        {this.props.usernames.map(u => (
          <Friend key={u} username={u} width={this.props.itemWidth} />
        ))}
      </Kb.Box2>
    )
  }
}

class MobileLayout extends React.Component<LayoutProps, {|width: number|}> {
  state = {width: 0}

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

  _renderOtherUsers = ({item, section, index}) => (
    <FriendRow key={index} usernames={item} itemWidth={section.itemWidth} />
  )

  _bioTeamProofsSection = {data: ['bioTeamProofs'], renderItem: this._renderBioTeamProofs}

  _widthToDimentions = width => {
    const itemsInARow = Math.floor(Math.max(1, width / 105))
    const itemWidth = Math.floor(width / itemsInARow)
    return {itemWidth, itemsInARow}
  }

  _onMeasured = width => this.setState(p => (p.width !== width ? {width} : null))
  _keyExtractor = (item, index) => index

  render() {
    const friends = this.props.selectedFollowing ? this.props.following : this.props.followers
    const {itemsInARow, itemWidth} = this._widthToDimentions(this.state.width)
    // $ForceType
    const chunks = this.state.width ? chunk(friends, itemsInARow) : []

    return (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <Measure onMeasured={this._onMeasured} />
        <Kb.SafeAreaViewTop style={{backgroundColor: this.props.backgroundColor, flexGrow: 0}} />
        {!!this.state.width && (
          <Kb.SectionList
            stickySectionHeadersEnabled={true}
            renderSectionHeader={this._renderSectionHeader}
            keyExtractor={this._keyExtractor}
            sections={[
              this._bioTeamProofsSection,
              {
                data: chunks,
                itemWidth,
                renderItem: this._renderOtherUsers,
              },
            ]}
            style={{backgroundColor: this.props.backgroundColor}}
            contentContainerStyle={styles.sectionListContentStyle}
          />
        )}
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
      if (p.selectedFollowing === following) {
        return
      }
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
    backgroundColor: Styles.globalColors.white,
    borderBottomColor: Styles.globalColors.black_10,
    borderBottomWidth: 1,
  },
  followTabSelected: {
    borderBottomColor: Styles.globalColors.blue,
  },
  followTabText: {color: Styles.globalColors.black_60},
  followTabTextSelected: {color: Styles.globalColors.black_75},
  friendRow: {
    justifyContent: 'center',
    marginBottom: Styles.globalMargins.xtiny,
    marginTop: Styles.globalMargins.xtiny,
  },
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
