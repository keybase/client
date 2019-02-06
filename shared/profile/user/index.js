// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/tracker2'
import * as Constants from '../../constants/tracker2'
import * as Styles from '../../styles'
import {chunk} from 'lodash-es'
import Bio from '../../tracker2/bio/container'
import Assertion from '../../tracker2/assertion/container'
import Actions from './actions/container'
import Friend from './friend/container'
import Measure from './measure'
import Teams from './teams/container'
import Folders from '../folders/container'

export type Props = {|
  assertionKeys: ?Array<string>,
  backgroundColor: string,
  followThem: boolean,
  followers: Array<string>,
  following: Array<string>,
  onBack: () => void,
  onReload: () => void,
  onSearch: () => void,
  onEditAvatar: ?() => void,
  state: Types.DetailsState,
  suggestionKeys: ?Array<string>,
  username: string,
|}

const Header = p => (
  <Kb.Box2
    direction="horizontal"
    fullWidth={true}
    style={Styles.collapseStyles([styles.header, {backgroundColor: p.backgroundColor}])}
  >
    <Kb.BackButton iconColor={Styles.globalColors.white} textStyle={styles.backButton} onClick={p.onBack} />
    <Kb.ClickableBox onClick={p.onSearch} style={styles.searchContainer}>
      <Kb.Box2
        direction="horizontal"
        centerChildren={true}
        className="hover-opacity"
        gap="tiny"
        style={styles.search}
      >
        <Kb.Icon type="iconfont-search" color={Styles.globalColors.white} />
        <Kb.Text type="BodySmallSemibold" style={styles.searchLabel}>
          Search people
        </Kb.Text>
      </Kb.Box2>
    </Kb.ClickableBox>
    <Kb.BackButton
      iconColor={Styles.globalColors.white}
      textStyle={styles.backButton}
      onClick={() => {}}
      style={styles.invisible}
    />
  </Kb.Box2>
)

const BioLayout = p => (
  <Kb.Box2 direction="vertical" style={styles.bio}>
    <Kb.ConnectedNameWithIcon
      username={p.username}
      colorFollowing={true}
      notFollowingColorOverride={Styles.globalColors.orange}
      editableIcon={!!p.onEditAvatar}
      onEditIcon={p.onEditAvatar}
      avatarSize={avatarSize}
    />
    <Kb.Box2 direction="vertical" fullWidth={true} gap="small">
      <Bio inTracker={false} username={p.username} />
      <Actions username={p.username} />
    </Kb.Box2>
  </Kb.Box2>
)

const Proofs = p => {
  let assertions
  if (p.assertionKeys) {
    const unsorted = [...p.assertionKeys]
    assertions = [
      ...unsorted
        .sort(Constants.sortAssertionKeys)
        .map(a => <Assertion key={a} username={p.username} assertionKey={a} />),
      ...(p.suggestionKeys || []).map(s => (
        <Assertion isSuggestion={true} key={s} username={p.username} assertionKey={s} />
      )),
    ]
  } else {
    assertions = null
  }

  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      {assertions}
    </Kb.Box2>
  )
}

class FriendshipTabs extends React.Component<
  Props & {onChangeFollowing: boolean => void, selectedFollowing: boolean}
> {
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
          ? `FOLLOWING (${this.props.following.length})`
          : `FOLLOWERS (${this.props.followers.length})`}
      </Kb.Text>
    </Kb.ClickableBox>
  )

  render() {
    return (
      <Kb.Box2 direction="horizontal" style={styles.followTabContainer}>
        {this._tab(false)}
        {this._tab(true)}
      </Kb.Box2>
    )
  }
}

const widthToDimentions = width => {
  const singleItemWidth = Styles.isMobile ? 130 : 120
  const itemsInARow = Math.floor(Math.max(1, width / singleItemWidth))
  const itemWidth = Math.floor(width / itemsInARow)
  return {itemWidth, itemsInARow}
}

class FriendRow extends React.PureComponent<{|usernames: Array<string>, itemWidth: number|}> {
  render() {
    return (
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.friendRow}>
        {this.props.usernames.map(u => (
          <Friend key={u} username={u} width={this.props.itemWidth} />
        ))}
      </Kb.Box2>
    )
  }
}

