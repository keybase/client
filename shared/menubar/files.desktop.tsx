import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as FsTypes from '../constants/types/fs'
import {Filename} from '../fs/common'
import ConnectedUsernames from '../common-adapters/usernames/remote-container'

type FileUpdateProps = {
  path: FsTypes.Path
  tlfType: FsTypes.TlfType
  uploading: boolean
  onClick: () => void
}

type FileUpdatesProps = {
  updates: Array<FileUpdateProps>
}

export type UserTlfUpdateRowProps = {
  onClickAvatar: () => void
  onSelectPath: () => void
  path: FsTypes.Path
  writer: string
  tlfType: FsTypes.TlfType
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
  <Kb.ClickableBox onClick={props.onClick} style={styles.fullWidth}>
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.fileUpdateRow} alignItems="flex-start">
      <Kb.Icon type="icon-file-16" style={Kb.iconCastPlatformStyles(styles.iconStyle)} />
      {props.uploading && (
        <Kb.Box style={styles.iconBadgeBox}>
          <Kb.Icon type="icon-addon-file-uploading" style={Kb.iconCastPlatformStyles(styles.iconBadge)} />
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
          onShowAll={() => this.setState({isShowingAll: !this.state.isShowingAll})}
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
      <FileUpdate key={FsTypes.pathToString(u.path)} {...u} />
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
        <ConnectedUsernames
          usernames={[props.writer]}
          type="BodySemibold"
          underline={true}
          colorFollowing={true}
          colorBroken={true}
        />
        <Kb.Text type="BodyTiny" style={styles.tlfTime}>
          {props.timestamp}
        </Kb.Text>
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" fullWidth={true}>
        <Kb.Text type="BodySmall" style={styles.tlfParticipants}>
          in&nbsp;
        </Kb.Text>
        <Kb.Text type="BodySmall" style={styles.tlfParticipants} onClick={props.onSelectPath}>
          {props.tlfType === 'team' ? (
            props.teamname
          ) : props.tlfType === 'public' ? (
            <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true}>
              {props.participants.join(',')}
              <Kb.Meta backgroundColor={Styles.globalColors.green} size="Small" title="PUBLIC" />
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

const styles = Styles.styleSheetCreate({
  buttonContainer: {
    marginTop: Styles.globalMargins.tiny,
  },
  fileUpdateRow: {
    marginTop: Styles.globalMargins.xtiny,
    paddingRight: Styles.globalMargins.large,
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
    marginRight: Styles.globalMargins.xtiny,
    position: 'relative',
    top: 1,
    width: 16,
  },
  tlfContainer: {
    backgroundColor: Styles.globalColors.white,
    color: Styles.globalColors.black,
    paddingBottom: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.tiny,
  },
  tlfParticipants: {
    fontSize: 12,
  },
  tlfRowAvatar: {
    marginRight: Styles.globalMargins.tiny,
  },
  tlfRowContainer: {
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.tiny,
  },
  tlfSectionHeader: {
    backgroundColor: Styles.globalColors.blueGrey,
    color: Styles.globalColors.black_50,
    paddingBottom: Styles.globalMargins.xtiny,
    paddingLeft: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.xtiny,
  },
  tlfSectionHeaderContainer: {
    backgroundColor: Styles.globalColors.white,
  },
  tlfTime: {
    marginRight: Styles.globalMargins.tiny,
  },
  tlfTopLine: {
    justifyContent: 'space-between',
  },
  toggleButton: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.black_05,
      borderRadius: Styles.borderRadius,
      marginTop: Styles.globalMargins.xtiny,
      paddingBottom: Styles.globalMargins.xtiny,
      paddingTop: Styles.globalMargins.xtiny,
    },
    isElectron: {
      marginRight: Styles.globalMargins.tiny,
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
    },
  }),
  wordWrapFilename: Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
})
