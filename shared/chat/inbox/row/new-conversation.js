// @flow
import React, {PureComponent} from 'react'
import {Box, Text, Icon} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../styles'

class NewConversation extends PureComponent<{}> {
  render() {
    return (
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          backgroundColor: globalColors.blue,
          flexShrink: 0,
          minHeight: 56,
        }}
      >
        <Box
          style={{
            ...globalStyles.flexBoxRow,
            ...globalStyles.clickable,
            alignItems: 'center',
          }}
        >
          <Box
            style={{
              ...globalStyles.flexBoxRow,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: globalColors.blue2,
              borderRadius: globalMargins.large,
              height: globalMargins.large,
              marginLeft: globalMargins.tiny,
              marginRight: globalMargins.small,
              width: globalMargins.large,
            }}
          >
            <Icon
              type="iconfont-people"
              style={{
                color: globalColors.blue,
                fontSize: 24,
              }}
            />
          </Box>
          <Text style={{color: globalColors.white}} type="BodySemibold">New conversation</Text>
        </Box>
      </Box>
    )
  }
}

export default NewConversation
