import * as C from '@/constants'
import * as Constants from '@/constants/fs'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import type {IconType} from '@/common-adapters/icon'

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
  badgeOverride?: Kb.IconType
  size: Size
  style: Kb.Styles.StylesCrossPlatform
  tlfType: T.FS.TlfType
}

const getTlfTypeIcon = (size: Size, tlfType: T.FS.TlfType) => {
  switch (tlfType) {
    case T.FS.TlfType.Private:
      return <Kb.Icon fixOverdraw={true} type={icons.tlfList.private[getIconSizeString(size)]} />
    case T.FS.TlfType.Public:
      return <Kb.Icon fixOverdraw={true} type={icons.tlfList.public[getIconSizeString(size)]} />
    case T.FS.TlfType.Team:
      return <Kb.Icon fixOverdraw={true} type={icons.tlfList.team[getIconSizeString(size)]} />
  }
}

const TlfTypeIcon = (props: TlfTypeIconProps) => {
  const tlfList = C.useFSState(s => Constants.getTlfListFromType(s.tlfs, props.tlfType))
  const badgeCount = Constants.computeBadgeNumberForTlfList(tlfList)
  const badgeStyle = badgeStyles[getIconSizeString(props.size)]
  return (
    <Kb.Box style={props.style}>
      {getTlfTypeIcon(props.size, props.tlfType)}
      {props.badgeOverride ? (
        <Kb.Box style={styles.badgeContainer}>
          <Kb.Icon fixOverdraw={true} type={props.badgeOverride} style={badgeStyle.rightBottomBadge} />
          color={Kb.Styles.globalColors.greyDarker}
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
  badgeOverride?: Kb.IconType // TS freaking out IconType
  size: Size
  style?: Kb.Styles.StylesCrossPlatform
  tlfTypeForFolderIconOverride?: T.FS.TlfType
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
          color={Kb.Styles.globalColors.greyDarker}
        />
      </Kb.Box>
    )}
  </Kb.Box>
)

type InTlfItemIconProps = {
  badgeOverride?: Kb.IconType
  path: T.FS.Path
  size: Size
  style?: Kb.Styles.StylesCrossPlatform
  tlfTypeForFolderIconOverride?: T.FS.TlfType
}

const InTlfIcon = (props: InTlfItemIconProps) => {
  const downloads = C.useFSState(s => s.downloads)
  const pathItemActionMenu = C.useFSState(s => s.pathItemActionMenu)
  const downloadIntent = Constants.getDownloadIntent(props.path, downloads, pathItemActionMenu)
  const pathItem = C.useFSState(s => Constants.getPathItem(s.pathItems, props.path))
  const badgeStyle = badgeStyles[getIconSizeString(props.size)]
  const badgeIcon = props.badgeOverride || (downloadIntent && 'icon-addon-file-downloading')
  return (
    <Kb.Box style={props.style}>
      {pathItem.type === T.FS.PathType.Folder ? (
        props.tlfTypeForFolderIconOverride ? (
          getTlfTypeIcon(props.size, props.tlfTypeForFolderIconOverride)
        ) : (
          <Kb.Icon type={icons.folder[getIconSizeString(props.size)]} />
        )
      ) : (
        <Kb.Icon type={icons.file[getIconSizeString(props.size)]} />
      )}
      {badgeIcon ? (
        <Kb.Box style={styles.badgeContainer}>
          <Kb.Icon
            type={badgeIcon}
            style={badgeStyle.rightBottomBadge}
            color={Kb.Styles.globalColors.greyDarker}
          />
        </Kb.Box>
      ) : null}
    </Kb.Box>
  )
}

export type ItemIconProps = {
  badgeOverride?: IconType
  mixedMode?: boolean
  path: T.FS.Path
  size: Size
  style?: Kb.Styles.StylesCrossPlatform
}

const ItemIcon = (props: ItemIconProps) => {
  const parsedPath = Constants.parsePath(props.path)
  switch (parsedPath.kind) {
    case T.FS.PathKind.Root:
      return <Kb.Icon fixOverdraw={true} type={icons['folder'][getIconSizeString(props.size)]} />
    case T.FS.PathKind.TlfList:
      return (
        <TlfTypeIcon
          badgeOverride={props.badgeOverride}
          size={props.size}
          style={props.style}
          tlfType={parsedPath.tlfType}
        />
      )
    case T.FS.PathKind.GroupTlf:
    case T.FS.PathKind.TeamTlf:
      return (
        <TlfIcon
          badgeOverride={props.badgeOverride}
          size={props.size}
          style={props.style}
          tlfTypeForFolderIconOverride={
            props.mixedMode || parsedPath.tlfType === T.FS.TlfType.Public ? parsedPath.tlfType : undefined
          }
        />
      )
    case T.FS.PathKind.InGroupTlf:
    case T.FS.PathKind.InTeamTlf:
      return (
        <InTlfIcon
          badgeOverride={props.badgeOverride}
          path={props.path}
          size={props.size}
          style={props.style}
          tlfTypeForFolderIconOverride={
            parsedPath.tlfType === T.FS.TlfType.Public ? T.FS.TlfType.Public : undefined
          }
        />
      )
  }
}

export default ItemIcon

const styles = Kb.Styles.styleSheetCreate(
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
    }) as const
)

