// @flow
import React from 'react'
import * as Constants from '../../constants/fs'
import {isMobile} from '../../constants/platform'
import * as Sb from '../../stories/storybook'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/fs'
import {Box, OverlayParentHOC} from '../../common-adapters'
import PathItemAction from './path-item-action'
import Loading from './loading'

const pathItemActionPopupProps = (path: Types.Path) => {
  const pathElements = Types.getPathElements(path)
  return {
    childrenFiles: 0,
    childrenFolders: 0,
    copyPath: Sb.action('copyPath'),
    download: Sb.action('download'),
    ignoreFolder: Sb.action('ignoreFolder'),
    itemStyles: Constants.getItemStyles(pathElements, 'folder', 'meatball'),
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
  SendInAppAction: () => ({onClick: Sb.action('onClick')}),
}

export const provider = Sb.createPropProviderWithCommon(commonProvider)

const FloatingPathItemAction = OverlayParentHOC(PathItemAction)

const load = () =>
  Sb.storiesOf('Files', module)
    .addDecorator(provider)
    .add('PathItemAction', () => (
      <Box style={{padding: Styles.globalMargins.small}}>
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
      </Box>
    ))
    .add('Loading', () => <Loading path={Types.stringToPath('/keybase/team/kbkbfstest')} />)

export default load
