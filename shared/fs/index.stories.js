// @flow
import React from 'react'
import * as Types from '../constants/types/fs'
import {action, storiesOf, createPropProvider} from '../stories/storybook'
import Files from '.'

const provider = createPropProvider({
  FolderHeader: () => ({
    isTeamPath: false,
    items: [
      {
        name: 'keybase',
        path: '/keybase',
      },
    ],
    onOpenBreadcrumb: action('onOpenBreadcrumb'),
  }),
  FileRow: ({path}: {path: Types.Path}) => ({
    icon: 'icon-folder-private-24',
    name: Types.getPathName(path),
    path,
    onOpen: () => {},
  }),
})

const load = () => {
  storiesOf('Files', module)
    .addDecorator(provider)
    .add('Root', () => (
      <Files
        path={Types.stringToPath('/keybase')}
        items={[
          Types.stringToPath('/keybase/private'),
          Types.stringToPath('/keybase/public'),
          Types.stringToPath('/keybase/team'),
        ]}
      />
    ))
}

export default load
