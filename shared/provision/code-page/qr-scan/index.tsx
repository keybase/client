import * as Kb from '@/common-adapters'
import QRLines from './lines'
import QRNotAuthorized from './not-authorized'
import QRScanner from './scanner'
import useQR from './hooks'

const QRScan = () => {
  const styles = useStyles()
  const {waiting, onSubmitTextCode} = useQR()

  if (!isMobile) {
    return (
      <Kb.Box2 direction="vertical" justifyContent="center" relative={true} style={styles.container}>
        <QRLines canScan={true} />
        {waiting && <Kb.ProgressIndicator style={styles.waiting} type="Large" white={true} />}
      </Kb.Box2>
    )
  }

  return (
    <Kb.Box2 direction="vertical" relative={true} overflow="hidden" style={styles.container}>
      {!waiting && (
        <QRScanner
          notAuthorizedView={<QRNotAuthorized />}
          onBarCodeRead={(data: string) => onSubmitTextCode(data)}
          style={styles.camera}
        />
      )}
      {!waiting && <QRLines canScan={true} />}
      {waiting && <Kb.ProgressIndicator style={styles.waiting} type="Large" white={true} />}
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(theme => ({
  camera: {
    flexGrow: 1,
  },
  container: Kb.Styles.platformStyles({
    common: {
      alignSelf: 'stretch',
      backgroundColor: theme.black,
    },
    isElectron: {height: 200},
    isMobile: {height: 160},
  }),
  waiting: Kb.Styles.platformStyles({
    isElectron: {alignSelf: 'center'},
    isMobile: {...Kb.Styles.globalStyles.fillAbsolute},
  }),
}))

export default QRScan
