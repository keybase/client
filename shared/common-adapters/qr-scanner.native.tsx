import * as React from 'react'
import * as Styles from '../styles'
import Text from './text'
import {Box2} from './box'
import {BarCodeScanner} from 'expo-barcode-scanner'
import * as Permissions from 'expo-permissions'

const Kb = {
  Box2,
  Text,
}

type Props = {
  onBarCodeRead: (code: string) => void
  notAuthorizedView: React.ReactNode
  style: Styles.StylesCrossPlatform
}

const QRScanner = (p: Props) => {
  const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | undefined>(undefined)
  const [scanned, setScanned] = React.useState<boolean>(false)

  React.useEffect(() => {
    const getPermissionsGranted = async () => {
      const {status} = await Permissions.askAsync(Permissions.CAMERA)
      setHasCameraPermission(status === 'granted')
    }
    getPermissionsGranted()
  }, [])

  if (hasCameraPermission === undefined) {
    return (
      <Kb.Box2 direction="vertical" style={Styles.collapseStyles([p.style, styles.gettingPermissions])} />
    )
  }
  if (hasCameraPermission === false) {
    return (
      <Kb.Box2 direction="vertical" style={Styles.collapseStyles([p.style, styles.gettingPermissions])}>
        <Kb.Text type="Body">No access to camera</Kb.Text>
      </Kb.Box2>
    )
  }

  return (
    <BarCodeScanner
      onBarCodeScanned={
        scanned
          ? () => {}
          : ({data}) => {
              setScanned(true)
              p.onBarCodeRead(data)
            }
      }
      style={p.style}
    />
  )
}

const styles = Styles.styleSheetCreate({
  gettingPermissions: {
    backgroundColor: Styles.globalColors.greyLight,
  },
})

export default QRScanner
