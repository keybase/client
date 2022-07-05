// TODO deprecated
import * as _Avatar from '../common-adapters/avatar'
import * as _Usernames from '../common-adapters/usernames'
import {OwnProps as ReloadableOwnProps, Props as ReloadableProps} from '../common-adapters/reload'
import * as _WaitingButton from '../common-adapters/waiting-button'
import {OwnProps as TeamDropdownMenuOwnProps} from '../chat/conversation/info-panel/menu/container'
import {Props as TeamDropdownMenuProps} from '../chat/conversation/info-panel/menu'
import {NameWithIconProps} from '../common-adapters/name-with-icon'
import {ConnectedNameWithIconProps} from '../common-adapters/name-with-icon/container'
import {createPropProvider, action} from './storybook.shared'
import {isMobile} from '../constants/platform'
import {isSpecialMention} from '../constants/chat2'
import * as FsConstants from '../constants/fs'
import * as ChatConstants from '../constants/chat2'
import * as TeamTypes from '../constants/types/teams'
import * as Tracker2Constants from '../constants/tracker2'
import rootReducer, {TypedState} from '../reducers'

/*
 * Some common prop factory creators.
 *
 *  Params: specific pieces of data (not necessarily store data)
 *          that are needed to derive view props
 *  Output: a map of DisplayName: Function(...) that returns the
 *          view props the connected component is concerned with
 */

const defaultYou = 'ayoubd'
const defaultFollowing = ['max', 'cnojima', 'cdixon', 'following', 'both', 'weijiekohyalenus']
const defaultFollowers = ['max', 'akalin', 'followers', 'both', 'weijiekohyalenus']

export const Usernames = (following: string[] = defaultFollowing, you: string = defaultYou) => ({
  Usernames: (ownProps: any): _Usernames.Props => {
    const {usernames, onUsernameClicked, skipSelf, ...props} = ownProps
    const users = (usernames || [])
      .map((username: string) => ({following: following.includes(username), username, you: username === you}))
      .filter((u: any) => !skipSelf || !u.you)

    let mockedOnUsernameClick
    if (onUsernameClicked === 'tracker') {
      mockedOnUsernameClick = action('onUsernameClicked (Tracker)')
    } else if (onUsernameClicked === 'profile') {
      mockedOnUsernameClick = action('onUsernameClicked (Profile)')
    } else if (onUsernameClicked) {
      mockedOnUsernameClick = onUsernameClicked
    }

    return {
      ...props,
      onUsernameClicked: mockedOnUsernameClick,
      users,
    }
  },
})

// Pass "waitingKey: true" to this to render the waiting state
export const WaitingButton = () => ({
  WaitingButton: (ownProps: _WaitingButton.OwnProps): _WaitingButton.Props => ({
    ...ownProps,
    storeWaiting: ownProps.waitingKey === 'true',
  }),
})

export const Avatar = (following: string[] = defaultFollowing, followers: string[] = defaultFollowers) => ({
  Avatar: (ownProps: _Avatar.OwnProps) => _Avatar.mockOwnToViewProps(ownProps, following, followers, action),
})

export const TeamDropdownMenu = () => ({
  TeamDropdownMenu: (ownProps: TeamDropdownMenuOwnProps): TeamDropdownMenuProps => ({
    attachTo: ownProps.attachTo,
    badgeSubscribe: false,
    canAddPeople: true,

    convProps: {
      conversationIDKey: ChatConstants.noConversationIDKey,
      fullname: '',
      ignored: false,
      muted: false,
      teamID: '',
      teamType: ownProps.isSmallTeam ? 'small' : 'big',
      teamname: '',
    },

    hasHeader: ownProps.hasHeader,
    isInChannel: false,
    isSmallTeam: ownProps.isSmallTeam,
    manageChannelsSubtitle: ownProps.isSmallTeam ? 'Turns this into a big team' : '',
    manageChannelsTitle: ownProps.isSmallTeam ? 'Create chat channels...' : 'Manage chat channels',
    onAddPeople: action('onAddPeople'),
    onBlockConv: action('onBlockConv'),
    onHidden: ownProps.onHidden,
    onHideConv: action('onHideConv'),
    onInvite: action('onInvite'),
    onJoinChannel: action('onJoinChannel'),
    onLeaveChannel: action('onLeaveChannel'),
    onLeaveTeam: action('onLeaveTeam'),
    onManageChannels: action('onManageChannels'),
    onMuteConv: action('onMuteConv'),
    onUnhideConv: action('onUnhideConv'),
    onViewTeam: action('onViewTeam'),
    teamID: TeamTypes.noTeamID,
    teamname: '',
    visible: ownProps.visible,
  }),
})

