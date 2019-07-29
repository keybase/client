import * as React from 'react'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import * as Flow from '../../util/flow'
import logger from '../../logger'

type RealSize = 96 | 64 | 48 | 32 | 16
type RealSizeString = '96' | '64' | '48' | '32' | '16'
export type Size = RealSize | 12

export type Props = {
  badge?: Types.PathItemBadge | null
  path: Types.Path
  showTlfTypeIcon?: boolean
  size: Size
  style?: Styles.StylesCrossPlatform
  type: Types.PathType
  username: string
}

const getIconSize = (size: Size): RealSize => (size === 12 ? 16 : size)
const getIconSizeString = (size: Size): RealSizeString => {
  const realSize = getIconSize(size)
  switch (realSize) {
    case 16:
      return '16'
    case 32:
      return '32'
    case 48:
      return '48'
    case 64:
      return '64'
    case 96:
      return '96'
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(realSize)
      return '32'
  }
}

const UnknownIcon = (_: Props) => <Kb.Icon type="icon-folder-16" />

const icons = {
  file: {
    '16': 'icon-file-16',
    '32': 'icon-file-32',
    '48': 'icon-file-48',
    '64': 'icon-file-64',
    '96': 'icon-file-96',
  },
  folder: {
    '16': 'icon-folder-16',
    '32': 'icon-folder-32',
    '48': 'icon-folder-48',
    '64': 'icon-folder-64',
    '96': 'icon-folder-64', // TODO: use 96 when we have it
  },
  tlfList: {
    private: {
      '16': 'icon-folder-private-16',
      '32': 'icon-folder-private-32',
      '48': 'icon-folder-private-48',
      '64': 'icon-folder-private-64',
      '96': 'icon-folder-private-64', // TODO: use 96 when we have it
    },
    public: {
      '16': 'icon-folder-public-16',
      '32': 'icon-folder-public-32',
      '48': 'icon-folder-public-48',
      '64': 'icon-folder-public-64',
      '96': 'icon-folder-public-64', // TODO: use 96 when we have it
    },
    team: {
      '16': 'icon-folder-team-16',
      '32': 'icon-folder-team-32',
      '48': 'icon-folder-team-48',
      '64': 'icon-folder-team-64',
      '96': 'icon-folder-team-64', // TODO: use 96 when we have it
    },
  },
} as const

const IconOnly = (props: Props) => {
  const parsedPath = Constants.parsePath(props.path)

  if (parsedPath === Constants.parsedPathRoot) {
    return <UnknownIcon {...props} />
  }

  switch (parsedPath) {
    case Constants.parsedPathPrivateList:
      return <Kb.Icon type={icons.tlfList.private[getIconSizeString(props.size)]} />
    case Constants.parsedPathPublicList:
      return <Kb.Icon type={icons.tlfList.public[getIconSizeString(props.size)]} />
    case Constants.parsedPathTeamList:
      return <Kb.Icon type={icons.tlfList.team[getIconSizeString(props.size)]} />
    default:
    // must be a TLF root or inside TLF; fallthrough
  }

  const iconPathType = props.type === Types.PathType.Folder ? 'folder' : 'file'
  switch (parsedPath.kind) {
    case Types.PathKind.GroupTlf:
      if (parsedPath.tlfType === Types.TlfType.Public) {
        return <Kb.Icon type={icons.tlfList.public[getIconSizeString(props.size)]} />
      } else {
        return props.showTlfTypeIcon ? (
          <Kb.Icon type={icons.tlfList.private[getIconSizeString(props.size)]} />
        ) : (
          <Kb.Icon type={icons.folder[getIconSizeString(props.size)]} />
        )
      }
    case Types.PathKind.TeamTlf:
      return props.showTlfTypeIcon ? (
        <Kb.Icon type={icons.tlfList.team[getIconSizeString(props.size)]} />
      ) : (
        <Kb.Icon type={icons.folder[getIconSizeString(props.size)]} />
      )
    case Types.PathKind.InGroupTlf:
      if (parsedPath.tlfType === Types.TlfType.Public && props.type === Types.PathType.Folder) {
        return <Kb.Icon type={icons.tlfList.public[getIconSizeString(props.size)]} />
      } else {
        return <Kb.Icon type={icons[iconPathType][getIconSizeString(props.size)]} />
      }
    case Types.PathKind.InTeamTlf:
      return <Kb.Icon type={icons[iconPathType][getIconSizeString(props.size)]} />
    default:
      return <UnknownIcon {...props} />
  }
}

const Badge = (props: Props) => {
  if (!!props.badge && props.size !== 32 && props.size !== 48) {
    logger.warn(`PathItemIcon badges only work with size=32 and size=48 icons. Got ${props.size}.`)
  }
  const badgeStyle = props.size === 48 ? badgeStyles['48'] : badgeStyles['32']
  switch (props.badge) {
    case Types.PathItemBadgeType.Upload:
      return <Kb.Icon type="icon-addon-file-uploading" style={badgeStyle.rightBottomBadge} />
    case Types.PathItemBadgeType.Download:
      return <Kb.Icon type="icon-addon-file-downloading" style={badgeStyle.rightBottomBadge} />
    case Types.PathItemBadgeType.Rekey:
      return <Kb.Meta title="rekey" backgroundColor={Styles.globalColors.red} style={badgeStyle.rekeyBadge} />
    case Types.PathItemBadgeType.New:
      return <Kb.Meta title="new" backgroundColor={Styles.globalColors.orange} style={badgeStyle.newBadge} />
    default:
      if (!props.badge) {
        return null
      }
      if (typeof props.badge === 'number') {
        return <Kb.Badge badgeNumber={props.badge} badgeStyle={badgeStyle.numberBadge} />
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
})

const badgeStyles = {
  '32': Styles.styleSheetCreate({
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
  }),
  '48': Styles.styleSheetCreate({
    newBadge: {
      left: 32,
      position: 'absolute',
      top: -48,
    },
    numberBadge: {
      left: 36,
      position: 'absolute',
      top: -48,
    },
    rekeyBadge: {
      left: 28,
      position: 'absolute',
      top: -48,
    },
    rightBottomBadge: {
      left: 32,
      position: 'absolute',
      top: -18,
    },
  }),
}
