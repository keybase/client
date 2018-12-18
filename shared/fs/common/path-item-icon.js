// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'

type RealSize = 64 | 48 | 32 | 16
export type Size = 64 | 48 | 32 | 16 | 12

export type Props = {
  path: Types.Path,
  size: Size,
  style?: Styles.StylesCrossPlatform,
  type: Types.PathType,
  username: string,
}

const getIconSize = (size: Size): RealSize => (size === 12 ? 16 : size)

const UnknownIcon = (props: Props) => (
  <Kb.Icon
    type="iconfont-folder-private"
    color={Styles.globalColors.grey}
    fontSize={props.size}
    style={props.style && Kb.iconCastPlatformStyles(props.style)}
  />
)

// $FlowIssue
const i = (s: string): Kb.IconType => s

export default (props: Props) => {
  const elems = Types.getPathElements(props.path)

  if (elems.length === 1) {
    // /keybase
    return <UnknownIcon {...props} />
  }

  if (elems.length === 2) {
    // a tlf list, i.e. /keybase/{private,public,team}
    switch (elems[1]) {
      case 'private':
        return (
          <Kb.Icon
            type={i(`icon-folder-private-${getIconSize(props.size)}`)}
            style={props.style && Kb.iconCastPlatformStyles(props.style)}
          />
        )
      case 'public':
        return (
          <Kb.Icon
            type={i(`icon-folder-public-${getIconSize(props.size)}`)}
            style={props.style && Kb.iconCastPlatformStyles(props.style)}
          />
        )
      case 'team':
        return (
          <Kb.Icon
            type={i(`icon-folder-team-${getIconSize(props.size)}`)}
            style={props.style && Kb.iconCastPlatformStyles(props.style)}
          />
        )
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
          <Kb.Avatar
            size={getIconSize(props.size)}
            username={usernames.find(u => u !== props.username)}
            style={props.style && Kb.avatarCastPlatformStyles(props.style)}
          />
        )
      case 'team':
        return (
          <Kb.Avatar
            size={getIconSize(props.size)}
            teamname={elems[2]}
            isTeam={true}
            style={props.style && Kb.avatarCastPlatformStyles(props.style)}
          />
        )
      default:
        return <UnknownIcon {...props} />
    }
  }

  const iconPathType = props.type === 'folder' ? 'folder' : 'file'
  const iconTlfType = elems[1] === 'public' ? 'public' : 'private'
  return (
    <Kb.Icon
      type={i(`icon-${iconPathType}-${iconTlfType}-${getIconSize(props.size)}`)}
      style={props.style && Kb.iconCastPlatformStyles(props.style)}
    />
  )
}
