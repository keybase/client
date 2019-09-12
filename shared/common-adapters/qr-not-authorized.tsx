import * as React from 'react'
import * as ConfigGen from '../actions/config-gen'
import * as Styles from '../styles'
import {namedConnect} from '../util/container'
import Text from './text'
import {Box2} from './box'
import Icon from './icon'

type OwnProps = {}

const QRScanNotAuthorized = ({onOpenSettings}: {onOpenSettings: () => void}) => (
  <Box2 direction="vertical" style={styles.container} gap="tiny">
    <Icon type="iconfont-camera" color={Styles.globalColors.white_40} />
    <Text center={true} type="BodyTiny" style={styles.text}>
      You need to allow access to the camera.
    </Text>
    <Text center={true} type="BodyTiny" onClick={onOpenSettings} style={styles.text} underline={true}>
      Open settings
    </Text>
  </Box2>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        alignItems: 'center',
        backgroundColor: Styles.globalColors.black,
        flexGrow: 1,
        justifyContent: 'center',
      },
      text: {color: Styles.globalColors.white_40},
    } as const)
)

const mapDispatchToProps = dispatch => ({
  onOpenSettings: () => dispatch(ConfigGen.createOpenAppSettings()),
})

export default namedConnect(
  () => ({}),
  mapDispatchToProps,
  (_, dispatchProps, __: OwnProps) => ({
    ...dispatchProps,
  }),
  'QRScanNotAuthorized'
)(QRScanNotAuthorized)
