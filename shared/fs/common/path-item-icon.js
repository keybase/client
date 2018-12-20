// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import * as Flow from '../../util/flow'
import logger from '../../logger'

type RealSize = 64 | 48 | 32 | 16
export type Size = 64 | 48 | 32 | 16 | 12

export type Props = {
  badge?: ?Types.PathItemBadge,
  path: Types.Path,
  size: Size,
  style?: Styles.StylesCrossPlatform,
  type: Types.PathType,
  username: string,
}

const getIconSize = (size: Size): RealSize => (size === 12 ? 16 : size)

const UnknownIcon = (props: Props) => (
  <Kb.Icon type="iconfont-folder-private" color={Styles.globalColors.grey} fontSize={props.size} />
)

// $FlowIssue
const i = (s: string): Kb.IconType => s

const IconOnly = (props: Props) => {
  const elems = Types.getPathElements(props.path)

  if (elems.length === 1) {
    // /keybase
    return <UnknownIcon {...props} />
  }

  if (elems.length === 2) {
    // a tlf list, i.e. /keybase/{private,public,team}
    switch (elems[1]) {
      case 'private':
        return <Kb.Icon type={i(`icon-folder-private-${getIconSize(props.size)}`)} />
      case 'public':
        return <Kb.Icon type={i(`icon-folder-public-${getIconSize(props.size)}`)} />
      case 'team':
        return <Kb.Icon type={i(`icon-folder-team-${getIconSize(props.size)}`)} />
      default:
        return <UnknownIcon {...props} />
    }
  }

  if (elems.length === 3) {
    // a tlf root, e.g. /keybase/team/kbkbfstest
    switch (elems[1]) {
      case 'private':
      // fallthrough
      case 'public':
        const usernames = Constants.splitTlfIntoUsernames(elems[2])
        return (
          <Kb.Avatar size={getIconSize(props.size)} username={usernames.find(u => u !== props.username)} />
        )
      case 'team':
        return <Kb.Avatar size={getIconSize(props.size)} teamname={elems[2]} isTeam={true} />
      default:
        return <UnknownIcon {...props} />
    }
  }

  const iconPathType = props.type === 'folder' ? 'folder' : 'file'
  const iconTlfType = elems[1] === 'public' ? 'public' : 'private'
  return <Kb.Icon type={i(`icon-${iconPathType}-${iconTlfType}-${getIconSize(props.size)}`)} />
}

const Badge = (props: Props) => {
  if (!!props.badge && props.size !== 32) {
    logger.warn(`PathItemIcon badges only work with size=32 icons. Got ${props.size}.`)
  }
  switch (props.badge) {
    case 'upload':
      return <Kb.Icon type="icon-addon-file-uploading" style={styles.rightBottomBadge} />
    case 'download':
      return <Kb.Icon type="icon-addon-file-downloading" style={styles.rightBottomBadge} />
    case 'rekey':
      return <Kb.Meta title="rekey" backgroundColor={Styles.globalColors.red} style={styles.rekeyBadge} />
    case 'new':
      return <Kb.Meta title="new" backgroundColor={Styles.globalColors.orange} style={styles.newBadge} />
    default:
      if (!props.badge) {
        return null
      }
      if (typeof props.badge === 'number') {
        return <Kb.Badge badgeNumber={props.badge} badgeStyle={styles.numberBadge} />
      }
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(props.badge)
      return null
  }
}

export default (props: Props) => (
  <Kb.Box style={props.style}>
    <IconOnly {...props} />
    {!!props.badge && (
      <Kb.Box style={styles.badgeContainer}>
        <Badge {...props} />
      </Kb.Box>
    )}
  </Kb.Box>
)

const styles = Styles.styleSheetCreate({
  badgeContainer: {
    // 1) Make position 'relative' so it's "positioned",
    //    and that the badge inside can just use 'absolute' relative to this
    //    container.
    // 2) Make width/height explicit 0 so they don't affect nearby stuff.
    height: 0,
    position: 'relative',
    width: 0,
  },
  newBadge: {
    left: 16,
    position: 'absolute',
    top: -36,
  },
  numberBadge: {
    left: 20,
    position: 'absolute',
    top: -36,
  },
  rekeyBadge: {
    left: 14,
    position: 'absolute',
    top: -36,
  },
  rightBottomBadge: {
    left: 20,
    position: 'absolute',
    top: -14,
  },
})
