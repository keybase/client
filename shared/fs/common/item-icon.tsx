import * as Styles from '../../styles'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import type {IconType} from '../../common-adapters/icon'

export type Size = 96 | 48 | 32 | 16
type SizeString = '96' | '48' | '32' | '16'

const getIconSizeString = (size: Size): SizeString => {
  switch (size) {
    case 16:
      return '16'
    case 32:
      return '32'
    case 48:
      return '48'
    case 96:
      return '96'
  }
}

const icons = {
  file: {
    '16': 'icon-file-16',
    '32': 'icon-file-32',
    '48': 'icon-file-48',
    '96': 'icon-file-96',
  },
  folder: {
    '16': 'icon-folder-16',
    '32': 'icon-folder-32',
    '48': 'icon-folder-48',
    '96': 'icon-folder-64', // TODO: use 96 when we have it
  },
  tlfList: {
    private: {
      '16': 'icon-folder-private-16',
      '32': 'icon-folder-private-32',
      '48': 'icon-folder-private-48',
      '96': 'icon-folder-private-64', // TODO: use 96 when we have it
    },
    public: {
      '16': 'icon-folder-public-16',
      '32': 'icon-folder-public-32',
      '48': 'icon-folder-public-48',
      '96': 'icon-folder-public-64', // TODO: use 96 when we have it
    },
    team: {
      '16': 'icon-folder-team-16',
      '32': 'icon-folder-team-32',
      '48': 'icon-folder-team-48',
      '96': 'icon-folder-team-64', // TODO: use 96 when we have it
    },
  },
} as const

export type TlfTypeIconProps = {
  badgeOverride?: any // TS freaking out IconType
  size: Size
  style: Styles.StylesCrossPlatform
  tlfType: Types.TlfType
}

const getTlfTypeIcon = (size: Size, tlfType: Types.TlfType) => {
  switch (tlfType) {
    case Types.TlfType.Private:
      return <Kb.Icon fixOverdraw={true} type={icons.tlfList.private[getIconSizeString(size)]} />
    case Types.TlfType.Public:
      return <Kb.Icon fixOverdraw={true} type={icons.tlfList.public[getIconSizeString(size)]} />
    case Types.TlfType.Team:
      return <Kb.Icon fixOverdraw={true} type={icons.tlfList.team[getIconSizeString(size)]} />
  }
}

export const TlfTypeIcon = (props: TlfTypeIconProps) => {
  const tlfList = Container.useSelector(state => Constants.getTlfListFromType(state.fs.tlfs, props.tlfType))
  const badgeCount = Constants.computeBadgeNumberForTlfList(tlfList)
  const badgeStyle = badgeStyles[getIconSizeString(props.size)]
  return (
    <Kb.Box style={props.style}>
      {getTlfTypeIcon(props.size, props.tlfType)}
      {props.badgeOverride ? (
        <Kb.Box style={styles.badgeContainer}>
          <Kb.Icon fixOverdraw={true} type={props.badgeOverride} style={badgeStyle.rightBottomBadge} />
          color={Styles.globalColors.greyDarker}
        </Kb.Box>
      ) : (
        !!badgeCount && (
          <Kb.Box style={styles.badgeContainer}>
            <Kb.Badge badgeNumber={badgeCount} badgeStyle={badgeStyle.numberBadge} />
          </Kb.Box>
        )
      )}
    </Kb.Box>
  )
}

type TlfIconProps = {
  badgeOverride?: any // TS freaking out IconType
  size: Size
  style?: Styles.StylesCrossPlatform
  tlfTypeForFolderIconOverride?: Types.TlfType
}

const TlfIcon = (props: TlfIconProps) => (
  <Kb.Box style={props.style}>
    {props.tlfTypeForFolderIconOverride ? (
      getTlfTypeIcon(props.size, props.tlfTypeForFolderIconOverride)
    ) : (
      <Kb.Icon fixOverdraw={true} type={icons.folder[getIconSizeString(props.size)]} />
    )}
    {!!props.badgeOverride && (
      <Kb.Box style={styles.badgeContainer}>
        <Kb.Icon
          fixOverdraw={true}
          type={props.badgeOverride}
          style={badgeStyles[getIconSizeString(props.size)].rightBottomBadge}
          color={Styles.globalColors.greyDarker}
        />
      </Kb.Box>
    )}
  </Kb.Box>
)

type InTlfItemIconProps = {
  badgeOverride?: any // TS freaking out IconType
  path: Types.Path
  size: Size
  style?: Styles.StylesCrossPlatform
  tlfTypeForFolderIconOverride?: Types.TlfType
}

const InTlfIcon = (props: InTlfItemIconProps) => {
  const downloads = Container.useSelector(state => state.fs.downloads)
  const pathItemActionMenu = Container.useSelector(state => state.fs.pathItemActionMenu)
  const downloadIntent = Constants.getDownloadIntent(props.path, downloads, pathItemActionMenu)
  const pathItem = Container.useSelector(state => Constants.getPathItem(state.fs.pathItems, props.path))
  const badgeStyle = badgeStyles[getIconSizeString(props.size)]
  const badgeIcon = props.badgeOverride || (downloadIntent && 'icon-addon-file-downloading') || null
  return (
    <Kb.Box style={props.style}>
      {pathItem.type === Types.PathType.Folder ? (
        props.tlfTypeForFolderIconOverride ? (
          getTlfTypeIcon(props.size, props.tlfTypeForFolderIconOverride)
        ) : (
          <Kb.Icon type={icons.folder[getIconSizeString(props.size)]} />
        )
      ) : (
        <Kb.Icon type={icons.file[getIconSizeString(props.size)]} />
      )}
      {badgeIcon && (
        <Kb.Box style={styles.badgeContainer}>
          <Kb.Icon
            type={badgeIcon}
            style={badgeStyle.rightBottomBadge}
            color={Styles.globalColors.greyDarker}
          />
        </Kb.Box>
      )}
    </Kb.Box>
  )
}

