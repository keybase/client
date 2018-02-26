// @flow
import * as React from 'react'
import {Text, Box, Icon} from '../../../../common-adapters'
import {globalStyles, globalMargins, isMobile} from '../../../../styles'
import CreateTeamNotice from '../system-create-team-notice/container'

type Props = {
  type: 'noMoreToLoad' | 'moreToLoad',
  showTeamOffer: boolean,
}

class MessageLoadingMore extends React.PureComponent<Props> {
  render() {
    return (
      <Box style={containerStyle}>
        {this.props.type === 'noMoreToLoad' && (
          <Box style={secureStyle}>
            <Icon type={isMobile ? 'icon-secure-static-266' : 'icon-secure-266'} />
          </Box>
        )}
        {this.props.showTeamOffer && (
          <Box style={moreStyle}>
            <CreateTeamNotice />
          </Box>
        )}
        <Box style={this.props.type === 'moreToLoad' ? moreStyle : noneStyle}>
          <Text type="BodySmallSemibold">ヽ(ಠ益ಠ)ノ</Text>
          <Text type="BodySmallSemibold">Digging ancient messages...</Text>
        </Box>
      </Box>
    )
  }
}

const containerStyle = {
  paddingTop: globalMargins.small,
}

const secureStyle = {
  ...globalStyles.flexBoxCenter,
  height: 116,
}

const moreStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
}

const noneStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  opacity: 0,
}

export default MessageLoadingMore
