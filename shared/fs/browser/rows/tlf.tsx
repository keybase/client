import * as T from '@/constants/types'
import {useOpen} from '@/fs/common/use-open'
import {rowStyles, StillCommon} from './common'
import * as Kb from '@/common-adapters'
import {useFsPathMetadata, useFsTlf, TlfInfoLine, Filename} from '@/fs/common'
import * as FS from '@/stores/fs'
import {useCurrentUserState} from '@/stores/current-user'

export type OwnProps = {
  destinationPickerSource?: T.FS.MoveOrCopySource | T.FS.IncomingShareSource | undefined
  disabled: boolean
  mixedMode?: boolean | undefined
  name: string
  tlfType: T.FS.TlfType
}

// TODO dont do this pattern
const FsPathMetadataLoader = ({path}: {path: T.FS.Path}) => {
  useFsPathMetadata(path)
  return null
}

const TLFContainer = (p: OwnProps) => {
  const {tlfType, name, mixedMode, destinationPickerSource, disabled} = p
  const username = useCurrentUserState(s => s.username)
  const path = FS.tlfTypeAndNameToPath(tlfType, name)
  const tlf = useFsTlf(path, {loadOnMount: false})
  const _usernames = FS.getUsernamesFromTlfName(name).filter(name => name !== username)
  const onOpen = useOpen({destinationPickerSource, path})
  const loadPathMetadata = tlf.syncConfig.mode !== T.FS.TlfSyncMode.Disabled
  // Only include the user if they're the only one
  const usernames = !_usernames.length ? [username] : _usernames

  const content = (
    <Kb.BoxGrow>
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        fullHeight={true}
        style={Kb.Styles.collapseStyles([styles.leftBox, disabled && rowStyles.opacity30])}
      >
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.minWidth}>
          <Filename
            type={FS.pathTypeToTextType(T.FS.PathType.Folder)}
            style={Kb.Styles.collapseStyles([rowStyles.rowText, styles.kerning])}
            path={path}
          />
        </Kb.Box2>
        <TlfInfoLine path={path} mode="row" mixedMode={mixedMode} />
      </Kb.Box2>
    </Kb.BoxGrow>
  )

  const avatar = (
    <Kb.Box2 direction="horizontal" style={styles.avatarBox}>
      {FS.isTeamPath(path) ? (
        <Kb.Avatar size={32} isTeam={true} {...(usernames[0] === undefined ? {} : {teamname: usernames[0]})} />
      ) : (
        <Kb.AvatarLine maxShown={4} size={32} layout="horizontal" usernames={usernames} />
      )}
    </Kb.Box2>
  )

  return (
    <>
      {!!loadPathMetadata && <FsPathMetadataLoader path={path} />}
      <StillCommon
        path={path}
        inDestinationPicker={!!destinationPickerSource}
        {...(disabled || onOpen === undefined ? {} : {onOpen})}
        {...(mixedMode === undefined ? {} : {mixedMode})}
        writingToJournal={false}
        {...(Kb.Styles.isMobile
          ? {body: <Kb.Box2 direction="vertical" fullWidth={true} style={rowStyles.itemBox}>{content}</Kb.Box2>}
          : {
              content: (
                <>
                  {content}
                  {avatar}
                </>
              ),
            })}
      />
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      avatarBox: {marginRight: Kb.Styles.globalMargins.xsmall},
      kerning: {letterSpacing: 0.2},
      leftBox: {flex: 1, justifyContent: 'center', minWidth: 0},
      minWidth: {minWidth: 0},
    }) as const
)

export default TLFContainer
