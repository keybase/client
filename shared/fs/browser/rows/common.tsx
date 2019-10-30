import * as Styles from '../../../styles'
import * as Types from '../../../constants/types/fs'
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import {OpenInSystemFileManager, PathItemIcon, PathItemAction, SyncStatus} from '../../common'

export type StillCommonProps = {
  path: Types.Path
  inDestinationPicker?: boolean
  onOpen?: () => void
  showTlfTypeIcon?: boolean
}

export const StillCommon = (
  props: StillCommonProps & {
    badge?: Types.PathItemBadge
    children: React.ReactNode
    writingToJournal: boolean
  }
) => (
  <Kb.ListItem2
    type="Small"
    statusIcon={<SyncStatus path={props.path} />}
    icon={
      <PathItemIcon
        path={props.path}
        size={32}
        style={Styles.collapseStyles([rowStyles.pathItemIcon, props.writingToJournal && rowStyles.opacity30])}
        badge={props.badge}
        showTlfTypeIcon={props.showTlfTypeIcon}
      />
    }
    firstItem={true /* we add divider in Rows */}
    onClick={props.onOpen}
    body={props.children}
    onlyShowActionOnHover="fade"
    action={
      !props.inDestinationPicker &&
      !props.writingToJournal &&
      Types.getPathLevel(props.path) > 2 && (
        <Kb.Box2 direction="horizontal">
          <OpenInSystemFileManager path={props.path} />
          <PathItemAction
            path={props.path}
            clickable={{type: 'icon'}}
            initView={Types.PathItemActionMenuView.Root}
            mode="row"
          />
        </Kb.Box2>
      )
    }
  />
)

export const rowStyles = Styles.styleSheetCreate(
  () =>
    ({
      itemBox: {
        ...Styles.globalStyles.flexBoxColumn,
        flex: 1,
        justifyContent: 'center',
        minWidth: 0,
        width: 0,
      },
      opacity30: {
        opacity: 0.3,
      },
      pathItemIcon: {
        marginLeft: Styles.globalMargins.medium,
        marginRight: Styles.globalMargins.medium,
      },
      rowText: Styles.platformStyles({
        isMobile: {
          flexShrink: 1,
        },
      }),
      rowText_30: {
        opacity: 0.3,
      },
    } as const)
)

export const normalRowHeight = Kb.smallListItem2Height
