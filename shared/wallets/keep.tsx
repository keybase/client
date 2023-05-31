import * as React from 'react'
import * as Kb from '../common-adapters'
import * as WalletsGen from '../actions/wallets-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Styles from '../styles'
import * as Container from '../util/container'
import * as RPCStellarTypes from '../constants/types/rpc-stellar-gen'
import * as Constants from '../constants/wallets'
import type * as Types from '../constants/types/wallets'
import {useFocusEffect} from '@react-navigation/native'
import shallowEqual from 'shallowequal'

const Row = (p: {account: Types.Account}) => {
  const {account} = p
  const {name, accountID, deviceReadOnly, balanceDescription, isDefault} = account
  const [sk, setSK] = React.useState('')
  const [err, setErr] = React.useState('')
  const getSecretKey = Container.useRPC(RPCStellarTypes.localGetWalletAccountSecretKeyLocalRpcPromise)
  const dispatch = Container.useDispatch()
  const onRemove = React.useCallback(() => {
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {accountID}, selected: 'removeAccount'}]}))
  }, [dispatch, accountID])
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
        setErr(e?.desc)
      }
    )
  }, [getSecretKey, accountID])

  return (
    <Kb.Box2
      direction="vertical"
      alignSelf="flex-start"
      alignItems="flex-start"
      style={styles.row}
      fullWidth={Styles.isMobile}
    >
      <Kb.Text type="BodyBold">
        {name}
        {isDefault ? ' (default)' : ''}
      </Kb.Text>
      <Kb.Box2
        direction="vertical"
        gap="tiny"
        fullWidth={true}
        style={styles.rowContents}
        alignItems="flex-start"
      >
        <Kb.Text type="Body" title={accountID} lineClamp={1} style={styles.accountID}>
          ID: {accountID}
        </Kb.Text>
        <Kb.Text type="Body" lineClamp={1}>
          Balance: {balanceDescription}
        </Kb.Text>
        <Kb.Box2
          direction="horizontal"
          gap="small"
          alignSelf="flex-start"
          alignItems="center"
          style={styles.reveal}
          fullWidth={true}
        >
          <Kb.Text type="BodySmallSemibold" style={styles.label}>
            Secret key
          </Kb.Text>
          {deviceReadOnly ? (
            <Kb.Text type="Body">
              You can only view your secret key on mobile devices because this is a mobile-only account.
            </Kb.Text>
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
        {err ? <Kb.Text type="Body">Error: {err}</Kb.Text> : null}
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

export default () => {
  const dispatch = Container.useDispatch()
  const [acceptedDisclaimer, setAcceptedDisclaimer] = React.useState(false)
  const checkDisclaimer = Container.useRPC(RPCStellarTypes.localHasAcceptedDisclaimerLocalRpcPromise)

  useFocusEffect(
    React.useCallback(() => {
      dispatch(WalletsGen.createLoadAccounts({reason: 'initial-load'}))
      checkDisclaimer(
        [undefined, Constants.loadAccountsWaitingKey],
        r => {
          setAcceptedDisclaimer(r)
        },
        () => {
          setAcceptedDisclaimer(false)
        }
      )
      return () => {}
    }, [dispatch, checkDisclaimer])
  )

  const accounts = Container.useSelector(state => {
    return [...state.wallets.accountMap.values()].sort((a, b) => {
      if (a.isDefault) return -1
      if (b.isDefault) return 1
      return a.name < b.name ? -1 : 1
    })
  }, shallowEqual)

  const loading = Container.useSelector(state =>
    Container.anyWaiting(state, Constants.loadAccountsWaitingKey)
  )

  const rows = accounts.map((a, idx) => <Row account={a} key={String(idx)} />)

  return (
    <Kb.ScrollView style={styles.scroll}>
      <Kb.Box2 direction="vertical" gap="small" fullWidth={true} style={styles.container}>
        {loading ? <Kb.ProgressIndicator /> : null}
        <Kb.Text type="BodyBig">Stellar Wallets are no longer supported in Keybase</Kb.Text>
        {acceptedDisclaimer ? (
          <>
            <Kb.Text type="Body">
              If you have created a Stellar wallet in Keybase you can access your private keys below. In the
              near future transactions through the Keybase app will stop functioning. Export your private keys
              and import them in other Stellar wallets.
            </Kb.Text>
            <Kb.Banner color="yellow" inline={true}>
              Only paste your secret key in 100% safe places. Anyone with this key could steal your Stellar
              account.
            </Kb.Banner>
          </>
        ) : (
          <Kb.Text type="Body">
            It looks like you never setup your Stellar wallet, enjoy this empty space for a little while
          </Kb.Text>
        )}
        {acceptedDisclaimer ? rows : null}
      </Kb.Box2>
    </Kb.ScrollView>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      accountID: Styles.platformStyles({
        isElectron: {wordBreak: 'break-all'},
      }),
      container: {padding: Styles.globalMargins.small},
      copyText: Styles.platformStyles({
        isMobile: {
          flexShrink: 1,
          width: '100%',
        },
      }),
      label: {flexShrink: 0},
      remove: {alignSelf: 'flex-end'},
      reveal: {width: Styles.isMobile ? undefined : '75%'},
      row: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.blueGreyLight,
          borderRadius: Styles.borderRadius,
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
    } as const)
)
