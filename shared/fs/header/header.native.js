// @flow
import * as React from 'react'
import {styleSheetCreate, collapseStyles, globalColors, globalStyles, globalMargins} from '../../styles'
import {BackButton, Box, Icon, Text} from '../../common-adapters'
import AddNew from './add-new-container'
import {type FolderHeaderProps} from './header'

const Header = ({title, path, onBack, onChat}: FolderHeaderProps) => (
  <Box style={styles.stylesFolderHeaderContainer}>
    <Box style={styles.stylesFolderHeaderRow}>
      <BackButton onClick={onBack} />
      <Box style={styles.stylesFolderHeaderRoot}>
        <Text type="HeaderSmall" style={styles.stylesTitle}>
          {title}
        </Text>
      </Box>
      <Box style={styles.stylesAddNewBox}>
        <AddNew path={path} style={styles.stylesIcons} />
      </Box>
      {onChat && (
        <Box style={styles.stylesAddNewBox}>
          <Icon
            type="iconfont-chat"
            style={collapseStyles([styles.stylesIcons])}
            color={globalColors.black_40}
            fontSize={22}
            onClick={onChat}
          />
        </Box>
      )}
    </Box>
  </Box>
)

const styles = styleSheetCreate({
  stylesFolderHeaderRow: {
    ...globalStyles.flexBoxRow,
    alignItems: 'flex-start',
    paddingTop: 12,
    minHeight: 64,
  },
  stylesFolderHeaderContainer: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'flex-start',
    minHeight: 64,
  },
  stylesFolderHeaderRoot: {
    paddingTop: 9,
    paddingBottom: 21,
    flexShrink: 1,
    flexGrow: 1,
  },
  stylesIcons: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    padding: globalMargins.tiny,
    paddingRight: globalMargins.small - 4,
    paddingLeft: globalMargins.small,
  },
  stylesTitle: {
    textAlign: 'center',
  },
  stylesAddNewBox: {
    minWidth: 50,
  },
})
export default Header
