// @flow
import React from 'react'
import * as Types from '../constants/types/fs'
import {action, storiesOf, createPropProvider} from '../stories/storybook'
import {globalColors} from '../styles'
import Files from '.'
import FilePreview from './filepreview'

const provider = createPropProvider({
  FileRow: ({path}: {path: Types.Path}) => ({
    name: Types.getPathName(path),
    onOpen: () => {},
    openInFileUI: () => {},
    type: 'folder',
    itemStyles: {
      iconSpec: {
        type: 'basic',
        iconType: 'icon-folder-private-32',
        iconColor: globalColors.darkBlue2,
      },
      textColor: globalColors.darkBlue,
      textType: 'BodySemibold',
    },
  }),
  Footer: () => ({
    downloads: [],
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
  SortBar: ({path}: {path: Types.Path}) => ({
    sortSetting: {
      sortBy: 'name',
      sortOrder: 'asc',
    },
    onOpenSortSettingPopup: () => {},
    folderIsPending: true,
  }),
})

const previewPathName = '/keybase/private/foo/bar.img'

const load = () => {
  storiesOf('Files', module)
    .addDecorator(provider)
    .add('Root', () => (
      <Files
        path={Types.stringToPath('/keybase')}
        progress="loaded"
        items={[
          Types.stringToPath('/keybase/private'),
          Types.stringToPath('/keybase/public'),
          Types.stringToPath('/keybase/team'),
        ]}
      />
    ))
    .add('Preview', () => (
      <FilePreview
        path={Types.stringToPath(previewPathName)}
        meta={{
          name: previewPathName,
          lastModifiedTimestamp: 1518029754000,
          size: 15000,
          lastWriter: 'foobar',
          progress: 'pending',
        }}
      />
    ))
}

export default load
