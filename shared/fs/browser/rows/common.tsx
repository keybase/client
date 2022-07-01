import * as Styles from '../../../styles'
import * as Types from '../../../constants/types/fs'
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import {OpenInSystemFileManager, ItemIcon, PathItemAction, PathStatusIcon} from '../../common'

export type StillCommonProps = {
  path: Types.Path
  inDestinationPicker?: boolean
  onOpen?: () => void
  mixedMode?: boolean
}

export const StillCommon = (
  props: StillCommonProps & {
    body?: React.ReactNode
    // content and status are ignored if body is set.
    content?: React.ReactNode
    status?: React.ReactNode
    writingToJournal: boolean
    uploadErrored?: boolean
  }
) => (
  <Kb.ListItem2
    type="Small"
    statusIcon={<PathStatusIcon path={props.path} />}
    icon={
      <ItemIcon
        path={props.path}
        size={32}
        style={Styles.collapseStyles([
          rowStyles.pathItemIcon,
          props.writingToJournal && !props.uploadErrored && rowStyles.opacity30,
        ])}
        mixedMode={props.mixedMode}
      />
    }
    firstItem={true /* we add divider in Rows */}
    onClick={props.onOpen}
    body={
      props.body || (
        <Kb.Box
          style={Styles.collapseStyles([
            rowStyles.itemBox,
            props.writingToJournal && !props.uploadErrored && rowStyles.opacity30,
          ])}
        >
          <Kb.Box2 direction="horizontal" fullWidth={true}>
            {props.content}
          </Kb.Box2>
          {props.status || null}
        </Kb.Box>
      )
    }
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
    } as const)
)

export const normalRowHeight = Kb.smallListItem2Height
