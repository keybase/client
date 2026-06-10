import * as React from 'react'
import * as Kb from '@/common-adapters'

type Props = {
  onBarCodeRead: (code: string) => void
  notAuthorizedView: React.ReactElement | null
  style: Kb.Styles.StylesCrossPlatform
}

// Hoisted: resolving useCameraPermissions from require() during render makes the react
// compiler bail (hooks must be the same function on every render). The require is
// guarded so it never executes on desktop.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type ExpoCamera = typeof import('expo-camera')
const {CameraView, useCameraPermissions} = isMobile
  ? (require('expo-camera') as ExpoCamera)
  : ({} as Partial<ExpoCamera>)

const QRScannerMobile = (p: Props): React.ReactElement | null => {
  const [scanned, setScanned] = React.useState(false)
  const [permission, requestPermission] = useCameraPermissions!()

  React.useEffect(() => {
    if (!permission) {
      requestPermission()
        .then(() => {})
        .catch(() => {})
    }
  }, [permission, requestPermission])

  if (!permission) {
    return (
      <Kb.Box2 direction="vertical" style={Kb.Styles.collapseStyles([p.style, styles.gettingPermissions])} />
    )
  }
  if (!permission.granted) {
    return p.notAuthorizedView || null
  }
  if (!CameraView) return null

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

const styles = Kb.Styles.styleSheetCreate(() => ({
  gettingPermissions: {
    backgroundColor: Kb.Styles.globalColors.greyLight,
  },
}))

const QRScanner = (p: Props): React.ReactElement | null => {
  if (!isMobile) return null
  return <QRScannerMobile {...p} />
}

export default QRScanner
