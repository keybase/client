// @noflow
/* eslint-env jest */
import {getProfilePath} from '../../../constants/profile'
import * as I from 'immutable'
import type {PropsPath} from '../../../route-tree/index'
import {peopleTab} from '../../../constants/tabs'

describe('getProfilePath', () => {
  const state = {
    entities: {
      search: {
        searchResults: {
          get: () => null,
        },
      },
    },
  }

  const noPath = I.List()
  const baseTab = I.List([{node: peopleTab, props: I.Map({})}])
  const oneProfile = I.List([
    {node: peopleTab, props: I.Map({})},
    {node: 'profile', props: I.Map({username: 'chrisnojima'})},
  ])
  const editProfile = I.List([
    {node: peopleTab, props: I.Map({})},
    {node: 'profile', props: I.Map({username: 'ayoubd'})},
    {node: 'editProfile', props: I.Map({})},
  ])
  const nonUserOnTop = I.List([
    {node: peopleTab, props: I.Map({})},
    {node: 'profile', props: I.Map({username: 'chris'})},
    {
      node: 'nonUserProfile',
      props: I.Map({
        fullUsername: 'realdonaldtrump@twitter',
        serviceName: 'Twitter',
        username: 'realdonaldtrump',
      }),
    },
  ])
  const proofOnTop = I.List([
    {node: peopleTab, props: I.Map({})},
    {node: 'profile', props: I.Map({username: 'chris'})},
    {node: 'proveEnterUsername', props: I.Map({})},
  ])

  function check(
    peopleRouteProps: I.List<{node: ?string, props: I.Map<string, any>}>,
    username: string,
    me: string,
    expectedPath: PropsPath<*>
  ) {
    const result = getProfilePath(peopleRouteProps, username, me, state)
    expect(result).toMatchObject(expectedPath)
  }

  it('Navigates correctly to user profiles', () => {
    check(noPath, 'ayoubd', 'ayoubd', [peopleTab, {props: {username: 'ayoubd'}, selected: 'profile'}])
    check(noPath, 'chris', 'ayoubd', [peopleTab, {props: {username: 'chris'}, selected: 'profile'}])

    check(baseTab, 'ayoubd', 'ayoubd', [peopleTab, {props: {username: 'ayoubd'}, selected: 'profile'}])
    check(baseTab, 'chris', 'ayoubd', [peopleTab, {props: {username: 'chris'}, selected: 'profile'}])

    check(oneProfile, 'chrisnojima', 'ayoubd', [
      {props: {}, selected: peopleTab},
      {props: {username: 'chrisnojima'}, selected: 'profile'},
    ])
    check(oneProfile, 'ayoubd', 'ayoubd', [
      {props: {}, selected: peopleTab},
      {props: {username: 'chrisnojima'}, selected: 'profile'},
      {props: {username: 'ayoubd'}, selected: 'profile'},
    ])

    check(editProfile, 'ayoubd', 'ayoubd', [
      {props: {}, selected: peopleTab},
      {props: {username: 'ayoubd'}, selected: 'profile'},
    ])
    check(editProfile, 'mlsteele', 'ayoubd', [
      {props: {}, selected: peopleTab},
      {props: {username: 'ayoubd'}, selected: 'profile'},
      {props: {username: 'mlsteele'}, selected: 'profile'},
    ])

    check(nonUserOnTop, 'ayoubd', 'ayoubd', [
      {props: {}, selected: peopleTab},
      {props: {username: 'chris'}, selected: 'profile'},
      {
        props: {
          fullUsername: 'realdonaldtrump@twitter',
          serviceName: 'Twitter',
          username: 'realdonaldtrump',
        },
        selected: 'nonUserProfile',
      },
      {props: {username: 'ayoubd'}, selected: 'profile'},
    ])

    check(proofOnTop, 'chris', 'chris', [
      {props: {}, selected: peopleTab},
      {props: {username: 'chris'}, selected: 'profile'},
    ])
    check(proofOnTop, 'ayoubd', 'chris', [
      {props: {}, selected: peopleTab},
      {props: {username: 'chris'}, selected: 'profile'},
      {props: {username: 'ayoubd'}, selected: 'profile'},
    ])
  })

  it('Navigates correctly to non user profiles', () => {
    check(baseTab, 'realdonaldtrump@twitter', 'ayoubd', [
      {props: {}, selected: peopleTab},
      {
        props: {fullUsername: 'realdonaldtrump@twitter', serviceName: 'Twitter', username: 'realdonaldtrump'},
        selected: 'nonUserProfile',
      },
    ])

    check(oneProfile, 'realdonaldtrump@twitter', 'ayoubd', [
      {props: {}, selected: peopleTab},
      {props: {username: 'chrisnojima'}, selected: 'profile'},
      {
        props: {fullUsername: 'realdonaldtrump@twitter', serviceName: 'Twitter', username: 'realdonaldtrump'},
        selected: 'nonUserProfile',
      },
    ])

    check(editProfile, 'realdonaldtrump@twitter', 'ayoubd', [
      {props: {}, selected: peopleTab},
      {props: {username: 'ayoubd'}, selected: 'profile'},
      {
        props: {fullUsername: 'realdonaldtrump@twitter', serviceName: 'Twitter', username: 'realdonaldtrump'},
        selected: 'nonUserProfile',
      },
    ])

    check(nonUserOnTop, 'realdonaldtrump@twitter', 'ayoubd', [
      {props: {}, selected: peopleTab},
      {props: {username: 'chris'}, selected: 'profile'},
      {
        props: {fullUsername: 'realdonaldtrump@twitter', serviceName: 'Twitter', username: 'realdonaldtrump'},
        selected: 'nonUserProfile',
      },
    ])
    check(nonUserOnTop, 'keybaseIO@twitter', 'ayoubd', [
      {props: {}, selected: peopleTab},
      {props: {username: 'chris'}, selected: 'profile'},
      {
        props: {fullUsername: 'realdonaldtrump@twitter', serviceName: 'Twitter', username: 'realdonaldtrump'},
        selected: 'nonUserProfile',
      },
      {
        props: {fullUsername: 'keybaseIO@twitter', serviceName: 'Twitter', username: 'keybaseIO'},
        selected: 'nonUserProfile',
      },
    ])

    check(proofOnTop, 'realdonaldtrump@twitter', 'chris', [
      {props: {}, selected: peopleTab},
      {props: {username: 'chris'}, selected: 'profile'},
      {
        props: {fullUsername: 'realdonaldtrump@twitter', serviceName: 'Twitter', username: 'realdonaldtrump'},
        selected: 'nonUserProfile',
      },
    ])
  })
})
