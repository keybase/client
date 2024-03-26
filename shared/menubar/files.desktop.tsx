import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {Filename} from '@/fs/common'

type FileUpdateProps = {
  path: T.FS.Path
  tlfType: T.FS.TlfType
  uploading: boolean
  onClick: () => void
}

type FileUpdatesProps = {
  updates: Array<FileUpdateProps>
}

export type UserTlfUpdateRowProps = {
  onClickAvatar: () => void
  onSelectPath: () => void
  path: T.FS.Path
  writer: string
  tlfType: T.FS.TlfType
  participants: Array<string>
  teamname: string
  timestamp: string
  tlf: string
  updates: Array<FileUpdateProps>
  username: string
}

type FilesPreviewProps = {
  userTlfUpdates: Array<UserTlfUpdateRowProps>
}

export const FileUpdate = (props: FileUpdateProps) => (
  <Kb.ClickableBox className="hover-underline-container" onClick={props.onClick} style={styles.fullWidth}>
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.fileUpdateRow} alignItems="flex-start">
      <Kb.Icon type="icon-file-16" style={styles.iconStyle} />
      {props.uploading && (
        <Kb.Box style={styles.iconBadgeBox}>
          <Kb.Icon type="icon-addon-file-uploading" style={styles.iconBadge} />
        </Kb.Box>
      )}
      <Filename type="Body" path={props.path} />
    </Kb.Box2>
  </Kb.ClickableBox>
)

type FileUpdatesState = {
  isShowingAll: boolean
}

const FileUpdatesHoc = (ComposedComponent: React.ComponentType<any>) =>
  class extends React.PureComponent<FileUpdatesProps, FileUpdatesState> {
    state = {
      isShowingAll: false,
    }
    render() {
      return (
        <ComposedComponent
          {...this.props}
          onShowAll={() => this.setState(s => ({isShowingAll: !s.isShowingAll}))}
          isShowingAll={this.state.isShowingAll}
        />
      )
    }
  }

type FileUpdatesHocProps = {
  onShowAll: () => void
  isShowingAll: boolean
}

type ShowAllProps = FileUpdatesHocProps & {
  numUpdates: number
}

const FileUpdatesShowAll = (props: ShowAllProps) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={false} style={styles.buttonContainer}>
    <Kb.Button
      label={`+ ${(props.numUpdates - defaultNumFileOptionsShown).toString()} more`}
      onClick={props.onShowAll}
      small={true}
      type="Dim"
    />
  </Kb.Box2>
)

const defaultNumFileOptionsShown = 3

const FileUpdates = (props: FileUpdatesProps & FileUpdatesHocProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    {props.updates.slice(0, props.isShowingAll ? props.updates.length : defaultNumFileOptionsShown).map(u => (
      <FileUpdate key={T.FS.pathToString(u.path)} {...u} />
    ))}
    {props.updates.length > defaultNumFileOptionsShown && !props.isShowingAll && (
      <FileUpdatesShowAll
        onShowAll={props.onShowAll}
        isShowingAll={props.isShowingAll}
        numUpdates={props.updates.length}
      />
    )}
  </Kb.Box2>
)

const ComposedFileUpdates = FileUpdatesHoc(FileUpdates)

const UserTlfUpdateRow = (props: UserTlfUpdateRowProps) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.tlfRowContainer}>
    <Kb.Avatar size={32} username={props.writer} style={styles.tlfRowAvatar} onClick={props.onClickAvatar} />
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.tlfTopLine}>
        <Kb.ConnectedUsernames
          usernames={props.writer}
          type="BodyBold"
          underline={true}
          colorFollowing={true}
          colorBroken={true}
          withProfileCardPopup={false /* part of store is not plumbed; also no space in widget*/}
        />
        <Kb.Text type="BodyTiny" style={styles.tlfTime}>
          {props.timestamp}
        </Kb.Text>
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" fullWidth={true}>
        <Kb.Text type="BodySmall" style={styles.tlfParticipants}>
          in&nbsp;
        </Kb.Text>
        <Kb.Text
          className="hover-underline"
          type="BodySmall"
          style={styles.tlfParticipants}
          onClick={props.onSelectPath}
        >
          {props.tlfType === T.FS.TlfType.Team ? (
            props.teamname
          ) : props.tlfType === T.FS.TlfType.Public ? (
            <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true}>
              {props.participants.join(',')}
              <Kb.Meta backgroundColor={Kb.Styles.globalColors.green} size="Small" title="PUBLIC" />
            </Kb.Box2>
          ) : (
            `${props.participants.join(',')}`
          )}
        </Kb.Text>
      </Kb.Box2>
      <ComposedFileUpdates updates={props.updates} />
    </Kb.Box2>
  </Kb.Box2>
)

