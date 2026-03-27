import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import logger from '@/logger'
import type {RPCError} from '@/util/errors'

const useConnect = () => {
  const [allowTlsMitmToggle, setDidToggleCertificatePinning] = React.useState<boolean | undefined>(undefined)
  const [proxyData, setProxyData] = React.useState<T.RPCGen.ProxyData | undefined>(undefined)
  const [showDisableCertPinningWarning, setShowDisableCertPinningWarning] = React.useState(false)
  const loadProxyData = C.useRPC(T.RPCGen.configGetProxyDataRpcPromise)
  const saveProxyData = C.useRPC(T.RPCGen.configSetProxyDataRpcPromise)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onBack = () => {
    navigateAppend('login')
  }
  const onDisableCertPinning = () => {
    setShowDisableCertPinningWarning(true)
  }
  const onCancelDisableCertPinning = () => {
    setShowDisableCertPinningWarning(false)
  }
  const onConfirmDisableCertPinning = () => {
    setDidToggleCertificatePinning(true)
    setShowDisableCertPinningWarning(false)
  }
  const onEnableCertPinning = () => {
    setDidToggleCertificatePinning(false)
  }
  const props = {
    allowTlsMitmToggle,
    loadProxyData,
    onBack,
    onCancelDisableCertPinning,
    onConfirmDisableCertPinning,
    onDisableCertPinning,
    onEnableCertPinning,
    proxyData,
    setProxyData,
    saveProxyData,
    showDisableCertPinningWarning,
  }

  return props
}

// Export the popup as the default export so it is easy to make a route pointing to it
const Container = () => {
  const props = useConnect()
  return <ProxySettingsPopup {...props} />
}

// The proxy settings component used in the advanced settings screen
const ProxySettings = () => {
  const props = useConnect()
  return <ProxySettingsComponent {...props} />
}

// A list so the order of the elements is fixed
const proxyTypeList = ['noProxy', 'httpConnect', 'socks'] as const
const proxyTypeToDisplayName = {
  httpConnect: 'HTTP(s) Connect',
  noProxy: 'No proxy',
  socks: 'SOCKS5',
}

type Props = {
  allowTlsMitmToggle?: boolean
  loadProxyData: (
    args: [undefined],
    setResult: (result: T.RPCGen.ProxyData) => void,
    setError: (error: RPCError) => void
  ) => void
  onBack: () => void
  onCancelDisableCertPinning: () => void
  onConfirmDisableCertPinning: () => void
  onDisableCertPinning: () => void
  onEnableCertPinning: () => void
  proxyData?: T.RPCGen.ProxyData
  saveProxyData: (
    args: [{proxyData: T.RPCGen.ProxyData}],
    setResult: () => void,
    setError: (error: RPCError) => void
  ) => void
  setProxyData: React.Dispatch<React.SetStateAction<T.RPCGen.ProxyData | undefined>>
  showDisableCertPinningWarning: boolean
}

