import * as React from 'react'
import * as Kb from '../../common-adapters/mobile.native'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import * as PushGen from '../../actions/push-gen'
import {connect} from '../../util/container'

type OwnProps = {}
const notificationMonster = require('../../images/illustrations/illustration-turn-on-notifications-460-x-252.png')

export type Props = {
  onEnable: () => void
}

const TurnOnNotifications = (props: Props) => (
  <Kb.Box
    style={{
      ...globalStyles.flexBoxColumn,
      backgroundColor: globalColors.red,
      height: 330,
      overflow: 'hidden',
      position: 'relative',
      width: '100%',
    }}
  >
    <Kb.Box style={{height: 270, left: globalMargins.medium, position: 'absolute', top: -20, width: 250}}>
      <Kb.NativeImage resizeMode="contain" source={notificationMonster} />
    </Kb.Box>
    <Kb.Text
      type="BodySemibold"
      center={true}
      negative={true}
      style={{
        bottom: globalMargins.medium,
        left: globalMargins.small,
        position: 'absolute',
        right: globalMargins.small,
      }}
    >
      You turned off native notifications for Keybase. It’s{' '}
      <Kb.Text type="BodySemiboldItalic" negative={true}>
        very
      </Kb.Text>{' '}
      important you turn them back on.
      {'\n'}
      <Kb.Text onClick={props.onEnable} type="BodySemiboldLink" negative={true}>
        Enable notifications
      </Kb.Text>
    </Kb.Text>
  </Kb.Box>
)

const mapStateToProps = () => ({})

const mapDispatchToProps = dispatch => ({
  onEnable: () => dispatch(PushGen.createRequestPermissions()),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(TurnOnNotifications)
