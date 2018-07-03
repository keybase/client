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
  Usernames: (props: _Usernames.ConnectedProps): _Usernames.Props => {
    const {usernames} = props
    const users = (usernames || []).map(username => ({
      username,
      following: following.includes(username),
      you: you ? username === you : false,
    }))
    return {
      ...props,
      users,
      onUsernameClicked: action('onUsernameClicked'),
    }
  },
})

const WaitingButton = () => ({
  WaitingButton: (props: _WaitingButton.OwnProps): _WaitingButton.Props => ({...props, storeWaiting: false}),
})

const Avatar = (follows: string[], followers: string[]) => ({
  Avatar: (props: _Avatar.OwnProps) => _Avatar.mockOwnToViewProps(props, follows, followers, action),
})

const TeamDropdownMenu = (adminTeams?: string[], teamMemberCounts?: {[key: string]: number}) => ({
  TeamDropdownMenu: (props: _TeamDropdownMenu.OwnProps): _TeamDropdownMenu.Props => ({
    attachTo: props.attachTo,
    badgeSubscribe: false,
    canAddPeople: (adminTeams && adminTeams.includes(props.teamname)) || true,
    isSmallTeam: props.isSmallTeam,
    manageChannelsSubtitle: props.isSmallTeam ? 'Turns this into a big team' : '',
    manageChannelsTitle: props.isSmallTeam ? 'Create chat channels...' : 'Manage chat channels',
    memberCount: (teamMemberCounts && teamMemberCounts[props.teamname]) || 100,
    teamname: props.teamname,
    visible: props.visible,
    onAddPeople: action('onAddPeople'),
    onHidden: props.onHidden,
    onInvite: action('onInvite'),
    onLeaveTeam: action('onLeaveTeam'),
    onManageChannels: action('onManageChannels'),
    onViewTeam: action('onViewTeam'),
  }),
})

const Common = () => ({
  ...Usernames(['max', 'cnojima', 'cdixon'], 'ayoubd'),
  ...Avatar(['following', 'both'], ['followers', 'both']),
  ...WaitingButton(),
})

const CommonProvider = () => createPropProvider(Common())

export {Avatar, CommonProvider, TeamDropdownMenu, Usernames, WaitingButton}
