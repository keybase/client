// @flow
import * as React from 'react'
import Text from './text'
import {Box2} from './box'
import Icon from './icon'
import {styleSheetCreate, globalColors} from '../styles'

const QRScanNotAuthorized = ({onOpenSettings}: {onOpenSettings: () => void}) => (
  <Box2 direction="vertical" style={styles.container} gap="tiny">
    <Icon type="iconfont-camera" color={globalColors.white_40} />
    <Text type="BodyTiny" style={styles.text}>
      You need to allow access to the camera.
    </Text>
    <Text type="BodyTiny" onClick={onOpenSettings} style={styles.text} underline={true}>
      Open settings
    </Text>
  </Box2>
)

const styles = styleSheetCreate({
  container: {
    alignItems: 'center',
    backgroundColor: globalColors.black,
    flexGrow: 1,
    justifyContent: 'center',
  },
  text: {
    color: globalColors.white_40,
    textAlign: 'center',
  },
})

export default QRScanNotAuthorized
