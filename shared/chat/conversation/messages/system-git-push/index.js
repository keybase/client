// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import UserNotice from '../../notices/user-notice'
import {Box, Text, ConnectedUsernames, TimelineMarker} from '../../../../common-adapters'
import {globalStyles, globalColors, globalMargins, isMobile} from '../../../../styles'
import {formatTimeForMessages} from '../../../../util/timestamp'

type Props = {
  message: Types.MessageSystemGitPush,
}
const connectedUsernamesProps = {
  clickable: true,
  colorFollowing: true,
  inline: true,
  type: 'BodySmallSemibold',
}

class GitPush extends React.PureComponent<Props> {
  render() {
    const {team, timestamp, repo, refs, pusher} = this.props.message
    return refs.map(ref => {
      const branchName = ref.refName.split('/')[2]
      return (
        <UserNotice
          teamname={team}
          key={branchName}
          style={{marginTop: globalMargins.small}}
          bgColor={globalColors.blue4}
        >
          <Text
            type="BodySmallSemibold"
            backgroundMode="Announcements"
            style={{color: globalColors.black_40}}
          >
            {formatTimeForMessages(timestamp)}
          </Text>
          <Box style={globalStyles.flexBoxColumn}>
            <Text type="BodySmallSemibold" style={{marginBottom: globalMargins.xtiny, textAlign: 'center'}}>
              <ConnectedUsernames {...connectedUsernamesProps} usernames={[pusher]} /> pushed{' '}
              {!!ref.commits && ref.commits.length}{' '}
              {`commit${!!ref.commits && ref.commits.length !== 1 ? 's' : ''}`} to {`${repo}/${branchName}`}:
            </Text>
            <Box style={globalStyles.flexBoxColumn}>
              {(ref.commits || []).map((commit, i) => (
                <Box style={globalStyles.flexBoxRow} key={commit.commitHash}>
                  <TimelineMarker
                    idx={i}
                    max={ref.commits ? ref.commits.length - 1 : 0}
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
                        style={{
                          color: globalColors.blue,
                          fontSize: 11,
                          lineHeight: isMobile ? 16 : 1.3,
                        }}
                      >
                        {commit.commitHash.substr(0, 8)}
                      </Text>
                    </Box>
                    <Box style={{display: 'flex', flex: 1}}>
                      <Text type="BodySmall" style={{textAlign: 'left'}} lineClamp={2}>
                        {commit.message}
                      </Text>
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </UserNotice>
      )
    })
  }
}

export default GitPush
