import * as C from '@/constants'
import * as T from '@/constants/types'
import {rowStyles, StillCommon, type StillCommonProps} from './common'
import * as Kb from '@/common-adapters'
import {useFsPathMetadata, TlfInfoLine, Filename} from '@/fs/common'

type TlfProps = StillCommonProps & {
  loadPathMetadata?: boolean
  // We don't use this at the moment. In the future this will be used for
  // showing ignored folders when we allow user to show ignored folders in GUI.
  isIgnored: boolean
  mixedMode?: boolean
  usernames: Array<string>
  disabled: boolean
}

const Content = (props: TlfProps) => (
  <Kb.BoxGrow>
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      fullHeight={true}
      style={Kb.Styles.collapseStyles([styles.leftBox, props.disabled && rowStyles.opacity30])}
    >
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.minWidth}>
        <Filename
          type={C.FS.pathTypeToTextType(T.FS.PathType.Folder)}
          style={Kb.Styles.collapseStyles([rowStyles.rowText, styles.kerning])}
          path={props.path}
        />
      </Kb.Box2>
      <TlfInfoLine path={props.path} mode="row" mixedMode={props.mixedMode} />
    </Kb.Box2>
  </Kb.BoxGrow>
)
const Avatars = (props: TlfProps) => (
  <Kb.Box style={styles.avatarBox}>
    {C.FS.isTeamPath(props.path) ? (
      <Kb.Avatar size={32} isTeam={true} teamname={props.usernames[0]} />
    ) : (
      <Kb.AvatarLine maxShown={4} size={32} layout="horizontal" usernames={props.usernames} />
    )}
  </Kb.Box>
)

const FsPathMetadataLoader = ({path}: {path: T.FS.Path}) => {
  useFsPathMetadata(path)
  return null
}

const Tlf = (props: TlfProps) => (
  <>
    {!!props.loadPathMetadata && <FsPathMetadataLoader path={props.path} />}
    <StillCommon
      path={props.path}
      onOpen={props.disabled ? undefined : props.onOpen}
      inDestinationPicker={props.inDestinationPicker}
      mixedMode={props.mixedMode}
      writingToJournal={false}
      body={
        Kb.Styles.isMobile ? (
          <Kb.Box style={rowStyles.itemBox}>
            <Content {...props} />
          </Kb.Box>
        ) : undefined
      }
      content={
        !Kb.Styles.isMobile ? (
          <>
            <Content {...props} />
            <Avatars {...props} />
          </>
        ) : undefined
      }
    />
  </>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      avatarBox: {marginRight: Kb.Styles.globalMargins.xsmall},
      kerning: {letterSpacing: 0.2},
      leftBox: {flex: 1, justifyContent: 'center', minWidth: 0},
      minWidth: {minWidth: 0},
    }) as const
)

export default Tlf
