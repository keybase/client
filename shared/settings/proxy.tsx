import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {useSettingsState} from '@/stores/settings'

const useConnect = () => {
  const allowTlsMitmToggle = useSettingsState(s => s.didToggleCertificatePinning)
  const setDidToggleCertificatePinning = useSettingsState(s => s.dispatch.setDidToggleCertificatePinning)
  const proxyData = useSettingsState(s => s.proxyData)
  const saveProxyData = useSettingsState(s => s.dispatch.setProxyData)
  const loadProxyData = useSettingsState(s => s.dispatch.loadProxyData)
  const resetCertPinningToggle = () => {
    setDidToggleCertificatePinning()
  }
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onBack = () => {
    navigateAppend('login')
  }
  const onDisableCertPinning = () => {
    navigateAppend('disableCertPinningModal')
  }
  const onEnableCertPinning = () => {
    setDidToggleCertificatePinning(false)
  }
  const props = {
    allowTlsMitmToggle,
    loadProxyData,
    onBack,
    onDisableCertPinning,
    onEnableCertPinning,
    proxyData,
    resetCertPinningToggle,
    saveProxyData,
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
  loadProxyData: () => void
  resetCertPinningToggle: () => void
  allowTlsMitmToggle?: boolean
  onBack: () => void
  onDisableCertPinning: () => void
  onEnableCertPinning: () => void
  proxyData?: T.RPCGen.ProxyData
  saveProxyData: (proxyData: T.RPCGen.ProxyData) => void
}

const ProxySettingsComponent = (props: Props) => {
  const {loadProxyData, resetCertPinningToggle, proxyData} = props
  const [address, setAddress] = React.useState('')
  const [port, setPort] = React.useState('')
  const [proxyType, setProxyType] = React.useState<'noProxy' | 'httpConnect' | 'socks'>('noProxy')

  React.useEffect(() => {
    loadProxyData()
  }, [loadProxyData])

  React.useEffect(() => {
    return () => {
      resetCertPinningToggle()
    }
  }, [resetCertPinningToggle])

  const lastProxyDataRef = React.useRef(proxyData)
  React.useEffect(() => {
    if (lastProxyDataRef.current !== proxyData) {
      if (proxyData) {
        const addressPort = proxyData.addressWithPort.split(':')
        const newAddress = addressPort.slice(0, addressPort.length - 1).join(':')
        const newPort = addressPort.length >= 2 ? (addressPort.at(-1) ?? '') : '8080'
        const newProxyType = T.RPCGen.ProxyType[proxyData.proxyType] as typeof proxyType

        setAddress(newAddress)
        setPort(newPort)
        setProxyType(newProxyType)
      }
    }
    lastProxyDataRef.current = proxyData
  }, [proxyData])

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

  const saveProxySettings = () => {
    const proxyData = {
      addressWithPort: address + ':' + port,
      certPinning: certPinning(),
      proxyType: T.RPCGen.ProxyType[proxyType],
    }
    props.saveProxyData(proxyData)
  }

  const proxyTypeSelected = (newProxyType: typeof proxyType) => {
    setProxyType(newProxyType)
    if (newProxyType === 'noProxy') {
      saveProxySettings()
    }
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
          <Kb.NewInput placeholder="127.0.0.1" onChangeText={setAddress} value={address} />
          <Kb.Text type="BodySmall">Proxy Port</Kb.Text>
          <Kb.NewInput placeholder="8080" onChangeText={setPort} value={port} />
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
  if (Kb.Styles.isMobile) {
    return (
      <Kb.HeaderHocWrapper onBack={props.onBack}>
        <Kb.Box style={styles.popupBox}>
          <Kb.Box style={styles.proxySettingPopupBox}>
            <ProxySettingsComponent {...props} />
          </Kb.Box>
        </Kb.Box>
      </Kb.HeaderHocWrapper>
    )
  }
  return (
    <Kb.PopupDialog>
      <Kb.Box style={styles.popupBox}>
        <Kb.BackButton onClick={props.onBack} />
        <Kb.Box style={styles.proxySettingPopupBox}>
          <ProxySettingsComponent {...props} />
        </Kb.Box>
      </Kb.Box>
    </Kb.PopupDialog>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  divider: {
    marginTop: Kb.Styles.globalMargins.xsmall,
    width: '100%',
  },
  flexButtons: {
    display: 'flex',
    flexShrink: 0,
    flexWrap: 'wrap',
    marginTop: Kb.Styles.globalMargins.tiny,
  },
  popupBox: {
    minHeight: '40%',
    padding: Kb.Styles.globalMargins.small,
  },
  proxyContainer: {
    ...Kb.Styles.globalStyles.flexBoxColumn,
    alignItems: 'flex-start',
    paddingBottom: Kb.Styles.globalMargins.medium,
    paddingTop: Kb.Styles.globalMargins.medium,
  },
  proxySetting: {marginBottom: Kb.Styles.globalMargins.small},
  proxySettingPopupBox: {padding: Kb.Styles.globalMargins.xlarge},
  radioButton: {marginRight: Kb.Styles.globalMargins.medium},
  text: Kb.Styles.platformStyles({
    isElectron: {
      cursor: 'default',
    },
  }),
}))

export {ProxySettings}
export default Container
