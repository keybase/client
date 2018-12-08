// @flow
import * as React from 'react'
import {Box, Text, NativeImage} from '../../common-adapters/mobile.native'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import * as PushGen from '../../actions/push-gen'
import {connect} from '../../util/container'

type OwnProps = {||}
const notificationMonster = require('../../images/illustrations/illustration-turn-on-notifications-460-x-252.png')

export type Props = {
  onEnable: () => void,
}

const TurnOnNotifications = (props: Props) => (
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      backgroundColor: globalColors.red,
      height: 330,
      overflow: 'hidden',
      position: 'relative',
      width: '100%',
    }}
  >
    <Box style={{height: 270, left: globalMargins.medium, position: 'absolute', top: -20, width: 250}}>
      <NativeImage resizeMode="contain" source={notificationMonster} />
    </Box>
    <Text
      type="BodySemibold"
      backgroundMode="HighRisk"
      style={{
        bottom: globalMargins.medium,
        left: globalMargins.small,
        position: 'absolute',
        right: globalMargins.small,
        textAlign: 'center',
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

const mapDispatchToProps = dispatch => ({
  onEnable: () => dispatch(PushGen.createRequestPermissions()),
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(TurnOnNotifications)
