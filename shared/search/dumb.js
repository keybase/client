// @flow

import UserSearch from './user-search/render'
import UserGroup from './user-search/user-group'
import type {DumbComponentMap} from '../constants/types/more'

const results = [
  {
    service: 'external',
    serviceAvatar: null,
    icon: 'icon-twitter-logo-32',
    username: 'malgorithms',
    extraInfo: {
      service: 'keybase',
      username: 'chris',
      fullName: 'Chris Coyne',
      isFollowing: true
    }
  },
  {
    service: 'keybase',
    username: 'malg',
    isFollowing: false,
    extraInfo: {
      service: 'none',
      fullName: 'John Malg'
    }
  },
  {
    service: 'keybase',
    username: 'malgomalg',
    isFollowing: false,
    extraInfo: {
      service: 'none',
      fullName: 'Malgo Malg'
    }
  },
  {
    service: 'keybase',
    username: 'chris',
    isFollowing: true,
    extraInfo: {
      service: 'external',
      icon: 'fa-twitter',
      serviceUsername: 'malgorithms',
      serviceAvatar: null,
      fullNameOnService: 'Chris Coyne'
    }
  },
  {
    service: 'keybase',
    username: 'chris2',
    isFollowing: true,
    extraInfo: {
      service: 'keybase',
      username: 'chris',
      fullName: 'Chris Coyne',
      isFollowing: true
    }
  }
]

const userSearchMap: DumbComponentMap<UserSearch> = {
  component: UserSearch,
  mocks: {
    'Normal': {
      searchHintText: 'Search Keybase',
      searchText: 'malg',
      searchIcon: 'logo-32',
      selectedService: 'keybase',
      onClickService: () => console.log('onClickService'),
      onClickResult: () => console.log('onClickResult'),
      results
    }
  }
}

const userGroupMap: DumbComponentMap<UserGroup> = {
  component: UserGroup,
  mocks: {
    'Chat enabled': {
      parentProps: {style: {marginTop: 20, flex: 1}},
      users: [
        {
          service: 'keybase',
          username: 'max',
          isFollowing: false,
          extraInfo: {
            service: 'none',
            fullName: 'Max Krohn'
          }
        },
        {
          service: 'keybase',
          username: 'malg',
          isFollowing: false,
          extraInfo: {
            service: 'none',
            fullName: 'John Malg'
          }
        },
        {
          service: 'external',
          serviceAvatar: null,
          icon: 'fa-twitter',
          username: 'malgorithms',
          extraInfo: {
            service: 'external',
            icon: 'fa-twitter',
            serviceUsername: 'malgorithms',
            serviceAvatar: null,
            fullNameOnService: 'Chris Coyne'
          }
        }
      ],
      onOpenPrivateGroupFolder: () => console.log('onOpenPrivateGroupFolder'),
      onOpenPublicGroupFolder: () => console.log('onOpenPublicGroupFolder'),
      onRemoveUser: u => console.log('onRemoveUser', u),
      onClickUser: u => console.log('onClickUser', u),
      onGroupChat: () => console.log('onGroupChat'),
      onAddUser: () => console.log('onAddUser'),
      chatEnabled: true
    }
  }
}

export default {
  'user search': userSearchMap,
  'user group': userGroupMap
}
