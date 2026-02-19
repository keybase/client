import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as Wallets from '@/stores/wallets'
import {useState as useWalletsState} from '@/stores/wallets'

const Row = (p: {account: Wallets.Account}) => {
  const {account} = p
  const {name, accountID, deviceReadOnly, balanceDescription, isDefault} = account
  const [sk, setSK] = React.useState('')
  const [err, setErr] = React.useState('')
  const getSecretKey = C.useRPC(T.RPCStellar.localGetWalletAccountSecretKeyLocalRpcPromise)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onRemove = React.useCallback(() => {
    navigateAppend({props: {accountID}, selected: 'removeAccount'})
  }, [navigateAppend, accountID])
  const onCopied = React.useCallback(() => {
    setSK('')
    setErr('')
  }, [])
  const onReveal = React.useCallback(() => {
    setErr('')
    setSK('')
    getSecretKey(
      [{accountID}],
      r => {
        setSK(r)
      },
      e => {
        setErr(e.desc)
      }
    )
  }, [getSecretKey, accountID])

  return (
    <Kb.Box2
      direction="vertical"
      alignSelf="flex-start"
      alignItems="flex-start"
      style={styles.row}
      fullWidth={Kb.Styles.isMobile}
    >
      <Kb.Text3 type="BodyBold">
        {name}
        {isDefault ? ' (default)' : ''}
      </Kb.Text3>
      <Kb.Box2
        direction="vertical"
        gap="tiny"
        fullWidth={true}
        style={styles.rowContents}
        alignItems="flex-start"
      >
        <Kb.Box2
          direction="horizontal"
          alignItems="center"
          gap={Kb.Styles.isMobile ? undefined : 'tiny'}
          style={styles.idContainer}
        >
          <Kb.Text3 type="Body" title={accountID} lineClamp={1} style={styles.accountID}>
            ID:
          </Kb.Text3>
          <Kb.BoxGrow2 style={styles.idCopy}>
            <Kb.CopyText withReveal={false} text={accountID} />
          </Kb.BoxGrow2>
        </Kb.Box2>
        <Kb.Text3 type="BodyBold" lineClamp={1}>
          Balance: {balanceDescription}
        </Kb.Text3>
        <Kb.Box2
          direction="horizontal"
          gap="small"
          alignSelf="flex-start"
          alignItems="center"
          style={styles.reveal}
          fullWidth={true}
        >
          <Kb.Text3 type="BodySmallSemibold" style={styles.label}>
            Secret key
          </Kb.Text3>
          {deviceReadOnly ? (
            <Kb.Text3 type="Body">
              You can only view your secret key on mobile devices because this is a mobile-only account.
            </Kb.Text3>
          ) : (
            <Kb.CopyText
              containerStyle={styles.copyText}
              multiline={true}
              withReveal={true}
              loadText={onReveal}
              hideOnCopy={true}
              onCopy={onCopied}
              text={sk}
              placeholderText="fetching and decrypting secret key..."
            />
          )}
        </Kb.Box2>
        {err ? <Kb.Text3 type="Body">Error: {err}</Kb.Text3> : null}
      </Kb.Box2>
      <Kb.Button
        type="Danger"
        label={isDefault ? "Can't remove default" : 'Remove account'}
        onClick={onRemove}
        small={true}
        style={styles.remove}
        disabled={isDefault}
      />
    </Kb.Box2>
  )
}

const Container = () => {
  const [acceptedDisclaimer, setAcceptedDisclaimer] = React.useState(false)
  const checkDisclaimer = C.useRPC(T.RPCStellar.localHasAcceptedDisclaimerLocalRpcPromise)

  const load = useWalletsState(s => s.dispatch.load)

  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      load()
      checkDisclaimer(
        [undefined, Wallets.loadAccountsWaitingKey],
        r => {
          setAcceptedDisclaimer(r)
        },
        () => {
          setAcceptedDisclaimer(false)
        }
      )
      return () => {}
    }, [load, checkDisclaimer])
  )

  const accountMap = useWalletsState(s => s.accountMap)
  const accounts = React.useMemo(() => {
    return [...accountMap.values()].sort((a, b) => {
      if (a.isDefault) return -1
      if (b.isDefault) return 1
      return a.name < b.name ? -1 : 1
    })
  }, [accountMap])

  const loading = C.Waiting.useAnyWaiting(Wallets.loadAccountsWaitingKey)

  const rows = accounts.map((a, idx) => <Row account={a} key={String(idx)} />)

  return (
    <Kb.ScrollView style={styles.scroll}>
      <Kb.Box2 direction="vertical" gap="small" fullWidth={true} style={styles.container}>
        {loading ? <Kb.ProgressIndicator /> : null}
        <Kb.Text3 type="BodyBig">Stellar Transactions Are No Longer Supported in the Keybase App</Kb.Text3>
        {acceptedDisclaimer ? (
          <>
            <Kb.Text3 type="Body">
              Please export your stellar balances to alternative wallets using your secret keys below.
            </Kb.Text3>
            <Kb.Banner color="yellow" inline={true}>
              Only paste your secret key in 100% safe places. Anyone with this key could steal your Stellar
              account.
            </Kb.Banner>
          </>
        ) : (
          <Kb.Text3 type="Body">
            It looks like you never setup your Stellar wallet, enjoy this empty space for a little while
          </Kb.Text3>
        )}
        {acceptedDisclaimer ? rows : null}
      </Kb.Box2>
    </Kb.ScrollView>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      accountID: Kb.Styles.platformStyles({
        isElectron: {wordBreak: 'break-all'},
      }),
      container: {padding: Kb.Styles.globalMargins.small},
      copyText: Kb.Styles.platformStyles({
        isMobile: {
          flexShrink: 1,
          width: '100%',
        },
      }),
      idContainer: {
        alignSelf: 'flex-start',
        flexGrow: 1,
        maxWidth: Kb.Styles.isMobile ? undefined : 400,
        width: '100%',
      },
      idCopy: {height: 40},
      label: {flexShrink: 0},
      remove: {alignSelf: 'flex-end'},
      reveal: {
        maxWidth: Kb.Styles.isMobile ? undefined : 400,
        width: Kb.Styles.isMobile ? undefined : '100%',
      },
      row: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.blueGreyLight,
          borderRadius: Kb.Styles.borderRadius,
          flexShrink: 0,
        },
        isElectron: {
          padding: 8,
          width: '75%',
        },
        isMobile: {
          padding: 3,
        },
      }),
      rowContents: {
        padding: 8,
      },
      scroll: {flexGrow: 1},
    }) as const
)

export default Container
