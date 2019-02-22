// @flow
import * as I from 'immutable'
import React from 'react'
import * as Types from '../../constants/types/fs'
import * as Sb from '../../stories/storybook'
import Breadcrumb from '../header/breadcrumb.desktop'
import Header from './header'
import AddNew from './add-new'
import {makeBreadcrumbProps} from '../header/breadcrumb-container.desktop'
import {commonProvider} from '../common/index.stories'
import {bannerProvider} from '../banner/index.stories'

const folderHeaderCommon = {
  onBack: Sb.action('onBack'),
  onChat: Sb.action('onChat'),
  routePath: I.List<string>([]),
}

export const headerProvider = {
  ConnectedAddNew: () => ({
    pathElements: [],
  }),
  ConnectedBreadcrumb: ({path}: {path: Types.Path}) =>
    makeBreadcrumbProps('meatball', path => Sb.action(`navigate to ${Types.pathToString(path)}`), path),
  FolderHeader: () => ({
    ...folderHeaderCommon,
    path: Types.stringToPath('/keybase/team/kbkbfstest/hi'),
    title: 'hi',
  }),
}

const provider = Sb.createPropProviderWithCommon({
  ...commonProvider,
  ...bannerProvider,
  ...headerProvider,
})

const breadcrumbProps = (names: Array<string>) => {
  const items = names.map((name, idx) => ({
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

export default () => {
  Sb.storiesOf('Files/Headers', module)
    .addDecorator(provider)
    .add('Breadcrumbs - in tlf', () => (
      <Breadcrumb {...breadcrumbProps(['keybase', 'private', 'foo', 'bar'])} />
    ))
    .add('Breadcrumbs - tlf', () => <Breadcrumb {...breadcrumbProps(['keybase', 'private', 'foo'])} />)
    .add('Breadcrumbs - long last w/ space', () => (
      <Breadcrumb
        {...breadcrumbProps([
          'keybase',
          'private',
          'foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo',
        ])}
      />
    ))
    .add('Breadcrumbs - long last w/o space', () => (
      <Breadcrumb
        {...breadcrumbProps([
          'keybase',
          'private',
          'foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar',
        ])}
      />
    ))
    .add('Breadcrumbs - long middle w/ space', () => (
      <Breadcrumb
        {...breadcrumbProps([
          'keybase',
          'private',
          'foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo',
          'haha',
        ])}
      />
    ))
    .add('Breadcrumbs - long middle w/o space', () => (
      <Breadcrumb
        {...breadcrumbProps([
          'keybase',
          'private',
          'foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar',
          'haha',
        ])}
      />
    ))
    .add('Header', () => (
      <Header path={Types.stringToPath('/keybase/private/foo,bar/lol')} title="lol" {...folderHeaderCommon} />
    ))
    .add('AddNew - Mobile', () => (
      <AddNew
        pathElements={Types.getPathElements(Types.stringToPath('/keybase/private/foo,bar/lol'))}
        newFolderRow={Sb.action('newFolderRow')}
        pickAndUploadMixed={Sb.action('pickAndUploadMixed')}
      />
    ))
    .add('AddNew - Desktop', () => (
      <AddNew
        pathElements={Types.getPathElements(Types.stringToPath('/keybase/private/foo,bar/lol'))}
        newFolderRow={Sb.action('newFolderRow')}
        openAndUploadBoth={Sb.action('openAndUploadBoth')}
      />
    ))
}
