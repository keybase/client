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
        <Text type="BodySmall" style={styles.stylesTitle}>
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
  stylesAddNewBox: {
    minWidth: 50,
  },
  stylesFolderHeaderContainer: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'flex-start',
    minHeight: 64,
  },
  stylesFolderHeaderRoot: {
    flexGrow: 1,
    flexShrink: 1,
    paddingTop: 14,
  },
  stylesFolderHeaderRow: {
    ...globalStyles.flexBoxRow,
    alignItems: 'flex-start',
    minHeight: 64,
    paddingTop: 12,
  },
  stylesIcons: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    padding: globalMargins.tiny,
    paddingLeft: globalMargins.small,
    paddingRight: globalMargins.small - 4,
  },
  stylesTitle: {
    ...globalStyles.fontSemibold,
    color: globalColors.black_75,
    textAlign: 'center',
  },
})
export default Header
