import * as React from 'react'
import * as Types from '../../constants/types/wallets'
import * as Constants from '../../constants/wallets'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import Header from './header'

type Props = Container.RouteProps<{
  // ignored if username is set or isSender===true
  accountID: string
  // ignored if isSender===true; if empty, we assume this is for a non-keybaseUser account and just say "this account"
  username: string
  isSender: boolean
}>

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
  const assetMap = Container.useSelector(state => state.wallets.trustline.assetMap)
  const dispatch = Container.useDispatch()
  const onSelect = React.useCallback(
    asset => {
      dispatch(
        isSender
          ? WalletsGen.createSetBuildingAdvancedSenderAsset({senderAsset: asset})
          : WalletsGen.createSetBuildingAdvancedRecipientAsset({recipientAsset: asset})
      )
      dispatch(RouteTreeGen.createNavigateUp())
    },
    [dispatch, isSender]
  )
  React.useEffect(() => {
    username
      ? dispatch(WalletsGen.createRefreshTrustlineAcceptedAssetsByUsername({username}))
      : dispatch(WalletsGen.createRefreshTrustlineAcceptedAssets({accountID}))
  }, [dispatch, username, accountID])
  return (
    <Kb.BoxGrow>
      <Kb.List2
        items={[
          ...acceptedAssets
            .keySeq()
            .toArray()
            .map(assetID => ({
              assetID,
              key: assetID,
              selected: assetID === selectedAssetID,
            })),
          {assetID: 'XLM', key: ' XLM', selected: selectedAsset === 'native'},
        ]}
        bounces={true}
        itemHeight={{sizeType: 'Small', type: 'fixedListItem2Auto'}}
        renderItem={(_, {assetID, selected}) => {
          const asset = assetID === 'XLM' ? 'native' : assetMap.get(assetID, Constants.emptyAssetDescription)
          return (
            <Kb.ListItem2
              onClick={() => onSelect(asset)}
              type="Small"
              firstItem={true}
              body={
                <Kb.Box2 style={styles.itemContainer} direction="horizontal" alignItems="center">
                  <Kb.Box2 direction="vertical" style={Styles.globalStyles.flexGrow}>
                    <Kb.Text
                      type="BodyExtrabold"
                      lineClamp={1}
                      ellipsizeMode="tail"
                      style={selected ? styles.textSelected : undefined}
                    >
                      {asset === 'native' ? 'XLM' : asset.code}
                    </Kb.Text>
                    <Kb.Text
                      type="BodySmall"
                      lineClamp={1}
                      ellipsizeMode="middle"
                      style={selected ? styles.textSelected : undefined}
                    >
                      {asset === 'native'
                        ? 'Stellar Lumens'
                        : asset.issuerVerifiedDomain || Constants.shortenAccountID(asset.issuerAccountID)}
                    </Kb.Text>
                  </Kb.Box2>
                  {!!selected && <Kb.Icon type="iconfont-check" color={Styles.globalColors.blueDark} />}
                </Kb.Box2>
              }
            />
          )
        }}
        keyProperty="key"
      />
    </Kb.BoxGrow>
  )
}

const PickAsset = (props: Props) => {
  const accountID = Container.getRouteProps(props, 'accountID', Types.noAccountID)
  const isSender = Container.getRouteProps(props, 'isSender', false)
  const username = Container.getRouteProps(props, 'username', '')

  const dispatch = Container.useDispatch()
  const onBack = React.useCallback(() => dispatch(RouteTreeGen.createNavigateUp()), [dispatch])
  const onClose = React.useCallback(() => dispatch(RouteTreeGen.createClearModals()), [dispatch])
  return (
    <Kb.MaybePopup onClose={onClose}>
      <Kb.Box2 direction="vertical" style={styles.container}>
        <Header
          isRequest={false}
          whiteBackground={true}
          onBack={onBack}
          showCancelInsteadOfBackOnMobile={false}
        >
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
  backClickable: {
    bottom: Styles.globalMargins.tiny,
    left: Styles.globalMargins.tiny,
    padding: Styles.globalMargins.xtiny,
    position: 'absolute',
  },
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
    ...Styles.globalStyles.flexGrow,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
  },
  textSelected: {
    color: Styles.globalColors.blueDark,
  },
})
