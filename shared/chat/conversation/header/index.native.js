// @flow
import React from 'react'
import {BackButton, Box, Icon, Usernames} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../styles'

import type {Props} from '.'

const ConversationHeader = ({
  badgeNumber,
  muted,
  onBack,
  onOpenFolder,
  onShowProfile,
  onToggleInfoPanel,
  users,
}: Props) => (
  <Box style={containerStyle}>
    <BackButton
      badgeNumber={badgeNumber}
      title={null}
      onClick={onBack}
      iconStyle={{color: globalColors.black_40}}
      textStyle={{color: globalColors.blue}}
      style={{flexShrink: 0, padding: globalMargins.tiny}}
    />
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        justifyContent: 'center',
        flex: 1,
        marginTop: 2,
        padding: globalMargins.tiny,
      }}
    >
      <Usernames
        colorFollowing={true}
        inline={false}
        commaColor={globalColors.black_40}
        type="BodyBig"
        users={users}
        containerStyle={styleCenter}
        onUsernameClicked={onShowProfile}
      />
      {muted &&
        <Icon
          type="iconfont-shh"
          style={{...styleCenter, ...styleLeft, color: globalColors.black_20, fontSize: 22}}
        />}
    </Box>
    <Icon
      type="iconfont-info"
      style={{...styleLeft, flexShrink: 0, padding: globalMargins.tiny, fontSize: 21}}
      onClick={onToggleInfoPanel}
    />
  </Box>
)

const containerStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  borderBottomColor: globalColors.black_05,
  borderBottomWidth: 1,
  justifyContent: 'flex-start',
  minHeight: 32,
}

const styleCenter = {
  justifyContent: 'center',
  textAlign: 'center',
}

const styleLeft = {
  marginLeft: globalMargins.xtiny,
}

export default ConversationHeader
