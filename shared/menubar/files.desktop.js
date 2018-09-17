// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as FsTypes from '../constants/types/fs'
import PathItemIcon from '../fs/common/path-item-icon'
import ConnectedUsernames from '../common-adapters/usernames-remote-container'
// TODO: uncomment once we make this.
// import * as RemoteContainer from '../fs/row/remote-container'

type FileUpdateProps = {|
  name: string,
  onClick: () => void,
|}

type FileUpdatesProps = {|
  updates: Array<FileUpdateProps>,
  moreUpdateCount?: number,
|}

type UserTlfUpdateRowProps = {|
  // TODO: uncomment once we make this.
  // ...$Exact<RemoteContainer.RemoteTlfMeta>,
  tlf: string,
  onSelectPath: () => void,
  iconSpec: FsTypes.PathItemIconSpec,
  writer: string,
  tlfType: FsTypes.TlfType,
  participants: Array<string>,
  teamname: string,
  timestamp: string,
  updates: Array<FileUpdateProps>,
  moreUpdateCount?: number,
|}

type FilesPreviewProps = {|
  onViewAll: () => void,
  userTlfUpdates: Array<UserTlfUpdateRowProps>,
|}

const FileUpdate = (props: FileUpdateProps) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.fileUpdateRow}>
    <Kb.Text type="BodySecondaryLink" onClick={props.onClick}>
      {props.name}
    </Kb.Text>
  </Kb.Box2>
)

const FileUpdates = ({updates, moreUpdateCount}: FileUpdatesProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    {updates.map(u => (
      <FileUpdate key={u.name} {...u} />
    ))}
  </Kb.Box2>
)

const UserTlfUpdateRow = (props: UserTlfUpdateRowProps) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.tlfRowContainer}>
    <PathItemIcon spec={props.iconSpec} style={styles.tlfRowAvatar} />
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.tlfTopLine}>
        <ConnectedUsernames
          usernames={[props.writer]}
          type="BodySemibold"
          clickable={true}
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
        <Kb.Text type="BodySmallInlineLink" style={styles.tlfParticipants} onClick={props.onSelectPath}>
          {props.tlfType === 'team' ? props.teamname : props.participants.join(',')}
        </Kb.Text>
      </Kb.Box2>
      <FileUpdates updates={props.updates} moreUpdateCount={props.moreUpdateCount} />
    </Kb.Box2>
  </Kb.Box2>
)

export const FilesPreview = ({onViewAll, userTlfUpdates}: FilesPreviewProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.tlfContainer}>
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.tlfSectionHeaderContainer}>
      <Kb.Text type="BodySemibold" style={styles.tlfSectionHeader}>
        Recent files
      </Kb.Text>
    </Kb.Box2>
    <Kb.Box2 direction="vertical" fullWidth={true}>
      {userTlfUpdates.map(r => {
        return <UserTlfUpdateRow key={r.tlf + r.writer + r.timestamp} {...r} />
      })}
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  buttonText: {color: Styles.globalColors.black_60},
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
  },
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
      marginLeft: Styles.globalMargins.tiny,
      marginRight: Styles.globalMargins.tiny,
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
    },
  }),
})
