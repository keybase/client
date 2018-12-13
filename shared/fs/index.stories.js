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
import {makeBreadcrumbProps} from './header/breadcrumb-container.desktop'
import Banner from './banner'
import rowStories, {rowsProvider} from './row/index.stories'
import commonStories, {commonProvider} from './common/index.stories'
import footerStories, {footerProvider} from './footer/index.stories'
import sendLinkToChatStories from './send-link-to-chat/index.stories'
import destinationPickerStories from './destination-picker/index.stories'

const provider = Sb.createPropProviderWithCommon({
  ...rowsProvider,
  ...commonProvider,
  ...footerProvider,
  Banner: ({path}: {path: Types.Path}) => ({
    path,
    shouldShowReset: Types.pathToString(path).includes('reset'),
  }),
  ConnectedAddNew: () => ({
    menuItems: [],
    pathElements: [],
    style: {},
  }),
  ConnectedBreadcrumb: ({path}) =>
    makeBreadcrumbProps('meatball', path => Sb.action(`navigate to ${Types.pathToString(path)}`), path),
  FilePreviewDefaultView: () => ({
    fileUIEnabled: false,
    itemStyles: Constants.getItemStyles(['keybase', 'private', 'foo', 'bar.jpg'], 'file', 'foo'),
    onDownload: () => {},
    onSave: () => {},
    onShare: () => {},
    onShowInSystemFileManager: () => {},
    pathItem: Constants.makeFile({
      lastWriter: {uid: '', username: 'foo'},
      name: 'bar.jpg',
      size: 10240,
    }),
  }),
  FilePreviewHeader: () => ({
    loadFilePreview: () => {},
    onAction: () => {},
    onBack: () => {},
    onShowInSystemFileManager: () => {},
    path: '/keybase/private/foo/bar.jpg',
    pathItem: Constants.makeFile({
      lastWriter: {uid: '', username: 'foo'},
      name: 'bar.jpg',
      size: 10240,
    }),
  }),
  FilesBanner: () => ({
    getFuseStatus: Sb.action('getFuseStatus'),
    inProgress: false,
    kbfsEnabled: true,
    onDismiss: Sb.action('onDismiss'),
    onInstall: Sb.action('onInstall'),
    onUninstall: Sb.action('onUninstall'),
    path: Types.stringToPath('/keybase'),
    showBanner: false,
    showSecurityPrefs: false,
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
    onBack: Sb.action('onBack'),
    onOpenBreadcrumb: Sb.action('onOpenBreadcrumb'),
    onOpenBreadcrumbDropdown: Sb.action('onOpenBreadcrumbDropdown'),
    path: Types.stringToPath('/keybase'),
  }),
  ResetBanner: ({path}: {path: Types.Path}) => ({
    isUserReset: Types.pathToString(path) === '/keybase/private/me,reset',
    onReAddToTeam: () => () => undefined,
    onViewProfile: () => () => undefined,
    resetParticipants: ['reset1', 'reset2', 'reset3'],
  }),
  SortBar: ({path}: {path: Types.Path}) => ({
    folderIsPending: true,
    sortSetting: {
      sortBy: 'name',
      sortOrder: 'asc',
    },
    sortSettingToAction: sortSetting => Sb.action(`sortSettingToAction${sortSetting}`),
  }),
  ViewContainer: () => ({
    isSymlink: false,
    loadMimeType: Sb.action('loadMimeType'),
    mimeType: Constants.makeMime({mimeType: 'image/jpeg'}),
    onInvalidToken: Sb.action('onInvalidToken'),
    path: '/keybase/private/foo/bar.jpg',
    url: '/keybase/private/foo/bar.jpg',
  }),
})

const breadcrumbProps = (names: Array<string>) => {
  const items = names.map((name, idx) => ({
    iconSpec: Constants.getItemStyles(names.slice(0, idx + 1), 'folder', 'foo').iconSpec,
    isLastItem: idx === names.length - 1,
    isTeamTlf: idx === 2 && names[idx - 1] === 'team',
    name: name,
    onClick: Sb.action('onClick'),
    path: Types.stringToPath('/' + names.slice(0, idx + 1).join('/')),
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

export default () =>
  [load, commonStories, rowStories, footerStories, destinationPickerStories, sendLinkToChatStories].forEach(
    l => l()
  )
