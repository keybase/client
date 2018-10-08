// @flow
import * as React from 'react'
import {Box, Text, NativeImage} from '../../common-adapters/mobile.native'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import * as PushGen from '../../actions/push-gen'
import {connect} from '../../util/container'

const notificationMonster = require('../../images/illustrations/illustration-turn-on-notifications-460-x-252.png')

export type Props = {
  onEnable: () => void,
}

const TurnOnNotifications = (props: Props) => (
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      position: 'relative',
      width: '100%',
      height: 330,
      backgroundColor: globalColors.red,
      overflow: 'hidden',
    }}
  >
    <Box style={{height: 270, width: 250, position: 'absolute', top: -20, left: globalMargins.medium}}>
      <NativeImage resizeMode="contain" source={notificationMonster} />
    </Box>
    <Text
      type="BodySemibold"
      backgroundMode="HighRisk"
      style={{
        textAlign: 'center',
        position: 'absolute',
        bottom: globalMargins.medium,
        left: globalMargins.small,
        right: globalMargins.small,
      }}
    >
      You turned off native notifications for Keybase. It’s{' '}
      <Text type="BodySemiboldItalic" backgroundMode="HighRisk">
        very
      </Text>{' '}
      important you turn them back on.
      {'\n'}
      <Text onClick={props.onEnable} type="BodySemiboldLink" backgroundMode="HighRisk">
        Enable notifications
      </Text>
    </Text>
  </Box>
)

const mapStateToProps = () => ({})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onEnable: () => dispatch(PushGen.createRequestPermissions()),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(TurnOnNotifications)
