// @flow
import * as I from 'immutable'
import React from 'react'
import {isMobile} from '../../constants/platform'
import * as Sb from '../../stories/storybook'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/fs'
import * as Kb from '../../common-adapters'
import PathItemAction from './path-item-action'
import PathItemIcon, {type Size} from './path-item-icon'
import PathItemInfo from './path-item-info'
import TlfInfo from './tlf-info'
import Loading from './loading'
import Errs from './errs'
import {type OwnProps as PathItemIconOwnProps} from './path-item-icon-container'
import {type OwnProps as PathItemInfoOwnProps} from './path-item-info-container'

const PathItemActionMenuHeaderProps = (props: any) => ({
  childrenFiles: 0,
  childrenFolders: 0,
  loadFolderList: Sb.action('loadFolderList'),
  loadMimeType: Sb.action('loadMimeType'),
  path: props.path,
  size: 0,
  type: 'folder',
})

const pathItemActionProps = (props: any) => ({
  ...props,
  init: Sb.action('init'),
  onHidden: Sb.action('onHidden'),
})

const pathItemActionChooseViewProps = (props: any) => ({
  ...props,
  view: 'root',
})

const PathItemActionMenuProps = (props: any) => ({
  ...props,
  copyPath: Sb.action('copyPath'),
  deleteFileOrFolder: Sb.action('deleteFileOrFolder'),
  download: Sb.action('download'),
  ignoreFolder: Sb.action('ignoreFolder'),
  onHidden: Sb.action('onHidden'),
  ...(isMobile
    ? {
        saveMedia: Sb.action('saveMedia'),
        shareNative: Sb.action('shareNative'),
      }
    : {}),
  showInSystemFileManager: Sb.action('showInSystemFileManager'),
})

export const commonProvider = {
  ConnectedErrs: () => ({
    errs: [],
  }),
  PathItemAction: pathItemActionProps,
  PathItemActionChooseView: pathItemActionChooseViewProps,
  PathItemActionMenu: PathItemActionMenuProps,
  PathItemActionMenuHeader: PathItemActionMenuHeaderProps,
  PathItemIcon: (ownProps: PathItemIconOwnProps) => ({
    ...ownProps,
    type: Types.getPathElements(ownProps.path).length > 3 ? 'file' : 'folder',
    username: 'songgao_test',
  }),
  PathItemInfo: ({path, mode}: PathItemInfoOwnProps) => ({
    lastModifiedTimestamp: Types.getPathElements(path).length > 3 ? 1545110765 : undefined,
    lastWriter: 'songgao_test',
    mode,
  }),
  SendInAppAction: () => ({onClick: Sb.action('onClick')}),
  TlfInfo: ({path, mode}: PathItemInfoOwnProps) => ({
    mode,
    reset: ['foo', 'bar', 'cue'],
  }),
}

export const provider = Sb.createPropProviderWithCommon(commonProvider)

const pathItemActionCommonProps = {
  clickable: {type: 'icon'},
  init: Sb.action('init'),
  onHidden: Sb.action('onHidden'),
}

const load = () => {
  Sb.storiesOf('Files', module)
    .addDecorator(provider)
    .add('PathItemAction', () => (
      <Kb.Box2
        direction="vertical"
        gap="medium"
        gapStart={true}
        style={{paddingLeft: Styles.globalMargins.medium}}
      >
        <PathItemAction
          path={Types.stringToPath('/keybase/private/meatball/folder/treat')}
          routePath={I.List()}
          {...pathItemActionCommonProps}
        />
        <PathItemAction
          path={Types.stringToPath(
            '/keybase/private/meatball/treat treat treat treat treat treat treat treat treat treat treat treat treat treat treat treat'
          )}
          routePath={I.List()}
          {...pathItemActionCommonProps}
        />
        <PathItemAction
          path={Types.stringToPath(
            '/keybaes/private/meatball/foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar'
          )}
          routePath={I.List()}
          {...pathItemActionCommonProps}
        />
      </Kb.Box2>
    ))
  Sb.storiesOf('Files', module)
    .addDecorator(provider)
    .add('Errs', () => (
      <Errs
        errs={[
          {
            dismiss: Sb.action('dismiss'),
            error: 'long error detail blah blah SimpleFS.SimpleFSCopyRecursive has blown up',
            key: '1',
            msg: 'Error when downloading file blah 1.jpg',
            time: 1534362428795,
          },
          {
            dismiss: Sb.action('dismiss'),
            error: 'long error detail blah blah SimpleFS.SimpleFSCopyRecursive has blown up',
            key: '2',
            msg: 'Error when downloading file blah 2.jpg',
            retry: Sb.action('retry'),
            time: 1534362428795,
          },
          {
            dismiss: Sb.action('dismiss'),
            error: 'long error detail blah blah SimpleFS.SimpleFSCopyRecursive has blown up',
            key: '3',
            msg: 'Error when downloading file blah 99.jpg',
            onFeedback: Sb.action('onFeedback'),
            retry: Sb.action('retry'),
            time: 1534362428795,
          },
        ]}
      />
    ))
    .add('Loading', () => <Loading path={Types.stringToPath('/keybase/team/kbkbfstest')} />)
    .add('TlfInfo', () => (
      <Kb.Box2 direction="vertical" gap="small" gapStart={true} fullWidth={true}>
        <Kb.Text type="Body">mode=default reset=false</Kb.Text>
        <TlfInfo mode="default" reset={false} />
        <Kb.Text type="Body">mode=default reset=true</Kb.Text>
        <TlfInfo mode="default" reset={true} />
        <Kb.Text type="Body">mode=row reset=Array(1)</Kb.Text>
        <TlfInfo mode="row" reset={['foo']} />
        <Kb.Text type="Body">mode=default reset=Array(2)</Kb.Text>
        <TlfInfo mode="default" reset={['foo', 'bar']} />
        <Kb.Text type="Body">mode=row reset=Array(3)</Kb.Text>
        <TlfInfo mode="row" reset={['foo', 'bar', 'cue']} />
      </Kb.Box2>
    ))
    .add('PathItemInfo', () => (
      <Kb.Box2 direction="vertical" gap="small" gapStart={true} fullWidth={true}>
        <Kb.Text type="Body">mode=default</Kb.Text>
        <PathItemInfo mode="default" lastModifiedTimestamp={1545110765} lastWriter="songgao_test" />
        <Kb.Text type="Body">mode=row</Kb.Text>
        <PathItemInfo mode="row" lastModifiedTimestamp={1545110765} lastWriter="songgao_test" />
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
