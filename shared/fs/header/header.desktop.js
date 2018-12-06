// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/fs'
import {Box, Icon, Text, WithTooltip} from '../../common-adapters'
import AddNew from './add-new-container'
import ConnectedFilesBanner from '../banner/fileui-banner/container'
import Breadcrumb from './breadcrumb-container.desktop'
import {type FolderHeaderProps} from './header'
import {PathItemAction, OpenInSystemFileManager} from '../common'

const FolderHeader = ({path, onChat, routePath}: FolderHeaderProps) => (
  <Box style={styles.headerContainer}>
    <Box style={styles.folderHeader}>
      {Types.pathToString(path) === '/keybase' ? (
        <Box style={styles.folderHeaderContainer}>
          <Box style={styles.folderHeaderRoot}>
            <Text type="BodyBig">Keybase Files</Text>
          </Box>
          <Box style={styles.folderHeaderEnd}>
            <WithTooltip text="Show in Finder">
              <OpenInSystemFileManager path={path} />
            </WithTooltip>
          </Box>
        </Box>
      ) : (
        <Box style={styles.folderHeaderContainer}>
          <Breadcrumb path={path} routePath={routePath} />
          <Box style={styles.folderHeaderEnd}>
            <AddNew path={path} style={styles.addNew} />
            <WithTooltip text="Show in Finder">
              <OpenInSystemFileManager path={path} />
            </WithTooltip>
            {onChat && (
              <Box style={styles.headerIcon}>
                <Icon
                  type="iconfont-chat"
                  color={Styles.globalColors.black_40}
                  fontSize={16}
                  onClick={onChat}
                />
              </Box>
            )}
            <Box style={styles.headerIcon}>
              <PathItemAction path={path} actionIconClassName="fs-path-item-hover-icon" />
            </Box>
          </Box>
        </Box>
      )}
    </Box>
    <ConnectedFilesBanner path={path} />
  </Box>
)

const styleCommonRow = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
}

const styles = Styles.styleSheetCreate({
  addNew: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small - 4,
    paddingTop: Styles.globalMargins.tiny,
  },
  folderHeader: {
    minHeight: 48,
  },
  folderHeaderContainer: {
    ...styleCommonRow,
    alignItems: 'center',
    height: 48,
    position: 'relative',
    width: '100%',
  },
  folderHeaderEnd: {
    ...styleCommonRow,
    alignItems: 'center',
    flexShrink: 0,
    paddingLeft: 16,
    paddingRight: 16,
  },
  folderHeaderRoot: {
    ...styleCommonRow,
    height: 48,
    justifyContent: 'center',
    width: '100%',
  },
  headerContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    width: '100%',
  },
  headerIcon: {
    marginLeft: Styles.globalMargins.tiny,
  },
})

export default FolderHeader
