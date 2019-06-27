import * as React from 'react'
import * as Types from '../../constants/types/wallets'
import * as Constants from '../../constants/wallets'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import Header from './header'

type Props = Container.RouteProps<
  {
    // ignored if username is set or isSender===true
    accountID: string
    // ignored if isSender===true; if empty, we assume this is for a non-keybaseUser account and just say "this account"
    username: string
    isSender: boolean
  },
  {}
>

const Item = ({assetID, selected, isSender}) => {
  const assetMap = Container.useSelector(state => state.wallets.trustline.assetMap)
  const asset = assetID === 'XLM' ? 'native' : assetMap.get(assetID, Constants.emptyAssetDescription)
  const dispatch = Container.useDispatch()
  const onSelect = React.useCallback(
    asset => {
      dispatch(
        isSender
          ? WalletsGen.createSetBuildingAdvancedSenderAsset({senderAsset: asset})
          : WalletsGen.createSetBuildingAdvancedRecipientAsset({recipientAsset: asset})
      )
      !Styles.isMobile && dispatch(RouteTreeGen.createNavigateUp())
    },
    [dispatch, isSender]
  )
  return (
    <Kb.ClickableBox onClick={() => onSelect(asset)} style={styles.itemContainer}>
      <Kb.Box2 direction="vertical" style={Styles.globalStyles.flexGrow}>
        <Kb.Text
          type="BodyExtrabold"
          lineClamp={1}
          ellipsizeMode="tail"
          style={selected && styles.textSelected}
        >
          {asset === 'native' ? 'XLM' : asset.code}
        </Kb.Text>
        {asset !== 'native' && (
          <Kb.Text
            type="BodySmall"
            lineClamp={1}
            ellipsizeMode="middle"
            style={selected && styles.textSelected}
          >
            {asset.issuerVerifiedDomain || asset.issuerAccountID}
          </Kb.Text>
        )}
      </Kb.Box2>
      {!!selected && <Kb.Icon type="iconfont-check" color={Styles.globalColors.blueDark} />}
    </Kb.ClickableBox>
  )
}