class BioTeamProofs extends React.PureComponent<Props> {
  render() {
    return Styles.isMobile ? (
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.bioAndProofs}>
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          style={Styles.collapseStyles([
            styles.backgroundColor,
            {backgroundColor: this.props.backgroundColor},
          ])}
        />
        <BioLayout {...this.props} />
        <Teams username={this.props.username} />
        <Proofs {...this.props} />
        <Folders profileUsername={this.props.username} />
      </Kb.Box2>
    ) : (
      <Kb.Box2 key="bioTeam" direction="horizontal" fullWidth={true} style={styles.bioAndProofs}>
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          style={Styles.collapseStyles([
            styles.backgroundColor,
            {backgroundColor: this.props.backgroundColor},
          ])}
        />
        <BioLayout {...this.props} />
        <Kb.Box2 direction="vertical" style={styles.proofs}>
          <Teams username={this.props.username} />
          <Proofs {...this.props} />
          <Folders profileUsername={this.props.username} />
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

type State = {|
  selectedFollowing: boolean,
  width: number,
|}
class User extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {selectedFollowing: !!usernameSelectedFollowing[props.username], width: 0}
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

  _renderSectionHeader = ({section}) => {
    if (section === this._bioTeamProofsSection) {
      return (
        <Header
          key="header"
          onBack={this.props.onBack}
          state={this.props.state}
          backgroundColor={this.props.backgroundColor}
          onSearch={this.props.onSearch}
        />
      )
    }
    return (
      <FriendshipTabs
        key="tabs"
        {...this.props}
        onChangeFollowing={this._changeFollowing}
        selectedFollowing={this.state.selectedFollowing}
      />
    )
  }

  _renderOtherUsers = ({item, section, index}) => (
    <FriendRow key={'friend' + index} usernames={item} itemWidth={section.itemWidth} />
  )

  _bioTeamProofsSection = {data: ['bioTeamProofs'], renderItem: () => <BioTeamProofs {...this.props} />}

  _onMeasured = width => this.setState(p => (p.width !== width ? {width} : null))
  _keyExtractor = (item, index) => index

  componentDidMount() {
    this.props.onReload()
  }
  componentDidUpdate(prevProps: Props) {
    if (this.props.username !== prevProps.username) {
      this.props.onReload()
    }
  }

  render() {
    const friends = this.state.selectedFollowing ? this.props.following : this.props.followers
    const {itemsInARow, itemWidth} = widthToDimentions(this.state.width)
    // TODO memoize?
    const chunks = this.state.width ? chunk(friends, itemsInARow) : []

    return (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
        <Kb.Box2 direction="vertical" style={styles.innerContainer}>
          <Measure onMeasured={this._onMeasured} />
          <Kb.SafeAreaViewTop style={{backgroundColor: this.props.backgroundColor, flexGrow: 0}} />
          {!!this.state.width && (
            <Kb.SectionList
              key={this.props.username + this.state.width /* forc render on user change or width change */}
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
              style={Styles.collapseStyles([
                styles.sectionList,
                {
                  backgroundColor: Styles.isMobile ? this.props.backgroundColor : Styles.globalColors.white,
                },
              ])}
              contentContainerStyle={styles.sectionListContentStyle}
            />
          )}
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

// don't bother to keep this in the store
const usernameSelectedFollowing = {}

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
    isElectron: {marginBottom: Styles.globalMargins.small, width: 350},
    isMobile: {width: '100%'},
  }),
  bioAndProofs: Styles.platformStyles({
    common: {
      justifyContent: 'space-around',
      position: 'relative',
    },
    isMobile: {paddingBottom: Styles.globalMargins.small},
  }),
  container: {
    position: 'relative',
  },
  followTab: Styles.platformStyles({
    common: {
      alignItems: 'center',
      borderBottomColor: 'white',
      borderBottomWidth: 2,
      justifyContent: 'center',
    },
    isElectron: {
      borderBottomStyle: 'solid',
      paddingBottom: Styles.globalMargins.tiny,
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
      paddingTop: Styles.globalMargins.medium,
    },
    isMobile: {
      height: Styles.globalMargins.large,
      width: '50%',
    },
  }),
  followTabContainer: Styles.platformStyles({
    common: {
      alignItems: 'flex-end',
      backgroundColor: Styles.globalColors.white,
      borderBottomColor: Styles.globalColors.black_10,
      borderBottomWidth: 1,
    },
    isElectron: {
      alignSelf: 'stretch',
      borderBottomStyle: 'solid',
    },
    isMobile: {
      width: '100%',
    },
  }),
  followTabSelected: {
    borderBottomColor: Styles.globalColors.blue,
  },
  followTabText: {color: Styles.globalColors.black_60},
  followTabTextSelected: {color: Styles.globalColors.black_75},
  friendRow: Styles.platformStyles({
    common: {
      marginTop: Styles.globalMargins.tiny,
      maxWidth: '100%',
      minWidth: 0,
    },
    isElectron: {justifyContent: 'flex-start'},
    isMobile: {justifyContent: 'center'},
  }),
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
  innerContainer: {...Styles.globalStyles.fillAbsolute},
  invisible: {opacity: 0},
  proofs: Styles.platformStyles({
    isElectron: {
      alignSelf: 'flex-start',
      flexShrink: 0,
      marginTop: avatarSize / 2,
      paddingTop: Styles.globalMargins.small,
      width: 350,
    },
    isMobile: {width: '100%'},
  }),
  search: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.black_10,
      borderRadius: Styles.borderRadius,
    },
    isElectron: {
      minHeight: 24,
      minWidth: 240,
    },
    isMobile: {
      minHeight: 32,
      minWidth: 200,
    },
  }),
  searchContainer: Styles.platformStyles({
    common: {
      alignItems: 'center',
      flexGrow: 1,
      justifyContent: 'center',
    },
    isElectron: {
      ...Styles.desktopStyles.clickable,
    },
  }),
  searchLabel: {color: Styles.globalColors.white_75},
  sectionList: Styles.platformStyles({common: {width: '100%'}, isElectron: {willChange: 'transform'}}),
  sectionListContentStyle: Styles.platformStyles({
    common: {backgroundColor: Styles.globalColors.white, paddingBottom: Styles.globalMargins.xtiny},
    isMobile: {minHeight: '100%'},
  }),
  teamLink: {color: Styles.globalColors.black_75},
  teamShowcase: {alignItems: 'center'},
  teamShowcases: {
    flexShrink: 0,
    paddingBottom: Styles.globalMargins.small,
  },
})

export default User
