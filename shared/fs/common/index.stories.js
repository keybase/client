// @flow
import React from 'react'
import * as Constants from '../../constants/fs'
import {isMobile} from '../../constants/platform'
import * as Sb from '../../stories/storybook'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/fs'
import {Box, OverlayParentHOC} from '../../common-adapters'
import PathItemAction from './path-item-action'

const pathItemActionPopupProps = (path: Types.Path) => {
  const pathElements = Types.getPathElements(path)
  return {
    size: 0,
    type: 'folder',
    lastModifiedTimestamp: 0,
    lastWriter: 'meatball',
    childrenFolders: 0,
    childrenFiles: 0,
    itemStyles: Constants.getItemStyles(pathElements, 'folder', 'meatball'),
    name: Types.getPathNameFromElems(pathElements),
    path,
    pathElements,
    ...(isMobile
      ? {
          saveMedia: Sb.action('saveMedia'),
          shareNative: Sb.action('shareNative'),
        }
      : {}),
    showInSystemFileManager: Sb.action('showInSystemFileManager'),
    ignoreFolder: Sb.action('ignoreFolder'),
    download: Sb.action('download'),
    copyPath: Sb.action('copyPath'),
    onHidden: Sb.action('onHidden'),
  }
}

export const commonProvider = {
  ConnectedPathItemAction: () => pathItemActionPopupProps(Types.stringToPath('/keybase/private/meatball')),
  ConnectedDownloadTrackingHoc: () => ({
    downloading: false,
  }),
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

export default load
