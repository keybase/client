import * as React from 'react'
import QRScan from '.'
import logger from '../../logger'
import * as Container from '../../util/container'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'

const QRContainer = () => {
  const dispatch = Container.useDispatch()
  const _onSubmitCode = React.useCallback(
    (to: string | null) => {
      if (to) {
        if (to.startsWith('web+stellar:')) {
          // Switch from the send form to the SEP7 handler.
          dispatch(WalletsGen.createValidateSEP7Link({fromQR: true, link: to}))
          dispatch(WalletsGen.createClearBuilding())
        } else {
          // Just a plain address.
          dispatch(WalletsGen.createSetBuildingRecipientType({recipientType: 'stellarPublicKey'}))
          dispatch(WalletsGen.createSetBuildingTo({to}))
        }
      } else {
        logger.warn('QrScan.onSubmitCode: No `to` field for QRScan')
      }
      dispatch(RouteTreeGen.createNavigateUp())
    },
    [dispatch]
  )

  const safeOnSubmitCode = Container.useSafeSubmit(_onSubmitCode, false)
  return <QRScan onSubmitCode={safeOnSubmitCode} />
}
export default QRContainer
