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
    check(noPath, 'ayoubd', 'ayoubd', [peopleTab, {selected: 'profile', props: {username: 'ayoubd'}}])
    check(noPath, 'chris', 'ayoubd', [peopleTab, {selected: 'profile', props: {username: 'chris'}}])

    check(baseTab, 'ayoubd', 'ayoubd', [peopleTab, {selected: 'profile', props: {username: 'ayoubd'}}])
    check(baseTab, 'chris', 'ayoubd', [peopleTab, {selected: 'profile', props: {username: 'chris'}}])

    check(oneProfile, 'chrisnojima', 'ayoubd', [
      {selected: peopleTab, props: {}},
      {selected: 'profile', props: {username: 'chrisnojima'}},
    ])
    check(oneProfile, 'ayoubd', 'ayoubd', [
      {selected: peopleTab, props: {}},
      {selected: 'profile', props: {username: 'chrisnojima'}},
      {selected: 'profile', props: {username: 'ayoubd'}},
    ])

    check(editProfile, 'ayoubd', 'ayoubd', [
      {selected: peopleTab, props: {}},
      {selected: 'profile', props: {username: 'ayoubd'}},
    ])
    check(editProfile, 'mlsteele', 'ayoubd', [
      {selected: peopleTab, props: {}},
      {selected: 'profile', props: {username: 'ayoubd'}},
      {selected: 'profile', props: {username: 'mlsteele'}},
    ])

    check(nonUserOnTop, 'ayoubd', 'ayoubd', [
      {selected: peopleTab, props: {}},
      {selected: 'profile', props: {username: 'chris'}},
      {
        selected: 'nonUserProfile',
        props: {
          fullUsername: 'realdonaldtrump@twitter',
          serviceName: 'Twitter',
          username: 'realdonaldtrump',
        },
      },
      {selected: 'profile', props: {username: 'ayoubd'}},
    ])

    check(proofOnTop, 'chris', 'chris', [
      {selected: peopleTab, props: {}},
      {selected: 'profile', props: {username: 'chris'}},
    ])
    check(proofOnTop, 'ayoubd', 'chris', [
      {selected: peopleTab, props: {}},
      {selected: 'profile', props: {username: 'chris'}},
      {selected: 'profile', props: {username: 'ayoubd'}},
    ])
  })

  it('Navigates correctly to non user profiles', () => {
    check(baseTab, 'realdonaldtrump@twitter', 'ayoubd', [
      {selected: peopleTab, props: {}},
      {
        selected: 'nonUserProfile',
        props: {fullUsername: 'realdonaldtrump@twitter', serviceName: 'Twitter', username: 'realdonaldtrump'},
      },
    ])

    check(oneProfile, 'realdonaldtrump@twitter', 'ayoubd', [
      {selected: peopleTab, props: {}},
      {selected: 'profile', props: {username: 'chrisnojima'}},
      {
        selected: 'nonUserProfile',
        props: {fullUsername: 'realdonaldtrump@twitter', serviceName: 'Twitter', username: 'realdonaldtrump'},
      },
    ])

    check(editProfile, 'realdonaldtrump@twitter', 'ayoubd', [
      {selected: peopleTab, props: {}},
      {selected: 'profile', props: {username: 'ayoubd'}},
      {
        selected: 'nonUserProfile',
        props: {fullUsername: 'realdonaldtrump@twitter', serviceName: 'Twitter', username: 'realdonaldtrump'},
      },
    ])

    check(nonUserOnTop, 'realdonaldtrump@twitter', 'ayoubd', [
      {selected: peopleTab, props: {}},
      {selected: 'profile', props: {username: 'chris'}},
      {
        selected: 'nonUserProfile',
        props: {fullUsername: 'realdonaldtrump@twitter', serviceName: 'Twitter', username: 'realdonaldtrump'},
      },
    ])
    check(nonUserOnTop, 'keybaseIO@twitter', 'ayoubd', [
      {selected: peopleTab, props: {}},
      {selected: 'profile', props: {username: 'chris'}},
      {
        selected: 'nonUserProfile',
        props: {fullUsername: 'realdonaldtrump@twitter', serviceName: 'Twitter', username: 'realdonaldtrump'},
      },
      {
        selected: 'nonUserProfile',
        props: {fullUsername: 'keybaseIO@twitter', serviceName: 'Twitter', username: 'keybaseIO'},
      },
    ])

    check(proofOnTop, 'realdonaldtrump@twitter', 'chris', [
      {selected: peopleTab, props: {}},
      {selected: 'profile', props: {username: 'chris'}},
      {
        selected: 'nonUserProfile',
        props: {fullUsername: 'realdonaldtrump@twitter', serviceName: 'Twitter', username: 'realdonaldtrump'},
      },
    ])
  })
})
