import * as C from '@/constants'
import * as React from 'react'
import * as Styles from '@/styles'
import Text from './text'
import {Box2} from './box'
import * as Scanner from 'expo-barcode-scanner'

const Kb = {
  Box2,
  Text,
}

type Props = {
  onBarCodeRead: (code: string) => void
  notAuthorizedView: React.ReactElement | null
  style: Styles.StylesCrossPlatform
}

const QRScanner = (p: Props): React.ReactElement | null => {
  const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | undefined>(undefined)
  const [scanned, setScanned] = React.useState<boolean>(false)

  C.useOnMountOnce(() => {
    const getPermissionsGranted = async () => {
      const {status} = await Scanner.requestPermissionsAsync()
      setHasCameraPermission(status === Scanner.PermissionStatus.GRANTED)
    }
    getPermissionsGranted()
      .then(() => {})
      .catch(() => {})
  })

  if (hasCameraPermission === undefined) {
    return (
      <Kb.Box2 direction="vertical" style={Styles.collapseStyles([p.style, styles.gettingPermissions])} />
    )
  }
  if (!hasCameraPermission) {
    return p.notAuthorizedView || null
  }

  return (
    <Scanner.BarCodeScanner
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

const styles = Styles.styleSheetCreate(() => ({
  gettingPermissions: {
    backgroundColor: Styles.globalColors.greyLight,
  },
}))

export default QRScanner