export type ItemIconProps = {
  badgeOverride?: IconType
  mixedMode?: boolean
  path: Types.Path
  size: Size
  style?: Styles.StylesCrossPlatform
}

const ItemIcon = (props: ItemIconProps) => {
  const parsedPath = Constants.parsePath(props.path)
  switch (parsedPath.kind) {
    case Types.PathKind.Root:
      return <Kb.Icon fixOverdraw={true} type={icons['folder'][getIconSizeString(props.size)]} />
    case Types.PathKind.TlfList:
      return (
        <TlfTypeIcon
          badgeOverride={props.badgeOverride}
          size={props.size}
          style={props.style}
          tlfType={parsedPath.tlfType}
        />
      )
    case Types.PathKind.GroupTlf:
    case Types.PathKind.TeamTlf:
      return (
        <TlfIcon
          badgeOverride={props.badgeOverride}
          size={props.size}
          style={props.style}
          tlfTypeForFolderIconOverride={
            props.mixedMode || parsedPath.tlfType === Types.TlfType.Public ? parsedPath.tlfType : undefined
          }
        />
      )
    case Types.PathKind.InGroupTlf:
    case Types.PathKind.InTeamTlf:
      return (
        <InTlfIcon
          badgeOverride={props.badgeOverride}
          path={props.path}
          size={props.size}
          style={props.style}
          tlfTypeForFolderIconOverride={
            parsedPath.tlfType === Types.TlfType.Public ? Types.TlfType.Public : undefined
          }
        />
      )
  }
}

export default ItemIcon

const styles = Styles.styleSheetCreate(
  () =>
    ({
      badgeContainer: {
        // 1) Make position 'relative' so it's "positioned",
        //    and that the badge inside can just use 'absolute' relative to this
        //    container.
        // 2) Make width/height explicit 0 so they don't affect nearby stuff.
        height: 0,
        position: 'relative',
        width: 0,
      },
    } as const)
)

const badgeStyles = {
  '16': Styles.styleSheetCreate(
    () =>
      ({
        numberBadge: {
          left: Styles.globalMargins.tiny + Styles.globalMargins.xxtiny,
          position: 'absolute',
          top: -(Styles.globalMargins.medium + Styles.globalMargins.xxtiny),
        },
        rightBottomBadge: Styles.platformStyles({
          common: {
            position: 'absolute',
          },
          isElectron: {
            height: Styles.globalMargins.tiny,
            left: Styles.globalMargins.xsmall - Styles.globalMargins.xxtiny,
            top: -Styles.globalMargins.tiny,
            width: Styles.globalMargins.tiny,
          },
          isMobile: {
            height: Styles.globalMargins.xsmall,
            left: Styles.globalMargins.xsmall - Styles.globalMargins.xtiny,
            top: -Styles.globalMargins.tiny,
            width: Styles.globalMargins.xsmall,
          },
        }),
      } as const)
  ),
  '32': Styles.styleSheetCreate(
    () =>
      ({
        numberBadge: {
          left: Styles.globalMargins.small + Styles.globalMargins.xtiny,
          position: 'absolute',
          top: -(Styles.globalMargins.mediumLarge + Styles.globalMargins.xtiny),
        },
        rightBottomBadge: Styles.platformStyles({
          common: {
            position: 'absolute',
          },
          isElectron: {
            height: Styles.globalMargins.xsmall,
            left: Styles.globalMargins.medium - Styles.globalMargins.xxtiny,
            top: -(Styles.globalMargins.xsmall + Styles.globalMargins.xxtiny),
            width: Styles.globalMargins.xsmall,
          },
          isMobile: {
            height: Styles.globalMargins.small,
            left: Styles.globalMargins.medium - Styles.globalMargins.xtiny,
            top: -Styles.globalMargins.small,
            width: Styles.globalMargins.small,
          },
        }),
      } as const)
  ),
  '48': Styles.styleSheetCreate(
    () =>
      ({
        numberBadge: {
          left: Styles.globalMargins.mediumLarge + Styles.globalMargins.xtiny,
          position: 'absolute',
          top: -(Styles.globalMargins.large + Styles.globalMargins.tiny),
        },
        rightBottomBadge: {
          height: Styles.globalMargins.small,
          left: Styles.globalMargins.mediumLarge - Styles.globalMargins.xxtiny,
          position: 'absolute',
          top: -Styles.globalMargins.small - Styles.globalMargins.xtiny,
          width: Styles.globalMargins.small,
        },
      } as const)
  ),
  '96': Styles.styleSheetCreate(
    () =>
      ({
        numberBadge: {
          left: Styles.globalMargins.large + Styles.globalMargins.tiny,
          position: 'absolute',
          top: -(Styles.globalMargins.large + Styles.globalMargins.small),
        },
        rightBottomBadge: {
          // this doesn't work for the folder icon, but it's fine as we don't
          // have such badge on folder icon of 96 size.
          height: Styles.globalMargins.medium,
          left: Styles.globalMargins.xlarge,
          position: 'absolute',
          top: -(Styles.globalMargins.medium + Styles.globalMargins.xtiny),
          width: Styles.globalMargins.medium,
        },
      } as const)
  ),
}
