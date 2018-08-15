// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Styles from '../../styles'
import {
  Avatar,
  avatarCastPlatformStyles,
  Box,
  Icon,
  Text,
  iconCastPlatformStyles,
} from '../../common-adapters'
import BreadcrumbPopup from './breadcrumb-popup.desktop'

type Props = {
  dropdownItems?: Array<Types.PathBreadcrumbItem>,
  shownItems: Array<Types.PathBreadcrumbItem>,
}

const Breadcrumb = ({dropdownItems, shownItems}: Props) => (
  <Box style={styles.container}>
    {!!dropdownItems && (
      <Box style={styles.folderBreadcrumb}>
        <BreadcrumbPopup items={dropdownItems} />
        <Icon
          type="iconfont-arrow-right"
          style={iconCastPlatformStyles(styles.icon)}
          fontSize={11}
          boxStyle={styles.iconBox}
        />
      </Box>
    )}
    {shownItems.map((item, idxItem) => (
      <React.Fragment key={Types.pathToString(item.path)}>
        {item.isTeamTlf && (
          <Avatar
            size={16}
            teamname={item.name}
            isTeam={true}
            style={avatarCastPlatformStyles(styles.teamAvatar)}
          />
        )}
        {!item.isLastItem ? (
          <Box style={styles.breadcrumbNonLastItemBox}>
            <Text key={idxItem} onClick={item.onClick} type="BodySmallSemibold">
              {item.name}
            </Text>
          </Box>
        ) : (
          <Box style={styles.breadcrumbLastItemBox}>
            <Text type="BodyBig" selectable={true}>
              {// We are splitting on ',' here, so it won't work for
              // long names that don't have comma. If this becomes a
              // problem, we might have to do smarter splitting that
              // involve other characters, or just break the long name
              // apart into 3-character groups.
              item.name.split(',').map((sub, idx, {length}) => (
                <Text key={idx} type={'BodyBig'} style={styles.lastNameText}>
                  {sub}
                  {idx !== length - 1 ? ',' : ''}
                </Text>
              ))}
            </Text>
          </Box>
        )}
        {!item.isLastItem && (
          <Icon
            type="iconfont-arrow-right"
            style={iconCastPlatformStyles(styles.icon)}
            fontSize={11}
            boxStyle={styles.iconBox}
          />
        )}
      </React.Fragment>
    ))}
  </Box>
)

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.flexBoxRow,
      left: 0,
      right: 0,
      flexGrow: 1,
      alignItems: 'center',
      paddingLeft: 16,
      paddingRight: 16,
      height: 24,
    },
  }),
  folderBreadcrumb: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      paddingLeft: 0,
      paddingRight: 0,
      flexShrink: 0,
      flexWrap: 'wrap',
    },
  }),
  teamAvatar: {
    marginRight: Styles.globalMargins.xtiny,
  },
  icon: {
    marginLeft: Styles.globalMargins.xtiny,
    marginRight: Styles.globalMargins.xtiny,
  },
  iconBox: {
    height: 24,
  },
  breadcrumbNonLastItemBox: Styles.platformStyles({
    isElectron: {
      maxWidth: 120,
      flexShrink: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      color: Styles.globalColors.black_60,
      whiteSpace: 'nowrap',
    },
  }),
  breadcrumbLastItemBox: Styles.platformStyles({
    isElectron: {
      display: 'flex',
      flexWrap: 'wrap',
    },
  }),
  lastNameText: Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-word',
    },
  }),
})

export default Breadcrumb