const ProxySettingsComponent = (props: Props) => {
  const {loadProxyData, proxyData, setProxyData} = props
  const [address, setAddress] = React.useState('')
  const [port, setPort] = React.useState('')
  const [proxyType, setProxyType] = React.useState<'noProxy' | 'httpConnect' | 'socks'>('noProxy')

  const applyProxyData = React.useCallback((proxyData_: T.RPCGen.ProxyData) => {
    const addressPort = proxyData_.addressWithPort.split(':')
    const newAddress = addressPort.slice(0, addressPort.length - 1).join(':')
    const newPort = addressPort.length >= 2 ? (addressPort.at(-1) ?? '') : '8080'
    const newProxyType = T.RPCGen.ProxyType[proxyData_.proxyType] as typeof proxyType

    setAddress(newAddress)
    setPort(newPort)
    setProxyType(newProxyType)
  }, [])

  React.useEffect(() => {
    loadProxyData(
      [undefined],
      result => {
        setProxyData(result)
        applyProxyData(result)
      },
      error => {
        logger.warn('Error loading proxy data', error)
      }
    )
  }, [applyProxyData, loadProxyData, setProxyData])

  const lastProxyDataRef = React.useRef(proxyData)
  React.useEffect(() => {
    if (lastProxyDataRef.current !== proxyData) {
      if (proxyData) {
        applyProxyData(proxyData)
      }
    }
    lastProxyDataRef.current = proxyData
  }, [applyProxyData, proxyData])

  const certPinning = (): boolean => {
    if (props.allowTlsMitmToggle === undefined) {
      return props.proxyData ? props.proxyData.certPinning : true
    } else {
      return !props.allowTlsMitmToggle
    }
  }

  const toggleCertPinning = () => {
    if (certPinning()) {
      props.onDisableCertPinning()
    } else {
      props.onEnableCertPinning()
    }
  }

  const saveProxySettings = (nextProxyType = proxyType) => {
    const nextProxyData = {
      addressWithPort: address + ':' + port,
      certPinning: certPinning(),
      proxyType: T.RPCGen.ProxyType[nextProxyType],
    }
    props.saveProxyData(
      [{proxyData: nextProxyData}],
      () => {
        setProxyData(nextProxyData)
      },
      error => {
        logger.warn('Error in saving proxy data', error)
      }
    )
  }

  const proxyTypeSelected = (newProxyType: typeof proxyType) => {
    setProxyType(newProxyType)
    if (newProxyType === 'noProxy') {
      saveProxySettings(newProxyType)
    }
  }

  if (props.showDisableCertPinningWarning) {
    return (
      <Kb.Box2
        direction="vertical"
        centerChildren={true}
        fullWidth={true}
        flex={1}
        gap="small"
        style={styles.warningContainer}
      >
        <Kb.Icon type="iconfont-exclamation" sizeType="Big" color={Kb.Styles.globalColors.red} />
        <Kb.Text center={true} type="Header" style={styles.warningHeader}>
          Are you sure you want to allow TLS interception?
        </Kb.Text>
        <Kb.Text center={true} type="Body" style={styles.warningBody}>
          This means your proxy or your ISP will be able to view all traffic between you and Keybase servers.
          It is not recommended to use this option unless absolutely required.
        </Kb.Text>
        <Kb.ButtonBar>
          <Kb.Button type="Dim" label="Cancel" onClick={props.onCancelDisableCertPinning} />
          <Kb.Button type="Danger" label="Yes, I am sure" onClick={props.onConfirmDisableCertPinning} />
        </Kb.ButtonBar>
      </Kb.Box2>
    )
  }

  return (
    <>
      <Kb.Text type="Header" style={styles.text}>
        Proxy settings
      </Kb.Text>
      {proxyTypeList.map(pt => (
        <Kb.RadioButton
          onSelect={() => proxyTypeSelected(pt)}
          selected={proxyType === pt}
          key={pt}
          label={proxyTypeToDisplayName[pt]}
          style={styles.radioButton}
        />
      ))}
      {proxyType === 'noProxy' ? null : (
        <>
          <Kb.Text type="BodySmall">Proxy Address</Kb.Text>
          <Kb.Input3 placeholder="127.0.0.1" onChangeText={setAddress} value={address} />
          <Kb.Text type="BodySmall">Proxy Port</Kb.Text>
          <Kb.Input3 placeholder="8080" onChangeText={setPort} value={port} />
        </>
      )}
      <Kb.Checkbox
        checked={!certPinning()}
        onCheck={toggleCertPinning}
        label="Allow TLS Interception"
        style={styles.proxySetting}
      />
      <Kb.Button onClick={saveProxySettings} label="Save Proxy Settings" />
    </>
  )
}

const ProxySettingsPopup = (props: Props) => {
  return (
    <>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.popupBox}>
        {!Kb.Styles.isMobile && <Kb.BackButton onClick={props.onBack} />}
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.proxySettingPopupBox}>
          <ProxySettingsComponent {...props} />
        </Kb.Box2>
      </Kb.Box2>
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  popupBox: {
    minHeight: '40%',
    padding: Kb.Styles.globalMargins.small,
  },
  proxySetting: {marginBottom: Kb.Styles.globalMargins.small},
  proxySettingPopupBox: {padding: Kb.Styles.globalMargins.xlarge},
  radioButton: {marginRight: Kb.Styles.globalMargins.medium},
  text: Kb.Styles.platformStyles({
    isElectron: {
      cursor: 'default',
    },
  }),
  warningBody: {maxWidth: 420},
  warningContainer: {padding: Kb.Styles.globalMargins.medium},
  warningHeader: {maxWidth: 420},
}))

export {ProxySettings}
export default Container
