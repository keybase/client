// @flow
import * as I from 'immutable'
import * as Types from './types/fs'

export const makeState: I.RecordFactory<Types._State> = I.Record({
  path: '/keybase',
  pathItems: I.Map({
    '/keybase': {
      type: 'folder',
      children: I.List([
        'private', 'public', 'team',
      ]),
    },
    '/keybase/private': {
      type: 'folder',
      children: I.List([
        'foo', 'foo,bar',
      ]),
    },
    '/keybase/public': {
      type: 'folder',
      children: I.List([
        'foo', 'bar',
      ]),
    },
    '/keybase/team': {
      type: 'folder',
      children: I.List([
        'foobar',
      ]),
    },
    '/keybase/private/foo': {
      type: 'folder',
      children: I.List([
        'foo.priv',
      ]),
    },
    '/keybase/private/foo,bar': {
      type: 'folder',
      children: I.List([
        'foo.bar.priv',
      ]),
    },
    '/keybase/public/foo': {
      type: 'folder',
      children: I.List([
        'foo.pub',
      ]),
    },
    '/keybase/public/bar': {
      type: 'folder',
      children: I.List([
        'bar.pub',
      ]),
    },
    '/keybase/team/foobar': {
      type: 'folder',
      children: I.List([
        'foobar.team',
      ]),
    },
    '/keybase/private/foo/foo.priv': {
      type: 'file',
    },
    '/keybase/private/foo,bar/foo.bar.priv': {
      type: 'file',
    },
    '/keybase/public/foo/foo.pub': {
      type: 'file',
    },
    '/keybase/public/bar/bar.pub': {
      type: 'file',
    },
    '/keybase/team/foobar/foobar.team': {
      type: 'file',
    },
  }),
})