const AssetList = ({accountID, isSender, username}) => {
  const acceptedAssets = Container.useSelector(state =>
    username
      ? state.wallets.trustline.acceptedAssetsByUsername.get(username, Constants.emptyAccountAcceptedAssets)
      : state.wallets.trustline.acceptedAssets.get(accountID, Constants.emptyAccountAcceptedAssets)
  )
  const selectedAsset = Container.useSelector(state =>
    isSender ? state.wallets.buildingAdvanced.senderAsset : state.wallets.buildingAdvanced.recipientAsset
  )
  const selectedAssetID = selectedAsset !== 'native' && Types.assetDescriptionToAssetID(selectedAsset)
  const dispatch = Container.useDispatch()
  React.useEffect(() => {
    username
      ? dispatch(WalletsGen.createRefreshTrustlineAcceptedAssetsByUsername({username}))
      : dispatch(WalletsGen.createRefreshTrustlineAcceptedAssets({accountID}))
  }, [dispatch, username, accountID])
  const items = acceptedAssets
    .keySeq()
    .toArray()
    .map(assetID => ({
      assetID,
      key: assetID,
      selected: assetID === selectedAssetID,
    }))
  const itemsAmended = [
    ...items.slice(0, 1),
    {assetID: 'XLM', key: ' XLM', selected: selectedAsset === 'native'},
  ]
  const json = JSON.stringify(itemsAmended)
  const jsonLiteral =
    '[{"assetID":"GBSTRUSD7IRX73RQZBL3RQUH6KS3O4NYFY3QCALDLZD77XMZOPWAVTUK-USD","key":"GBSTRUSD7IRX73RQZBL3RQUH6KS3O4NYFY3QCALDLZD77XMZOPWAVTUK-USD","selected":false},{"assetID":"XLM","key":" XLM","selected":false}]'
  const parsedJson = JSON.parse(json)
  const parsedJsonLiteral = JSON.parse(jsonLiteral)
  console.log({
    songgao: 'AssetList',
    items,
    itemsAmended,
    json,
    jsonLiteral,
    parsedJson,
    parsedJsonLiteral,
    equal: json === jsonLiteral,
  })
  return (
    <Kb.BoxGrow>
      <Kb.List2
        items={
          parsedJsonLiteral /* SONGGAO-for-NOJIMA: this works. `parsedJson` doesn't*/ || [
            /*
          ...acceptedAssets
            .keySeq()
            .toArray()
            .map(assetID => ({
              assetID,
              key: assetID,
              selected: assetID === selectedAssetID,
            })),
           */
            ...items,
            {
              assetID: 'GBSTRUSD7IRX73RQZBL3RQUH6KS3O4NYFY3QCALDLZD77XMZOPWAVTUK-USD',
              key: 'GBSTRUSD7IRX73RQZBL3RQUH6KS3O4NYFY3QCALDLZD77XMZOPWAVTUK-USD',
              selected: false,
            },
            {
              assetID: 'GDSVWEA7XV6M5XNLODVTPCGMAJTNBLZBXOFNQD3BNPNYALEYBNT6CE2V-WSD',
              key: 'GDSVWEA7XV6M5XNLODVTPCGMAJTNBLZBXOFNQD3BNPNYALEYBNT6CE2V-WSD',
              selected: false,
            },
            {
              assetID: 'GDUKMGUGDZQK6YHYA5Z6AY2G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEX-USD',
              key: 'GDUKMGUGDZQK6YHYA5Z6AY2G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEX-USD',
              selected: false,
            },
            {assetID: 'XLM', key: ' XLM', selected: selectedAsset === 'native'},
          ]
        }
        bounces={true}
        itemHeight={{
          height: 56, // TODO figure out desktop
          type: 'fixed',
        }}
        renderItem={(index, {assetID, selected}) => {
          return <Item assetID={assetID} isSelder={isSender} selected={selected} />
        }}
        keyProperty="key"
      />
    </Kb.BoxGrow>
  )
}

const PickAsset = (props: Props) => {
  const accountID = props.navigation.getParam('accountID') || Types.noAccountID
  const isSender = props.navigation.getParam('isSender')
  const username = props.navigation.getParam('username')

  const dispatch = Container.useDispatch()
  const onBack = React.useCallback(() => dispatch(RouteTreeGen.createNavigateUp()), [dispatch])
  const onClose = React.useCallback(() => dispatch(RouteTreeGen.createClearModals()), [dispatch])
  return (
    <Kb.MaybePopup onClose={onClose}>
      <Kb.Box2 direction="vertical" style={styles.container}>
        <Header isRequest={false} onBack={onBack} whiteBackground={true}>
          {isSender ? (
            <Kb.Text type="BodyTinySemibold">You can send</Kb.Text>
          ) : username ? (
            <Kb.Box2 direction="horizontal" gap="xtiny">
              <Kb.ConnectedUsernames
                type="BodyTinySemibold"
                usernames={[username]}
                colorBroken={true}
                colorFollowing={true}
                underline={false}
              />
              <Kb.Text type="BodyTinySemibold">can receive</Kb.Text>
            </Kb.Box2>
          ) : (
            <Kb.Text type="BodyTinySemibold">This account can receive</Kb.Text>
          )}
        </Header>
        <AssetList accountID={accountID} username={username} isSender={isSender} />
      </Kb.Box2>
    </Kb.MaybePopup>
  )
}

export default PickAsset

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      height: 560,
      width: 400,
    },
    isMobile: {
      flex: 1,
      width: '100%',
    },
  }),
  itemContainer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
    width: '100%',
    height: 56,
  },
  textSelected: {
    color: Styles.globalColors.blueDark,
  },
})
