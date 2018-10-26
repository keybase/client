// @flow
import * as I from 'immutable'
import React from 'react'
import * as Types from '../constants/types/fs'
import * as Constants from '../constants/fs'
import * as Sb from '../stories/storybook'
import Files from '.'
import {NormalPreview} from './filepreview'
import {Box} from '../common-adapters'
import Breadcrumb from './header/breadcrumb.desktop'
import Banner from './banner'
import rowStories, {rowsProvider} from './row/index.stories'
import commonStories, {commonProvider} from './common/index.stories'
import footerStories, {footerProvider} from './footer/index.stories'

const provider = Sb.createPropProviderWithCommon({
  ...rowsProvider,
  ...commonProvider,
  ...footerProvider,
  FolderHeader: () => ({
    breadcrumbItems: [
      {
        name: 'keybase',
        path: '/keybase',
      },
    ],
    dropdownItems: [],
    isTeamPath: false,
    path: Types.stringToPath('/keybase'),
    onBack: Sb.action('onBack'),
    onOpenBreadcrumb: Sb.action('onOpenBreadcrumb'),
    onOpenBreadcrumbDropdown: Sb.action('onOpenBreadcrumbDropdown'),
  }),
  ConnectedBreadcrumb: () => ({
    dropdownItems: undefined,
    shownItems: [],
  }),
  SortBar: ({path}: {path: Types.Path}) => ({
    sortSetting: {
      sortBy: 'name',
      sortOrder: 'asc',
    },
    folderIsPending: true,
    sortSettingToAction: sortSetting => Sb.action(`sortSettingToAction${sortSetting}`),
  }),
  FilesBanner: () => ({
    path: Types.stringToPath('/keybase'),
    kbfsEnabled: true,
    showBanner: false,
    inProgress: false,
    showSecurityPrefs: false,
    getFuseStatus: Sb.action('getFuseStatus'),
    onDismiss: Sb.action('onDismiss'),
    onInstall: Sb.action('onInstall'),
    onUninstall: Sb.action('onUninstall'),
  }),
  FilePreviewDefaultView: () => ({
    fileUIEnabled: false,
    pathItem: Constants.makeFile({
      name: 'bar.jpg',
      size: 10240,
      lastWriter: {uid: '', username: 'foo'},
    }),
    itemStyles: Constants.getItemStyles(['keybase', 'private', 'foo', 'bar.jpg'], 'file', 'foo'),
    onDownload: () => {},
    onShowInSystemFileManager: () => {},
    onShare: () => {},
    onSave: () => {},
  }),
  FilePreviewHeader: () => ({
    pathItem: Constants.makeFile({
      name: 'bar.jpg',
      size: 10240,
      lastWriter: {uid: '', username: 'foo'},
    }),
    onAction: () => {},
    onBack: () => {},
    onShowInSystemFileManager: () => {},
    loadFilePreview: () => {},
    path: '/keybase/private/foo/bar.jpg',
  }),
  ViewContainer: () => ({
    url: '/keybase/private/foo/bar.jpg',
    mimeType: 'jpg',
    isSymlink: false,
    path: '/keybase/private/foo/bar.jpg',
    onInvalidToken: Sb.action('onInvalidToken'),
    loadMimeType: Sb.action('loadMimeType'),
  }),
  ResetBanner: ({path}: {path: Types.Path}) => ({
    isUserReset: Types.pathToString(path) === '/keybase/private/me,reset',
    resetParticipants: ['reset1', 'reset2', 'reset3'],
    onReAddToTeam: () => () => undefined,
    onViewProfile: () => () => undefined,
  }),
  Banner: ({path}: {path: Types.Path}) => ({
    path,
    shouldShowReset: Types.pathToString(path).includes('reset'),
  }),
  ConnectedAddNew: () => ({
    pathElements: [],
    style: {},
    menuItems: [],
  }),
  ConnectedFilesLoadingHoc: o => ({
    ...o,
    syncingPaths: Sb.action('syncingPaths'),
    loadFolderList: Sb.action('loadFolderList'),
    loadFavorites: Sb.action('loadFavorites'),
    path: '',
  }),
  ConnectedRows: o => ({
    items: [
      {rowType: 'still', path: Types.stringToPath('/keybase/private/me'), name: 'me'},
      {rowType: 'still', path: Types.stringToPath('/keybase/private/me,abc'), name: 'me,abc'},
      {rowType: 'still', path: Types.stringToPath('/keybase/private/me,abc,def'), name: 'me,abc,def'},
      {
        rowType: 'still',
        path: Types.stringToPath('/keybase/private/me,abc,def,ghi'),
        name: 'me,abc,def,ghi',
      },
      {rowType: 'still', path: Types.stringToPath('/keybase/private/me,def'), name: 'me,def'},
      {rowType: 'still', path: Types.stringToPath('/keybase/private/me,def,ghi'), name: 'me,def,ghi'},
      {rowType: 'still', path: Types.stringToPath('/keybase/private/me,ghi'), name: 'me,ghi'},
      {rowType: 'still', path: Types.stringToPath('/keybase/private/me,abc,ghi'), name: 'me,abc,ghi'},
    ],
    routePath: I.List(),
    ...o,
  }),
})

