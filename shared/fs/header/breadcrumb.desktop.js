// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import BreadcrumbPopup from './breadcrumb-popup.desktop'
import CommaSeparatedName from '../common/comma-separated-name'

export type Props = {
  dropdownItems?: Array<Types.PathBreadcrumbItem>,
  shownItems: Array<Types.PathBreadcrumbItem>,
}

const Breadcrumb = ({dropdownItems, shownItems}: Props) => (
  <Kb.Box style={styles.container}>
    {!!dropdownItems && (
      <Kb.Box style={styles.folderBreadcrumb}>
        <BreadcrumbPopup items={dropdownItems} />
        <Kb.Icon type="iconfont-arrow-right" style={Kb.iconCastPlatformStyles(styles.icon)} fontSize={11} />
      </Kb.Box>
    )}
    {shownItems.map((item, idxItem) => (
      <React.Fragment key={Types.pathToString(item.path)}>
        {item.isTeamTlf && (
          <Kb.Avatar
            size={16}
            teamname={item.name}
            isTeam={true}
            style={Kb.avatarCastPlatformStyles(styles.teamAvatar)}
          />
        )}
        {!item.isLastItem ? (
          <Kb.Box style={styles.breadcrumbNonLastItemBox}>
            <Kb.Text key={idxItem} onClick={item.onClick} type="BodySmallSemibold">
              {item.name}
            </Kb.Text>
          </Kb.Box>
        ) : (
          <Kb.Box style={styles.breadcrumbLastItemBox}>
            <Kb.Text type="BodyBig" selectable={true}>
              <CommaSeparatedName type="BodyBig" name={item.name} elementStyle={styles.lastNameText} />
            </Kb.Text>
          </Kb.Box>
        )}
        {!item.isLastItem && (
          <Kb.Icon type="iconfont-arrow-right" style={Kb.iconCastPlatformStyles(styles.icon)} fontSize={11} />
        )}
      </React.Fragment>
    ))}
  </Kb.Box>
)

const styles = Styles.styleSheetCreate({
  breadcrumbLastItemBox: {
    display: 'flex',
    flexWrap: 'wrap',
  },
  breadcrumbNonLastItemBox: Styles.platformStyles({
    isElectron: {
      color: Styles.globalColors.black_50,
      flexShrink: 0,
      maxWidth: 120,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  }),
  container: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    flexGrow: 1,
    left: 0,
    paddingLeft: 16,
    paddingRight: 16,
    right: 0,
  },
  folderBreadcrumb: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    flexShrink: 0,
    flexWrap: 'wrap',
    paddingLeft: 0,
    paddingRight: 0,
  },
  icon: Styles.platformStyles({
    common: {
      marginLeft: Styles.globalMargins.xtiny,
      marginRight: Styles.globalMargins.xtiny,
    },
    isElectron: {
      verticalAlign: 'bottom',
    },
  }),
  lastNameText: Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-word',
    },
  }),
  teamAvatar: {
    marginRight: Styles.globalMargins.xtiny,
  },
})

export default Breadcrumb