const Channel = ({name, convID, key, style}: any) => ({
  convID,
  key,
  name,
  onClick: action('onClickChannel'),
  style,
})

const usernameToTheme = {
  following: 'follow',
  myUsername: 'highlight',
  noTheme: 'none',
  notFollowing: 'nonFollow',
}

const Mention = ({username, key, style}: any) => ({
  key,
  onClick: action('onClick Mention'),
  style,
  // @ts-ignore strict
  theme: usernameToTheme[username] || (isSpecialMention(username) ? 'highlight' : 'none'),
  username,
})

export const NameWithIcon = () => ({
  NameWithIcon: (ownProps: ConnectedNameWithIconProps): NameWithIconProps => {
    const {onClick, ...props} = ownProps

    let functionOnClick
    let clickType: any
    if (!isMobile && onClick === 'tracker') {
      functionOnClick = action('onNameWithIconClicked (tracker)')
      clickType = 'tracker'
    } else if (onClick === 'profile' || (isMobile && onClick === 'tracker')) {
      if (ownProps.username) {
        functionOnClick = action('onNameWithIconClicked (user profile)')
      } else if (ownProps.teamname) {
        functionOnClick = action('onNameWithIconClicked (team profile)')
      }
      clickType = 'profile'
    }
    return {...props, clickType, onClick: functionOnClick}
  },
})

export const Reloadable = () => ({
  Reloadable: (p: ReloadableOwnProps): ReloadableProps => ({
    children: p.children,
    needsReload: false,
    onFeedback: action('feedback'),
    onReload: action('reload'),
    reason: '',
    reloadOnMount: false,
  }),
})

export const Common = () => ({
  ...Avatar(),
  ...NameWithIcon(),
  ...Reloadable(),
  ...Usernames(),
  ...WaitingButton(),
  Channel,
  Mention,
})

export const createPropProviderWithCommon = (custom: Object | null) =>
  // @ts-ignore not sure
  createPropProvider({
    ...Common(),
    ...createStoreWithCommon(),
    ...(custom || {}),
  })

export const createStoreWithCommon = (): TypedState => {
  const root = rootReducer(undefined, {type: 'ignore'})
  return {
    ...root,
    config: {
      ...root.config,
      followers: new Set(defaultFollowers),
      following: new Set(defaultFollowing),
      username: defaultYou,
    },
    fs: {
      ...root.fs,
      pathInfos: new Map([
        [
          '/keybase/private/meatball/folder/treat',
          {
            deeplinkPath: 'keybase://private/meatball/folder/treat',
            platformAfterMountPath: '/private/meatball/folder/treat',
          },
        ],
      ]),
      sfmi: {
        directMountDir: '/Volumes/Keybase (meatball)',
        driverStatus: FsConstants.emptyDriverStatusEnabled,
        preferredMountDirs: ['/Volumes/Keybase', '/Volumes/Keybase (meatball)'],
      },
    },
    tracker2: {
      ...root.tracker2,
      usernameToDetails: new Map([
        ...root.tracker2.usernameToDetails,
        [
          't_alice',
          {
            ...Tracker2Constants.noDetails,
            assertions: new Map([
              [
                'twitter:alice',
                {
                  ...Tracker2Constants.noAssertion,
                  type: 'twitter',
                  value: 'alice',
                },
              ],
              [
                'facebook:alice',
                {
                  ...Tracker2Constants.noAssertion,
                  type: 'facebook',
                  value: 'alice',
                },
              ],
              [
                'github:alice',
                {
                  ...Tracker2Constants.noAssertion,
                  type: 'github',
                  value: 'alice',
                },
              ],
              [
                'hackernews:alice',
                {
                  ...Tracker2Constants.noAssertion,
                  type: 'hackernews',
                  value: 'alice',
                },
              ],
              [
                'reddit:alice',
                {
                  ...Tracker2Constants.noAssertion,
                  type: 'reddit',
                  value: 'alice',
                },
              ],
            ]),
            bio: 'The Alice at Keybase since the beginning of time.',
            state: 'valid',
            username: 't_alice',
          },
        ],
      ]),
    },
  }
}