const breadcrumbProps = (names: Array<string>) => {
  const items = names.map((name, idx) => ({
    isTeamTlf: idx === 2 && names[idx - 1] === 'team',
    isLastItem: idx === names.length - 1,
    name: name,
    path: Types.stringToPath('/' + names.slice(0, idx + 1).join('/')),
    iconSpec: Constants.getItemStyles(names.slice(0, idx + 1), 'folder', 'foo').iconSpec,
    onClick: Sb.action('onClick'),
  }))
  return items.length > 3
    ? {
        dropdownItems: items.slice(0, items.length - 2),
        shownItems: items.slice(items.length - 2),
      }
    : {
        dropdownItems: undefined,
        shownItems: items,
      }
}

const load = () => {
  Sb.storiesOf('Files', module)
    .addDecorator(provider)
    .add('Root', () => (
      <Files
        path={Types.stringToPath('/keybase')}
        routePath={I.List([])}
        isUserReset={false}
        resetParticipants={['foo']}
        sortSetting={Constants.makeSortSetting()}
      />
    ))
    .add('Preview', () => (
      <NormalPreview
        routePath={I.List([])}
        routeProps={I.Map({
          path: '/keybase/private/foo/bar.jpg',
        })}
      />
    ))
    .add('Breadcrumbs', () => (
      <Box>
        <Breadcrumb {...breadcrumbProps(['keybase', 'private', 'foo', 'bar'])} />
        <Breadcrumb {...breadcrumbProps(['keybase', 'private', 'foo'])} />
        <Breadcrumb
          {...breadcrumbProps([
            'keybase',
            'private',
            'foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo',
          ])}
        />
        <Breadcrumb
          {...breadcrumbProps([
            'keybase',
            'private',
            'foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar',
          ])}
        />
        <Breadcrumb
          {...breadcrumbProps([
            'keybase',
            'private',
            'foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo',
            'haha',
          ])}
        />
        <Breadcrumb
          {...breadcrumbProps([
            'keybase',
            'private',
            'foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar',
            'haha',
          ])}
        />
      </Box>
    ))
    .add('ResetRows', () => (
      <Files
        path={Types.stringToPath('/keybase')}
        routePath={I.List([])}
        isUserReset={false}
        resetParticipants={[]}
        sortSetting={Constants.makeSortSetting()}
      />
    ))
    .add('ResetBanner', () => (
      <Box>
        <Banner
          path={Types.stringToPath('/keybase/private/me,reset1,reset2,reset3')}
          shouldShowReset={true}
        />
        <Box style={{height: 8}} />
        <Banner path={Types.stringToPath('/keybase/private/me,reset')} shouldShowReset={true} />
      </Box>
    ))
}

export default () => [load, commonStories, rowStories, footerStories].forEach(l => l())
