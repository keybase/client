// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/fs'
import * as Kb from '../../common-adapters'
import AddNew from './add-new-container'
import ConnectedFilesBanner from '../banner/fileui-banner/container'
import Breadcrumb from './breadcrumb-container.desktop'
import {type FolderHeaderProps} from './header'
import {OpenInSystemFileManager, PathItemAction, SendInAppAction} from '../common'

const FolderHeader = ({path, onChat, routePath}: FolderHeaderProps) => (
  <Kb.Box style={styles.headerContainer}>
    <Kb.Box style={styles.folderHeader}>
      {Types.pathToString(path) === '/keybase' ? (
        <Kb.Box style={styles.folderHeaderContainer}>
          <Kb.Box style={styles.folderHeaderRoot}>
            <Kb.Text type="BodyBig">Keybase Files</Kb.Text>
          </Kb.Box>
          <Kb.Box style={styles.folderHeaderEnd}>
            <Kb.WithTooltip text="Show in Finder">
              <OpenInSystemFileManager path={path} />
            </Kb.WithTooltip>
          </Kb.Box>
        </Kb.Box>
      ) : (
        <Kb.Box style={styles.folderHeaderContainer}>
          <Breadcrumb path={path} routePath={routePath} />
          <Kb.Box style={styles.folderHeaderEnd}>
            <AddNew path={path} style={styles.addNew} />
            <Kb.WithTooltip text="Show in Finder">
              <OpenInSystemFileManager path={path} />
            </Kb.WithTooltip>
            {onChat && (
              <Kb.Icon
                type="iconfont-chat"
                color={Styles.globalColors.black_50}
                fontSize={16}
                onClick={onChat}
                style={styles.headerIcon}
              />
            )}
            <SendInAppAction path={path} sendIconClassName="" />
            <PathItemAction
              path={path}
              clickable={{actionIconClassName: '', type: 'icon'}}
              routePath={routePath}
              initView="root"
            />
          </Kb.Box>
        </Kb.Box>
      )}
    </Kb.Box>
    <ConnectedFilesBanner path={path} />
  </Kb.Box>
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
    padding: Styles.globalMargins.tiny,
  },
})

export default FolderHeader
