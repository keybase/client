// @flow

import UserSearch from './user-search/render'
import type {DumbComponentMap} from '../constants/types/more'

const userSearchMap: DumbComponentMap<UserSearch> = {
  component: UserSearch,
  mocks: {
    'Normal': {
      onSearch: text => console.log('OnSearch: ', text),
      searchHintText: 'Search Keybase',
      searchText: 'malg',
      searchIcon: 'logo-32',
      results: [
        {
          service: 'external',
          icon: 'fa-twitter',
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
    }
  }
}

export default {
  'user search': userSearchMap
}
