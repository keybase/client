// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/fs'
import * as Kb from '../../common-adapters'
import AddNew from './add-new-container'
import Breadcrumb from './breadcrumb-container.desktop'
import {type FolderHeaderProps} from './header'
import {FolderViewFilter, OpenInSystemFileManager, PathItemAction, SendInAppAction} from '../common'

const FolderHeader = ({path, onChat, routePath}: FolderHeaderProps) => (
  <Kb.Box style={styles.headerContainer}>
    <Kb.Box style={styles.folderHeader}>
      {Types.pathToString(path) === '/keybase' ? (
        <Kb.Box style={styles.folderHeaderContainer}>
          <Kb.Box style={styles.folderHeaderRoot}>
            <Kb.Text type="BodyBig">Keybase Files</Kb.Text>
          </Kb.Box>
          <Kb.Box style={styles.folderHeaderEnd}>
            <OpenInSystemFileManager path={path} />
          </Kb.Box>
        </Kb.Box>
      ) : (
        <Kb.Box style={styles.folderHeaderContainer}>
          <Breadcrumb path={path} routePath={routePath} />
          <Kb.Box style={styles.folderHeaderEnd}>
            <FolderViewFilter path={path} gap="tiny" />
            <AddNew path={path} />
            <OpenInSystemFileManager path={path} />
            {onChat && (
              <Kb.WithTooltip text="Chat with users in this folder">
                <Kb.Icon
                  type="iconfont-chat"
                  color={Styles.globalColors.black_50}
                  fontSize={16}
                  onClick={onChat}
                  padding="tiny"
                />
              </Kb.WithTooltip>
            )}
            <SendInAppAction path={path} sendIconClassName="" />
            <PathItemAction path={path} clickable={{type: 'icon'}} routePath={routePath} initView="root" />
          </Kb.Box>
        </Kb.Box>
      )}
    </Kb.Box>
  </Kb.Box>
)

const styleCommonRow = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
}

const styles = Styles.styleSheetCreate({
  folderHeader: {
    minHeight: 48,
  },
  folderHeaderContainer: {
    ...styleCommonRow,
    alignItems: 'center',
    minHeight: 48, // breadcrumb can expand vertically if name is long
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
})

export default FolderHeader
