// @flow
import React from 'react'
import {isMobile} from '../../constants/platform'
import * as Sb from '../../stories/storybook'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/fs'
import * as Kb from '../../common-adapters'
import PathItemAction from './path-item-action'
import PathItemIcon, {type Size} from './path-item-icon'
import PathItemInfo from './path-item-info'
import Loading from './loading'
import {type OwnProps as PathItemIconOwnProps} from './path-item-icon-container'
import {type OwnProps as PathItemInfoOwnProps} from './path-item-info-container'

const pathItemActionPopupProps = (path: Types.Path) => {
  const pathElements = Types.getPathElements(path)
  return {
    childrenFiles: 0,
    childrenFolders: 0,
    copyPath: Sb.action('copyPath'),
    download: Sb.action('download'),
    ignoreFolder: Sb.action('ignoreFolder'),
    lastModifiedTimestamp: 0,
    lastWriter: 'meatball',
    name: Types.getPathNameFromElems(pathElements),
    onHidden: Sb.action('onHidden'),
    ...(isMobile
      ? {
          saveMedia: Sb.action('saveMedia'),
          shareNative: Sb.action('shareNative'),
        }
      : {}),
    path,
    pathElements,
    showInSystemFileManager: Sb.action('showInSystemFileManager'),
    size: 0,
    type: 'folder',
  }
}

export const commonProvider = {
  ConnectedDownloadTrackingHoc: () => ({
    downloading: false,
  }),
  ConnectedPathItemAction: () => pathItemActionPopupProps(Types.stringToPath('/keybase/private/meatball')),
  PathItemIcon: (ownProps: PathItemIconOwnProps) => ({
    ...ownProps,
    type: Types.getPathElements(ownProps.path).length > 3 ? 'file' : 'folder',
    username: 'songgao_test',
  }),
  PathItemInfo: ({path, startWithLastModified, wrap}: PathItemInfoOwnProps) => ({
    lastModifiedTimestamp: Types.getPathElements(path).length > 3 ? 1545110765 : undefined,
    lastWriter: 'songgao_test',
    startWithLastModified,
    wrap,
  }),
  SendInAppAction: () => ({onClick: Sb.action('onClick')}),
}

export const provider = Sb.createPropProviderWithCommon(commonProvider)

const FloatingPathItemAction = Kb.OverlayParentHOC(PathItemAction)