const badgeStyles = {
  '16': Kb.Styles.styleSheetCreate(
    () =>
      ({
        numberBadge: {
          left: Kb.Styles.globalMargins.tiny + Kb.Styles.globalMargins.xxtiny,
          position: 'absolute',
          top: -(Kb.Styles.globalMargins.medium + Kb.Styles.globalMargins.xxtiny),
        },
        rightBottomBadge: Kb.Styles.platformStyles({
          common: {
            position: 'absolute',
          },
          isElectron: {
            height: Kb.Styles.globalMargins.tiny,
            left: Kb.Styles.globalMargins.xsmall - Kb.Styles.globalMargins.xxtiny,
            top: -Kb.Styles.globalMargins.tiny,
            width: Kb.Styles.globalMargins.tiny,
          },
          isMobile: {
            height: Kb.Styles.globalMargins.xsmall,
            left: Kb.Styles.globalMargins.xsmall - Kb.Styles.globalMargins.xtiny,
            top: -Kb.Styles.globalMargins.tiny,
            width: Kb.Styles.globalMargins.xsmall,
          },
        }),
      }) as const
  ),
  '32': Kb.Styles.styleSheetCreate(
    () =>
      ({
        numberBadge: {
          left: Kb.Styles.globalMargins.small + Kb.Styles.globalMargins.xtiny,
          position: 'absolute',
          top: -(Kb.Styles.globalMargins.mediumLarge + Kb.Styles.globalMargins.xtiny),
        },
        rightBottomBadge: Kb.Styles.platformStyles({
          common: {
            position: 'absolute',
          },
          isElectron: {
            height: Kb.Styles.globalMargins.xsmall,
            left: Kb.Styles.globalMargins.medium - Kb.Styles.globalMargins.xxtiny,
            top: -(Kb.Styles.globalMargins.xsmall + Kb.Styles.globalMargins.xxtiny),
            width: Kb.Styles.globalMargins.xsmall,
          },
          isMobile: {
            height: Kb.Styles.globalMargins.small,
            left: Kb.Styles.globalMargins.medium - Kb.Styles.globalMargins.xtiny,
            top: -Kb.Styles.globalMargins.small,
            width: Kb.Styles.globalMargins.small,
          },
        }),
      }) as const
  ),
  '48': Kb.Styles.styleSheetCreate(
    () =>
      ({
        numberBadge: {
          left: Kb.Styles.globalMargins.mediumLarge + Kb.Styles.globalMargins.xtiny,
          position: 'absolute',
          top: -(Kb.Styles.globalMargins.large + Kb.Styles.globalMargins.tiny),
        },
        rightBottomBadge: {
          height: Kb.Styles.globalMargins.small,
          left: Kb.Styles.globalMargins.mediumLarge - Kb.Styles.globalMargins.xxtiny,
          position: 'absolute',
          top: -Kb.Styles.globalMargins.small - Kb.Styles.globalMargins.xtiny,
          width: Kb.Styles.globalMargins.small,
        },
      }) as const
  ),
  '96': Kb.Styles.styleSheetCreate(
    () =>
      ({
        numberBadge: {
          left: Kb.Styles.globalMargins.large + Kb.Styles.globalMargins.tiny,
          position: 'absolute',
          top: -(Kb.Styles.globalMargins.large + Kb.Styles.globalMargins.small),
        },
        rightBottomBadge: {
          // this doesn't work for the folder icon, but it's fine as we don't
          // have such badge on folder icon of 96 size.
          height: Kb.Styles.globalMargins.medium,
          left: Kb.Styles.globalMargins.xlarge,
          position: 'absolute',
          top: -(Kb.Styles.globalMargins.medium + Kb.Styles.globalMargins.xtiny),
          width: Kb.Styles.globalMargins.medium,
        },
      }) as const
  ),
}
