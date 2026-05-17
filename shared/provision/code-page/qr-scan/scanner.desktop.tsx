import type * as React from 'react'
import type * as Kb from '@/common-adapters'

type Props = {
  onBarCodeRead: (code: string) => void
  notAuthorizedView: React.ReactElement | null
  style: Kb.Styles.StylesCrossPlatform
}

const QRScanner = (_p: Props): null => null
export default QRScanner