const load = () => {
  Sb.storiesOf('Files', module)
    .addDecorator(provider)
    .add('PathItemAction', () => (
      <Kb.Box style={{padding: Styles.globalMargins.small}}>
        <FloatingPathItemAction
          {...pathItemActionPopupProps(Types.stringToPath('/keybase/private/meatball/folder/treat'))}
        />
        <FloatingPathItemAction
          {...pathItemActionPopupProps(
            Types.stringToPath(
              '/keybase/private/meatball/treat treat treat treat treat treat treat treat treat treat treat treat treat treat treat treat'
            )
          )}
        />
        <FloatingPathItemAction
          {...pathItemActionPopupProps(
            Types.stringToPath(
              '/keybaes/private/meatball/foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar'
            )
          )}
        />
      </Kb.Box>
    ))
    .add('Loading', () => <Loading path={Types.stringToPath('/keybase/team/kbkbfstest')} />)
    .add('PathItemInfo', () => (
      <Kb.Box2 direction="vertical" gap="small" gapStart={true}>
        <PathItemInfo lastModifiedTimestamp={1545110765} lastWriter="songgao_test" />
        <PathItemInfo
          lastModifiedTimestamp={1545110765}
          lastWriter="songgao_test"
          startWithLastModified={true}
        />
        <PathItemInfo resetParticipants={['foo']} />
        <PathItemInfo resetParticipants={['foo', 'bar']} />
        <PathItemInfo resetParticipants={['foo', 'bar', 'cue']} />
        <PathItemInfo resetParticipants={['foo', 'bar']} isUserReset={true} />
      </Kb.Box2>
    ))

  Sb.storiesOf('Files/PathItemIcon', module)
    .add('tlf list', () => (
      <Kb.Box2 direction="vertical" gap="small" gapStart={true}>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">private</Kb.Text>
          {pathItemIconSizes.map(size => (
            <PathItemIcon
              key={size.toString()}
              path={Types.stringToPath('/keybase/private')}
              size={size}
              type="folder"
              username=""
            />
          ))}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">public</Kb.Text>
          {pathItemIconSizes.map(size => (
            <PathItemIcon
              key={size.toString()}
              path={Types.stringToPath('/keybase/public')}
              size={size}
              type="file"
              username=""
            />
          ))}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">team</Kb.Text>
          {pathItemIconSizes.map(size => (
            <PathItemIcon
              key={size.toString()}
              path={Types.stringToPath('/keybase/team')}
              size={size}
              type="folder"
              username=""
            />
          ))}
        </Kb.Box2>
      </Kb.Box2>
    ))
    .add('team', () => (
      <Kb.Box2 direction="vertical" gap="small" gapStart={true}>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">team tlf</Kb.Text>
          {pathItemIconSizes.map(size => (
            <PathItemIcon
              key={size.toString()}
              path={Types.stringToPath('/keybase/team/kbkbfstest')}
              size={size}
              type="folder"
              username=""
            />
          ))}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">team folder</Kb.Text>
          {pathItemIconSizes.map(size => (
            <PathItemIcon
              key={size.toString()}
              path={Types.stringToPath('/keybase/team/kbkbfstest/foo')}
              size={size}
              type="folder"
              username=""
            />
          ))}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">team file</Kb.Text>
          {pathItemIconSizes.map(size => (
            <PathItemIcon
              key={size.toString()}
              path={Types.stringToPath('/keybase/team/kbkbfstest/foo')}
              size={size}
              type="file"
              username=""
            />
          ))}
        </Kb.Box2>
      </Kb.Box2>
    ))
    .add('private', () => (
      <Kb.Box2 direction="vertical" gap="small" gapStart={true}>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">private tlf</Kb.Text>
          {pathItemIconSizes.map(size => (
            <PathItemIcon
              key={size.toString()}
              path={Types.stringToPath('/keybase/private/foo,bar')}
              size={size}
              type="folder"
              username=""
            />
          ))}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">private folder</Kb.Text>
          {pathItemIconSizes.map(size => (
            <PathItemIcon
              key={size.toString()}
              path={Types.stringToPath('/keybase/private/foo,bar/foo')}
              size={size}
              type="folder"
              username=""
            />
          ))}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">private file</Kb.Text>
          {pathItemIconSizes.map(size => (
            <PathItemIcon
              key={size.toString()}
              path={Types.stringToPath('/keybase/private/foo,bar/foo')}
              size={size}
              type="file"
              username=""
            />
          ))}
        </Kb.Box2>
      </Kb.Box2>
    ))
    .add('public', () => (
      <Kb.Box2 direction="vertical" gap="small" gapStart={true}>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">public tlf</Kb.Text>
          {pathItemIconSizes.map(size => (
            <PathItemIcon
              key={size.toString()}
              path={Types.stringToPath('/keybase/public/foo,bar')}
              size={size}
              type="folder"
              username=""
            />
          ))}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">public folder</Kb.Text>
          {pathItemIconSizes.map(size => (
            <PathItemIcon
              key={size.toString()}
              path={Types.stringToPath('/keybase/public/foo,bar/foo')}
              size={size}
              type="folder"
              username=""
            />
          ))}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">public file</Kb.Text>
          {pathItemIconSizes.map(size => (
            <PathItemIcon
              key={size.toString()}
              path={Types.stringToPath('/keybase/public/foo,bar/foo')}
              size={size}
              type="file"
              username=""
            />
          ))}
        </Kb.Box2>
      </Kb.Box2>
    ))
  ;[32, 48].forEach(size =>
    Sb.storiesOf('Files/PathItemIcon', module).add(`badged - ${size}`, () => (
      <Kb.Box2 direction="vertical" gap="large" gapStart={true}>
        {['new', 'rekey'].map(badge => (
          <Kb.Box2 key={badge} direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
            <Kb.Text type="Header">{badge}</Kb.Text>
            <PathItemIcon
              path={Types.stringToPath('/keybase/private/foo,bar')}
              size={size}
              type="folder"
              username=""
              badge={badge}
            />
          </Kb.Box2>
        ))}
        {['upload', 'download'].map(badge => (
          <>
            <Kb.Box2 key="file" direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
              <Kb.Text type="Header">{badge} - file</Kb.Text>
              <PathItemIcon
                path={Types.stringToPath('/keybase/team/kbkbfstest/foo')}
                size={size}
                type="file"
                username=""
                badge={badge}
              />
            </Kb.Box2>
            <Kb.Box2 key="folder" direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
              <Kb.Text type="Header">{badge} - folder</Kb.Text>
              <PathItemIcon
                path={Types.stringToPath('/keybase/team/kbkbfstest/foo')}
                size={size}
                type="folder"
                username=""
                badge={badge}
              />
            </Kb.Box2>
          </>
        ))}
        {[1, 10, 100].map(badge => (
          <Kb.Box2
            key={badge.toString()}
            direction="horizontal"
            gap="small"
            gapStart={true}
            centerChildren={true}
          >
            <Kb.Text type="Header">{badge}</Kb.Text>
            <PathItemIcon
              path={Types.stringToPath('/keybase/private/foo,bar')}
              size={size}
              type="folder"
              username=""
              badge={badge}
            />
          </Kb.Box2>
        ))}
      </Kb.Box2>
    ))
  )
}

const pathItemIconSizes: Array<Size> = [12, 16, 32, 48, 64]

export default load
