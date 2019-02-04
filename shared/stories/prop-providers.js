// @flow
import * as _Avatar from '../common-adapters/avatar'
import * as _Usernames from '../common-adapters/usernames'
import type {OwnProps as ReloadableOwnProps, Props as ReloadableProps} from '../common-adapters/reload'
import type {ConnectedProps as _UsernamesConnectedProps} from '../common-adapters/usernames/container'
import * as _WaitingButton from '../common-adapters/waiting-button'
import type {OwnProps as TeamDropdownMenuOwnProps} from '../chat/conversation/info-panel/menu/container'
import type {Props as TeamDropdownMenuProps} from '../chat/conversation/info-panel/menu'
import * as _CopyText from '../common-adapters/copy-text'
import type {NameWithIconProps} from '../common-adapters/name-with-icon'
import type {ConnectedNameWithIconProps} from '../common-adapters/name-with-icon/container'
import {createPropProvider, action} from './storybook.shared'
import {isMobile} from '../constants/platform'
import {isSpecialMention} from '../constants/chat2'
import {unescapePath} from '../constants/fs'
import {type OwnProps as KbfsPathProps} from '../common-adapters/markdown/kbfs-path-container.js'

/*
 * Some common prop factory creators.
 *
 *  Params: specific pieces of data (not necessarily store data)
 *          that are needed to derive view props
 *  Output: a map of DisplayName: Function(...) that returns the
 *          view props the connected component is concerned with
 */

const defaultYou = 'ayoubd'
const defaultFollowing = ['max', 'cnojima', 'cdixon']
const defaultFollowers = ['max', 'akalin']

export const Usernames = (following: string[] = defaultFollowing, you: string = defaultYou) => ({
  Usernames: (ownProps: _UsernamesConnectedProps): _Usernames.Props => {
    const {usernames, onUsernameClicked, skipSelf, ...props} = ownProps
    const users = (usernames || [])
      .map(username => ({following: following.includes(username), username, you: username === you}))
      .filter(u => !skipSelf || !u.you)

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
  Avatar: (ownProps: _Avatar.Props) => _Avatar.mockOwnToViewProps(ownProps, following, followers, action),
})

export const TeamDropdownMenu = (adminTeams?: string[], teamMemberCounts?: {[key: string]: number}) => ({
  TeamDropdownMenu: (ownProps: TeamDropdownMenuOwnProps): TeamDropdownMenuProps => ({
    attachTo: ownProps.attachTo,
    badgeSubscribe: false,
    canAddPeople: (adminTeams && adminTeams.includes(ownProps.teamname)) || true,
    hasCanPerform: true,
    isSmallTeam: ownProps.isSmallTeam,
    loadOperations: action('_loadOperations'),
    manageChannelsSubtitle: ownProps.isSmallTeam ? 'Turns this into a big team' : '',
    manageChannelsTitle: ownProps.isSmallTeam ? 'Create chat channels...' : 'Manage chat channels',
    memberCount: (teamMemberCounts && teamMemberCounts[ownProps.teamname]) || 100,
    onAddPeople: action('onAddPeople'),
    onHidden: ownProps.onHidden,
    onInvite: action('onInvite'),
    onLeaveTeam: action('onLeaveTeam'),
    onManageChannels: action('onManageChannels'),
    onViewTeam: action('onViewTeam'),
    teamname: ownProps.teamname,
    visible: ownProps.visible,
  }),
})

const CopyText = () => ({
  CopyText: (p: _CopyText.Props) => ({...p, copyToClipboard: action('copyToClipboard')}),
})

// $ForceType
const Channel = ({name, convID, key, style}) => ({
  convID,
  key,
  name,
  onClick: action('onClickChannel'),
  style,
})

const KbfsPath = ({escapedPath, allowFontScaling}: KbfsPathProps) => ({
  allowFontScaling,
  onClick: action('onClickKbfsPath'),
  path: unescapePath(escapedPath),
})

const usernameToTheme = {
  following: 'follow',
  myUsername: 'highlight',
  noTheme: 'none',
  notFollowing: 'nonFollow',
}

// $ForceType
const Mention = ({username, key, style}) => ({
  key,
  onClick: action('onClick Mention'),
  style,
  theme: usernameToTheme[username] || (isSpecialMention(username) ? 'highlight' : 'none'),
  username,
})

export const NameWithIcon = () => ({
  NameWithIcon: (ownProps: ConnectedNameWithIconProps): NameWithIconProps => {
    const {onClick, ...props} = ownProps

    let functionOnClick
    let clickType
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
    onReload: action('reload'),
    reason: '',
    reloadOnMount: false,
  }),
})

export const Common = () => ({
  ...Avatar(),
  ...CopyText(),
  ...NameWithIcon(),
  ...Reloadable(),
  ...Usernames(),
  ...WaitingButton(),
  Channel,
  KbfsPath,
  Mention,
})

export const createPropProviderWithCommon = (custom: ?Object) =>
  createPropProvider({
    ...Common(),
    ...(custom || {}),
  })
