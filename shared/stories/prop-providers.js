// @flow
import {action, unexpected, createPropProvider} from './storybook'
import {mockOwnToViewProps} from '../common-adapters/avatar'

/**
 * Compose prop factories into a single provider
 * @param {Array<SelectorMap>} providers An array of objects of the form { DisplayName: Function(ownProps) }
 *                      that are combined in the output
 * @returns a <Provider /> that can be used in a storybook `addDecorator` to provide viewProps
 *          for connected child components
 */
const compose = (...providers: any[]) => {
  return createPropProvider(providers.reduce((obj, provider) => ({...obj, ...provider}), {}))
}

/**
 * Some common prop factory creators.
 *
 *  Params: specific pieces of data (not necessarily store data)
 *          that are needed to derive view props
 *  Output: a map of DisplayName: Function(...) that returns the
 *          view props the connected component is concerned with
 *
 *  TODO (DA) Type these props with respective OwnProps where possible
 */

const Usernames = (following: string[], you?: string) => ({
  Usernames: (props: any) => {
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

const Avatar = (following: string[], followers: string[]) => ({
  Avatar: (props: any) => {
    const ownProps = {
      following: following.includes(props.username),
      followsYou: followers.includes(props.username),
      ...props,
    }
    return mockOwnToViewProps(ownProps)
  },
  URLAvatar: (props: any) => props,
})

const TeamDropdownMenu = (adminTeams?: string[], teamMemberCounts?: {[key: string]: number}) => ({
  TeamDropdownMenu: (props: any) => ({
    _hasCanPerform: true,
    _loadOperations: unexpected('_loadOperations'),
    attachTo: props.attachTo,
    badgeSubscribe: false,
    canAddPeople: (adminTeams && adminTeams.includes(props.teamname)) || true,
    isSmallTeam: props.isSmallTeam,
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

export {compose}
export {Avatar, TeamDropdownMenu, Usernames}