export const FilesPreview = (props: FilesPreviewProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.tlfContainer}>
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.tlfSectionHeaderContainer}>
      <Kb.Text type="BodySmallSemibold" style={styles.tlfSectionHeader}>
        Recent files
      </Kb.Text>
    </Kb.Box2>
    <Kb.Box2 direction="vertical" fullWidth={true}>
      {props.userTlfUpdates.map(r => {
        return <UserTlfUpdateRow key={r.tlf + r.writer + r.timestamp} {...r} />
      })}
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      buttonContainer: {
        marginTop: Kb.Styles.globalMargins.tiny,
      },
      fileUpdateRow: {
        marginTop: Kb.Styles.globalMargins.xtiny,
        paddingRight: Kb.Styles.globalMargins.large,
      },
      fullWidth: {
        // needed to avoid icon being pinched
        width: '100%',
      },
      iconBadge: {
        height: 12,
        width: 12,
      },
      iconBadgeBox: {
        marginLeft: -12,
        marginRight: 12,
        marginTop: 12,
        width: 0,
        zIndex: 100,
      },
      iconStyle: {
        flexShrink: 0,
        height: 16,
        marginRight: Kb.Styles.globalMargins.xtiny,
        position: 'relative',
        top: 1,
        width: 16,
      },
      tlfContainer: {
        backgroundColor: Kb.Styles.globalColors.white,
        color: Kb.Styles.globalColors.black,
        paddingBottom: Kb.Styles.globalMargins.tiny,
        paddingTop: Kb.Styles.globalMargins.tiny,
      },
      tlfParticipants: {
        fontSize: 12,
      },
      tlfRowAvatar: {
        marginRight: Kb.Styles.globalMargins.tiny,
      },
      tlfRowContainer: {
        paddingBottom: Kb.Styles.globalMargins.tiny,
        paddingLeft: Kb.Styles.globalMargins.tiny,
        paddingTop: Kb.Styles.globalMargins.tiny,
      },
      tlfSectionHeader: {
        backgroundColor: Kb.Styles.globalColors.blueGrey,
        color: Kb.Styles.globalColors.black_50,
        paddingBottom: Kb.Styles.globalMargins.xtiny,
        paddingLeft: Kb.Styles.globalMargins.tiny,
        paddingTop: Kb.Styles.globalMargins.xtiny,
      },
      tlfSectionHeaderContainer: {
        backgroundColor: Kb.Styles.globalColors.white,
      },
      tlfTime: {
        marginRight: Kb.Styles.globalMargins.tiny,
      },
      tlfTopLine: {
        justifyContent: 'space-between',
      },
      toggleButton: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.black_05,
          borderRadius: Kb.Styles.borderRadius,
          marginTop: Kb.Styles.globalMargins.xtiny,
          paddingBottom: Kb.Styles.globalMargins.xtiny,
          paddingTop: Kb.Styles.globalMargins.xtiny,
        },
        isElectron: {
          marginRight: Kb.Styles.globalMargins.tiny,
          paddingLeft: Kb.Styles.globalMargins.tiny,
          paddingRight: Kb.Styles.globalMargins.tiny,
        },
      }),
      wordWrapFilename: Kb.Styles.platformStyles({
        isElectron: {
          wordBreak: 'break-all',
        },
      }),
    }) as const
)
