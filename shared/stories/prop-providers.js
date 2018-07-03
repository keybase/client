// @flow
import {action, createPropProvider} from './storybook'
import * as _Avatar from '../common-adapters/avatar'
import * as _Usernames from '../common-adapters/usernames'
import * as _WaitingButton from '../common-adapters/waiting-button'
import * as _TeamDropdownMenu from '../chat/conversation/info-panel/menu/container'

/**
 * Some common prop factory creators.
 *
 *  Params: specific pieces of data (not necessarily store data)
 *          that are needed to derive view props
 *  Output: a map of DisplayName: Function(...) that returns the
 *          view props the connected component is concerned with
 */

const Usernames = (following: string[], you?: string) => ({
  Usernames: (ownProps: _Usernames.ConnectedProps): _Usernames.Props => {
    const {usernames} = ownProps
    const users = (usernames || []).map(username => ({
      username,
      following: following.includes(username),
      you: you ? username === you : false,
    }))
    return {
      ...ownProps,
      users,
      onUsernameClicked: action('onUsernameClicked'),
    }
  },
})

const WaitingButton = () => ({
  WaitingButton: (ownProps: _WaitingButton.OwnProps): _WaitingButton.Props => ({
    ...ownProps,
    storeWaiting: false,
  }),
})

const Avatar = (following: string[], followers: string[]) => ({
  Avatar: (ownProps: _Avatar.OwnProps) => _Avatar.mockOwnToViewProps(ownProps, following, followers, action),
})

const TeamDropdownMenu = (adminTeams?: string[], teamMemberCounts?: {[key: string]: number}) => ({
  TeamDropdownMenu: (ownProps: _TeamDropdownMenu.OwnProps): _TeamDropdownMenu.Props => ({
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

const you = 'ayoubd'
const following = ['max', 'cnojima', 'cdixon']
const followers = ['max', 'akalin']

const Common = () => ({
  ...Usernames(following, you),
  ...Avatar(following, followers),
  ...WaitingButton(),
})

const CommonProvider = () => createPropProvider(Common())

export {Avatar, CommonProvider, TeamDropdownMenu, Usernames, WaitingButton}
