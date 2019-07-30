import * as Styles from '../../../styles'
import * as Types from '../../../constants/types/fs'
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import {OpenInSystemFileManager, PathItemIcon, PathItemAction, SyncStatus} from '../../common'
import flags from '../../../util/feature-flags'

export type StillCommonProps = {
  name: string
  path: Types.Path
  inDestinationPicker?: boolean
  onOpen: () => void
  showActionsWithGrow?: boolean | null
  showTlfTypeIcon?: boolean
}

export const StillCommon = (
  props: StillCommonProps & {
    children: React.ReactNode
    badge?: Types.PathItemBadge | null
  }
) => (
  <Kb.ListItem2
    type="Small"
    statusIcon={
      flags.kbfsOfflineMode && Types.getPathLevel(props.path) > 2 && <SyncStatus path={props.path} />
    }
    icon={
      <PathItemIcon
        path={props.path}
        size={32}
        style={rowStyles.pathItemIcon}
        badge={props.badge}
        showTlfTypeIcon={props.showTlfTypeIcon}
      />
    }
    firstItem={true /* we add divider in Rows */}
    onClick={props.onOpen}
    body={props.children}
    onlyShowActionOnHover={props.showActionsWithGrow ? 'grow' : 'fade'}
    action={
      !props.inDestinationPicker &&
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

export const rowStyles = Styles.styleSheetCreate({
  itemBox: {
    ...Styles.globalStyles.flexBoxColumn,
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    width: 0,
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
})

export const normalRowHeight = Kb.smallListItem2Height
