// @flow
import {invert} from 'lodash-es'
import * as React from 'react'
import * as RPCTypes from '../../../../constants/types/rpc-gen'
import * as Types from '../../../../constants/types/chat2'
import UserNotice from '../user-notice'
import {Box, Text, ConnectedUsernames, TimelineMarker, Icon} from '../../../../common-adapters'
import {globalStyles, globalColors, globalMargins, isMobile, platformStyles} from '../../../../styles'
import {formatTimeForMessages} from '../../../../util/timestamp'

const branchRefPrefix = 'refs/heads/'

type Props = {
  message: Types.MessageSystemGitPush,
  onClickUserAvatar: (username: string) => void,
  onViewGitRepo: (repoID: string, teamname: string) => void,
}

// Map [int] -> 'push type string'
const gitPushType = invert(RPCTypes.gitGitPushType)

const connectedUsernamesProps = {
  colorFollowing: true,
  inline: true,
  onUsernameClicked: 'profile',
  type: 'BodySmallSemibold',
  underline: true,
}

const GitPushCreate = ({pusher, repo, repoID, team, onViewGitRepo}) => {
  return (
    <Box style={globalStyles.flexBoxColumn}>
      <Text type="BodySmallSemibold" style={{marginBottom: globalMargins.xtiny, textAlign: 'center'}}>
        <ConnectedUsernames {...connectedUsernamesProps} usernames={[pusher]} />
        {` `} created a new team repository called {` `}
        <Text
          type="BodySmallSemibold"
          style={repoID ? {color: globalColors.black_60} : undefined}
          onClick={repoID ? () => onViewGitRepo(repoID, team) : undefined}
        >
          {repo}
        </Text>
        .
      </Text>
    </Box>
  )
}

const GitPushDefault = ({pusher, commitRef, repo, repoID, team, branchName, onViewGitRepo}) => {
  return (
    <Box style={globalStyles.flexBoxColumn}>
      <Text type="BodySmallSemibold" style={{marginBottom: globalMargins.xtiny, textAlign: 'center'}}>
        <ConnectedUsernames {...connectedUsernamesProps} usernames={[pusher]} /> pushed{' '}
        {!!commitRef.commits && commitRef.commits.length}{' '}
        {`commit${!!commitRef.commits && commitRef.commits.length !== 1 ? 's' : ''}`} to
        <Text
          type="BodySmallSemibold"
          style={repoID ? {color: globalColors.black_60} : undefined}
          onClick={repoID ? () => onViewGitRepo(repoID, team) : undefined}
        >{` ${repo}/${branchName}`}</Text>
        :
      </Text>
      <Box style={globalStyles.flexBoxColumn}>
        {(commitRef.commits || []).map((commit, i) => (
          <Box style={globalStyles.flexBoxRow} key={commit.commitHash}>
            <TimelineMarker
              idx={i}
              max={commitRef.commits ? commitRef.commits.length - 1 : 0}
              style={{marginRight: globalMargins.xtiny, ...(isMobile ? {marginTop: -3} : null)}}
            />
            <Box style={{...globalStyles.flexBoxRow, alignItems: 'flex-start', flex: 1}}>
              <Box
                style={{
                  backgroundColor: globalColors.blue3_20,
                  borderRadius: 3,
                  display: 'flex',
                  height: 18,
                  marginBottom: 1,
                  marginRight: globalMargins.xtiny,
                  padding: 2,
                }}
              >
                <Text
                  type="Terminal"
                  selectable={true}
                  style={platformStyles({
                    common: {
                      color: globalColors.blue,
                      fontSize: 12,
                      lineHeight: 16,
                    },
                  })}
                >
                  {commit.commitHash.substr(0, 8)}
                </Text>
              </Box>
              <Box style={{display: 'flex', flex: 1}}>
                <Text type="BodySmall" selectable={true} style={{textAlign: 'left'}} lineClamp={2}>
                  {commit.message}
                </Text>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

type PushCommonProps = {
  children: React.Node,
  pusher: string,
  timestamp: number,
  onClickUserAvatar: string => void,
}
const GitPushCommon = ({children, pusher, timestamp, onClickUserAvatar}: PushCommonProps) => (
  <UserNotice
    username={pusher}
    style={{marginTop: globalMargins.small}}
    bgColor={globalColors.blue4}
    onClickAvatar={() => onClickUserAvatar(pusher)}
  >
    {!isMobile && <Icon type="icon-team-git-16" style={{marginLeft: 20, marginTop: -12, zIndex: 999}} />}
    <Text type="BodySmallSemibold" backgroundMode="Announcements" style={{color: globalColors.black_40}}>
      {formatTimeForMessages(timestamp)}
    </Text>
    {children}
  </UserNotice>
)

class GitPush extends React.PureComponent<Props> {
  render() {
    const {timestamp, repo, repoID, refs, pushType, pusher, team} = this.props.message

    const gitType = gitPushType[pushType]

    switch (gitType) {
      case 'default':
        return (
          <>
            {refs.map(ref => {
              let branchName = ref.refName
              if (branchName.startsWith(branchRefPrefix)) {
                branchName = branchName.substring(branchRefPrefix.length)
              } // else show full ref
              return (
                <GitPushCommon
                  key={branchName}
                  timestamp={timestamp}
                  pusher={pusher}
                  onClickUserAvatar={this.props.onClickUserAvatar}
                >
                  <GitPushDefault
                    commitRef={ref}
                    branchName={branchName}
                    pusher={pusher}
                    timestamp={timestamp}
                    repo={repo}
                    repoID={repoID}
                    team={team}
                    onViewGitRepo={this.props.onViewGitRepo}
                  />
                </GitPushCommon>
              )
            })}
          </>
        )
      case 'createrepo':
        return (
          <GitPushCommon
            timestamp={timestamp}
            pusher={pusher}
            onClickUserAvatar={this.props.onClickUserAvatar}
          >
            <GitPushCreate
              pusher={pusher}
              timestamp={timestamp}
              repo={repo}
              repoID={repoID}
              team={team}
              onViewGitRepo={this.props.onViewGitRepo}
            />
          </GitPushCommon>
        )
      // FIXME: @Jacob - The service has not implemented 'renamerepo' yet, so we don't render anything
      default:
        return null
    }
  }
}

export default GitPush
