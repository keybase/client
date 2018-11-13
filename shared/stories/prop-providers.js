// @flow
import * as _Avatar from '../common-adapters/avatar'
import * as _Usernames from '../common-adapters/usernames'
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
      .map(username => ({username, following: following.includes(username), you: username === you}))
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
    loadOperations: action('_loadOperations'),
    hasCanPerform: true,
    attachTo: ownProps.attachTo,
    badgeSubscribe: false,
    canAddPeople: (adminTeams && adminTeams.includes(ownProps.teamname)) || true,
    isSmallTeam: ownProps.isSmallTeam,
    manageChannelsSubtitle: ownProps.isSmallTeam ? 'Turns this into a big team' : '',
    manageChannelsTitle: ownProps.isSmallTeam ? 'Create chat channels...' : 'Manage chat channels',
    memberCount: (teamMemberCounts && teamMemberCounts[ownProps.teamname]) || 100,
    teamname: ownProps.teamname,
    visible: ownProps.visible,
    onAddPeople: action('onAddPeople'),
    onHidden: ownProps.onHidden,
    onInvite: action('onInvite'),
    onLeaveTeam: action('onLeaveTeam'),
    onManageChannels: action('onManageChannels'),
    onViewTeam: action('onViewTeam'),
  }),
})

const CopyText = () => ({
  CopyText: (p: _CopyText.Props) => ({...p, copyToClipboard: action('copyToClipboard')}),
})

// $ForceType
const Channel = ({name, convID, key, style}) => ({
  name,
  convID,
  key,
  style,
  onClick: action('onClickChannel'),
})

const usernameToTheme = {
  following: 'follow',
  notFollowing: 'nonFollow',
  myUsername: 'highlight',
  noTheme: 'none',
}

// $ForceType
const Mention = ({username, key, style}) => ({
  username,
  key,
  style,
  theme: usernameToTheme[username] || (isSpecialMention(username) ? 'highlight' : 'none'),
  onClick: action('onClick Mention'),
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

export const Common = () => ({
  ...Usernames(),
  ...Avatar(),
  ...WaitingButton(),
  ...CopyText(),
  ...NameWithIcon(),
  Mention,
  Channel,
})

export const createPropProviderWithCommon = (custom: ?Object) =>
  createPropProvider({
    ...Common(),
    ...(custom || {}),
  })
