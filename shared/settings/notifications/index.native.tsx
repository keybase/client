import * as Container from '../../util/container'
import * as Kb from '../../common-adapters/mobile.native'
import * as PushGen from '../../actions/push-gen'
import * as Styles from '../../styles'
import Notifications from './render'
import type {Props} from '.'

const MobileNotifications = (props: Props) => {
  return (
    <Kb.ScrollView style={{...Styles.globalStyles.flexBoxColumn, flex: 1}}>
      <TurnOnNotifications />
      <Notifications {...props} />
    </Kb.ScrollView>
  )
}

const TurnOnNotifications = () => {
  const dispatch = Container.useDispatch()
  const mobileHasPermissions = Container.useSelector(state => state.push.hasPermissions)
  if (mobileHasPermissions) return null
  const onEnable = () => dispatch(PushGen.createRequestPermissions())
  return (
    <Kb.Box
      style={{
        ...Styles.globalStyles.flexBoxColumn,
        backgroundColor: Styles.globalColors.red,
        height: 330,
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
      }}
    >
      <Kb.Box
        style={{height: 270, left: Styles.globalMargins.medium, position: 'absolute', top: -20, width: 250}}
      >
        <Kb.Icon type="illustration-turn-on-notifications" />
      </Kb.Box>
      <Kb.Text
        type="BodySemibold"
        center={true}
        negative={true}
        style={{
          bottom: Styles.globalMargins.medium,
          left: Styles.globalMargins.small,
          position: 'absolute',
          right: Styles.globalMargins.small,
        }}
      >
        You turned off native notifications for Keybase. It’s{' '}
        <Kb.Text type="BodySemiboldItalic" negative={true}>
          very
        </Kb.Text>{' '}
        important you turn them back on.
        {'\n'}
        <Kb.Text onClick={onEnable} type="BodySemiboldLink" negative={true}>
          Enable notifications
        </Kb.Text>
      </Kb.Text>
    </Kb.Box>
  )
}

export default MobileNotifications
