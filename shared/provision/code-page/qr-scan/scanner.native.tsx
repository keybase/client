import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Styles from '@/styles'
import {CameraView, useCameraPermissions} from 'expo-camera'

type Props = {
  onBarCodeRead: (code: string) => void
  notAuthorizedView: React.ReactElement | null
  style: Styles.StylesCrossPlatform
}

const QRScanner = (p: Props): React.ReactElement | null => {
  const [scanned, setScanned] = React.useState<boolean>(false)
  const [permission, requestPermission] = useCameraPermissions()

  React.useEffect(() => {
    if (!permission) {
      requestPermission()
        .then(() => {})
        .catch(() => {})
    }
  }, [permission, requestPermission])

  if (!permission) {
    return (
      <Kb.Box2 direction="vertical" style={Styles.collapseStyles([p.style, styles.gettingPermissions])} />
    )
  }
  if (!permission.granted) {
    return p.notAuthorizedView || null
  }

  return (
    <CameraView
      barcodeScannerSettings={{barcodeTypes: ['qr']}}
      onBarcodeScanned={({data}) => {
        if (scanned) return
        setScanned(true)
        p.onBarCodeRead(data)
      }}
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
