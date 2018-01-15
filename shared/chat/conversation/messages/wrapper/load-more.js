// @flow
import * as React from 'react'
import {Text, Box, Icon} from '../../../../common-adapters'
import {globalStyles, isMobile} from '../../../../styles'
// import CreateTeamNotice from '../notices/create-team-notice/container'
// // TODO

type Props = {
  type: 'noMoreToLoad' | 'moreToLoad',
  // showTeamOffer: boolean,
}

class MessageLoadingMore extends React.PureComponent<Props> {
  render() {
    return (
      <Box>
        <Box style={secureStyle}>
          {this.props.type === 'noMoreToLoad' && (
            <Icon type={isMobile ? 'icon-secure-static-266' : 'icon-secure-266'} />
          )}
        </Box>
        {/*
    showTeamOffer &&
    <Box style={moreStyle}><CreateTeamNotice /></Box> */}
        <Box style={this.props.type === 'moreToLoad' ? moreStyle : noneStyle}>
          <Text type="BodySmallSemibold">ヽ(ಠ益ಠ)ノ</Text>
          <Text type="BodySmallSemibold">Digging ancient messages...</Text>
        </Box>
      </Box>
    )
  }
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
