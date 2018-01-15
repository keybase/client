// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import UserNotice from '../../notices/user-notice'
import {Box, Text} from '../../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../../styles'
import {formatTimeForMessages} from '../../../../util/timestamp'

type Props = {
  message: Types.MessageSystemGitPush,
}

class GitPush extends React.PureComponent<Props> {
  render() {
    const {team, timestamp, repo, refs, pusher} = this.props.message
    return (
      <UserNotice teamname={team} style={{marginTop: globalMargins.small}} bgColor={globalColors.blue4}>
        <Text type="BodySmallSemibold" backgroundMode="Announcements" style={{color: globalColors.black_40}}>
          {formatTimeForMessages(timestamp)}
        </Text>
        <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
          <Text type="BodySmallSemibold" style={{textAlign: 'center'}}>
            {pusher} just pushed commits to the {repo} repo.
          </Text>
          {refs.map(ref => (
            <Box style={globalStyles.flexBoxColumn} key={ref.refName}>
              <Text type="Header" style={{textAlign: 'left'}}>
                {ref.refName}
              </Text>
              {(ref.commits || []).map(commit => (
                <Text type="BodySmall" style={{textAlign: 'left'}} key={commit.commitHash}>
                  {commit.commitHash} {commit.message}
                </Text>
              ))}
            </Box>
          ))}
        </Box>
      </UserNotice>
    )
  }
}

export default GitPush
