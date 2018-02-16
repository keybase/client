// @flow
import React from 'react'
import * as Types from '../constants/types/fs'
import {action, storiesOf, createPropProvider} from '../stories/storybook'
import Files from '.'

const provider = createPropProvider({
  FileRow: ({path}: {path: Types.Path}) => ({
    icon: 'icon-folder-private-24',
    name: Types.getPathName(path),
    onOpen: () => {},
    path,
  }),
  FolderHeader: () => ({
    breadcrumbItems: [
      {
        name: 'keybase',
        path: '/keybase',
      },
    ],
    dropdownItems: [],
    isTeamPath: false,
    onOpenBreadcrumb: action('onOpenBreadcrumb'),
    onOpenBreadcrumbDropdown: action('onOpenBreadcrumbDropdown'),
  }),
})

const load = () => {
  storiesOf('Files', module)
    .addDecorator(provider)
    .add('Root', () => (
      <Files
        path={Types.stringToPath('/keybase')}
        progress="pending"
        items={[
          Types.stringToPath('/keybase/private'),
          Types.stringToPath('/keybase/public'),
          Types.stringToPath('/keybase/team'),
        ]}
      />
    ))
}

export default load
