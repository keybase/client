// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import BreadcrumbPopup from './breadcrumb-popup.desktop'

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
              {// We are splitting on ',' here, so it won't work for
              // long names that don't have comma. If this becomes a
              // problem, we might have to do smarter splitting that
              // involve other characters, or just break the long name
              // apart into 3-character groups.
              item.name.split(',').map((sub, idx, {length}) => (
                <Kb.Text key={idx} type={'BodyBig'} style={styles.lastNameText}>
                  {sub}
                  {idx !== length - 1 ? ',' : ''}
                </Kb.Text>
              ))}
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
  container: {
    ...Styles.globalStyles.flexBoxRow,
    left: 0,
    right: 0,
    flexGrow: 1,
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
  },
  folderBreadcrumb: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    paddingLeft: 0,
    paddingRight: 0,
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  teamAvatar: {
    marginRight: Styles.globalMargins.xtiny,
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
  breadcrumbLastItemBox: {
    display: 'flex',
    flexWrap: 'wrap',
  },
  lastNameText: Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-word',
    },
  }),
})

export default Breadcrumb
