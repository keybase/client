// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as FsTypes from '../constants/types/fs'
import PathItemIcon from '../fs/common/path-item-icon'
import ConnectedUsernames from '../common-adapters/usernames/remote-container'

type FileUpdateProps = {|
  name: string,
  tlfType: FsTypes.TlfType,
  uploading: boolean,
  onClick: () => void,
|}

type FileUpdatesProps = {|
  updates: Array<FileUpdateProps>,
  tlfType: FsTypes.TlfType,
|}

export type UserTlfUpdateRowProps = {|
  tlf: string,
  onSelectPath: () => void,
  iconSpec: FsTypes.PathItemIconSpec,
  writer: string,
  tlfType: FsTypes.TlfType,
  participants: Array<string>,
  teamname: string,
  timestamp: string,
  updates: Array<FileUpdateProps>,
|}

type FilesPreviewProps = {|
  userTlfUpdates: Array<UserTlfUpdateRowProps>,
|}

export const FileUpdate = (props: FileUpdateProps) => (
  <Kb.ClickableBox onClick={props.onClick}>
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.fileUpdateRow}>
      <Kb.Icon
        type={props.tlfType === 'public' ? 'icon-file-public-32' : 'icon-file-private-32'}
        style={Kb.iconCastPlatformStyles(styles.iconStyle)}
      />
      {props.uploading && (
        <Kb.Box style={styles.iconBadgeBox}>
          <Kb.Icon type="icon-addon-file-uploading" style={Kb.iconCastPlatformStyles(styles.iconBadge)} />
        </Kb.Box>
      )}
      <Kb.Text type="BodySecondaryLink" style={styles.fileUpdateName}>
        {props.name}
      </Kb.Text>
    </Kb.Box2>
  </Kb.ClickableBox>
)

type FileUpdatesState = {
  isShowingAll: boolean,
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

type FileUpdatesHocProps = {|
  onShowAll: () => void,
  isShowingAll: boolean,
|}

type ShowAllProps = FileUpdatesHocProps & {|
  numUpdates: number,
|}

const FileUpdatesShowAll = (props: ShowAllProps) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={false}>
    <Kb.ClickableBox onClick={props.onShowAll} className="toggleButtonClass" style={styles.toggleButton}>
      <Kb.Text type="BodySmallSemibold" style={styles.buttonText}>
        {props.isShowingAll
          ? 'Collapse'
          : `+ ${(props.numUpdates - defaultNumFileOptionsShown).toString()} more`}
      </Kb.Text>
    </Kb.ClickableBox>
  </Kb.Box2>
)

const defaultNumFileOptionsShown = 3

const FileUpdates = (props: FileUpdatesProps & FileUpdatesHocProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    {props.updates.slice(0, props.isShowingAll ? props.updates.length : defaultNumFileOptionsShown).map(u => (
      <FileUpdate key={u.name} {...u} tlfType={props.tlfType} />
    ))}
    {props.updates.length > defaultNumFileOptionsShown && (
      // $FlowIssue ¯\_(ツ)_/¯
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
    <PathItemIcon spec={props.iconSpec} style={styles.tlfRowAvatar} />
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.tlfTopLine}>
        <ConnectedUsernames
          usernames={[props.writer]}
          type="BodySemibold"
          underline={true}
          colorFollowing={true}
          colorBroken={true}
        />
        <Kb.Text type="BodySmall" style={styles.tlfTime}>
          {props.timestamp}
        </Kb.Text>
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" fullWidth={true}>
        <Kb.Text type="BodySmall" style={styles.tlfParticipants}>
          in&nbsp;
        </Kb.Text>
        <Kb.Text type="BodySmallSecondaryLink" style={styles.tlfParticipants} onClick={props.onSelectPath}>
          {props.tlfType === 'team' ? props.teamname : props.participants.join(',')}
        </Kb.Text>
      </Kb.Box2>
      <ComposedFileUpdates updates={props.updates} tlfType={props.tlfType} />
    </Kb.Box2>
  </Kb.Box2>
)

export const FilesPreview = (props: FilesPreviewProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.tlfContainer}>
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.tlfSectionHeaderContainer}>
      <Kb.Text type="BodySemibold" style={styles.tlfSectionHeader}>
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
  buttonText: {color: Styles.globalColors.black_60},
  iconStyle: {
    width: 16,
    height: 16,
    marginRight: Styles.globalMargins.xtiny,
  },
  tlfContainer: {
    paddingTop: Styles.globalMargins.tiny,
    paddingBottom: Styles.globalMargins.tiny,
    backgroundColor: Styles.globalColors.white,
    color: Styles.globalColors.black,
  },
  tlfSectionHeaderContainer: {
    backgroundColor: Styles.globalColors.white,
  },
  tlfSectionHeader: {
    backgroundColor: Styles.globalColors.black_05,
    color: Styles.globalColors.black_40,
    paddingTop: Styles.globalMargins.xtiny,
    paddingBottom: Styles.globalMargins.xtiny,
    paddingLeft: Styles.globalMargins.tiny,
  },
  tlfRowContainer: {
    paddingTop: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.tiny,
  },
  tlfRowAvatar: {
    marginRight: Styles.globalMargins.tiny,
  },
  tlfTopLine: {
    justifyContent: 'space-between',
  },
  tlfTime: {
    marginRight: Styles.globalMargins.tiny,
  },
  tlfParticipants: {
    fontSize: 12,
  },
  fileUpdateRow: {
    marginTop: Styles.globalMargins.xtiny,
    alignItems: 'center',
  },
  fileUpdateName: Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
  toggleButton: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.black_05,
      borderRadius: 19,
      marginBottom: Styles.globalMargins.xtiny,
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
  iconBadge: {
    width: 12,
    height: 12,
  },
  iconBadgeBox: {
    marginLeft: -12,
    marginRight: 12,
    marginTop: 12,
    width: 0,
    zIndex: 100,
  },
})
