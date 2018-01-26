// @flow
import * as I from 'immutable'
import * as Types from './types/fs'

export const defaultPath = '/keybase'

const makeFolder: I.RecordFactory<Types._FolderPathItem> = I.Record({
  children: I.List(),
  type: 'folder',
})

const makeFile: I.RecordFactory<Types._FilePathItem> = I.Record({
  type: 'file',
  isExec: false,
})

export const makeState: I.RecordFactory<Types._State> = I.Record({
  pathItems: I.Map([
    [
      Types.stringToPath('/keybase'),
      makeFolder({
        children: I.List(['private', 'public', 'team']),
      }),
    ],
    [
      Types.stringToPath('/keybase/private'),
      makeFolder({
        children: I.List(['foo', 'foo,bar']),
      }),
    ],
    [
      Types.stringToPath('/keybase/public'),
      makeFolder({
        children: I.List(['foo', 'bar']),
      }),
    ],
    [
      Types.stringToPath('/keybase/team'),
      makeFolder({
        children: I.List(['foobar']),
      }),
    ],
    [
      Types.stringToPath('/keybase/private/foo'),
      makeFolder({
        children: I.List(['foo.priv']),
      }),
    ],
    [
      Types.stringToPath('/keybase/private/foo,bar'),
      makeFolder({
        children: I.List(['foo.bar.priv']),
      }),
    ],
    [
      Types.stringToPath('/keybase/public/foo'),
      makeFolder({
        children: I.List(['foo.pub']),
      }),
    ],
    [
      Types.stringToPath('/keybase/public/bar'),
      makeFolder({
        children: I.List(['bar.pub']),
      }),
    ],
    [
      Types.stringToPath('/keybase/team/foobar'),
      makeFolder({
        children: I.List(['foobar.team']),
      }),
    ],
    [Types.stringToPath('/keybase/private/foo/foo.priv'), makeFile()],
    [Types.stringToPath('/keybase/private/foo,bar/foo.bar.priv'), makeFile()],
    [Types.stringToPath('/keybase/public/foo/foo.pub'), makeFile()],
    [Types.stringToPath('/keybase/public/bar/bar.pub'), makeFile()],
    [Types.stringToPath('/keybase/team/foobar/foobar.team'), makeFile()],
  ]),
})
