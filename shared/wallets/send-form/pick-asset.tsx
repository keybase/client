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

const AssetList = ({accountID, isSender}) => {
  const dispatch = Container.useDispatch()
  const acceptedAssets = Container.useSelector(state =>
    state.wallets.trustline.acceptedAssets.get(accountID, Constants.emptyAccountAcceptedAssets)
  )
  const assetMap = Container.useSelector(state => state.wallets.trustline.assetMap)
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
  const selectedAssetID = Types.assetDescriptionToAssetID(
    Container.useSelector(state =>
      isSender ? state.wallets.buildingAdvanced.senderAsset : state.wallets.buildingAdvanced.recipientAsset
    )
  )
  return (
    <Kb.BoxGrow>
      <Kb.List2
        items={acceptedAssets
          .keySeq()
          .toArray()
          .map(assetID => ({
            asset: assetMap.get(assetID, Constants.emptyAssetDescription),
            selected: assetID === selectedAssetID,
          }))}
        bounces={true}
        itemHeight={{
          height: 56, // TODO figure out desktop
          type: 'fixed',
        }}
        renderItem={(index, {asset, selected}) => {
          return (
            <Kb.ClickableBox onClick={() => onSelect(asset)} style={styles.itemContainer}>
              <Kb.Box2 direction="vertical" style={Styles.globalStyles.flexGrow}>
                <Kb.Text
                  type="BodyExtrabold"
                  lineClamp={1}
                  ellipsizeMode="tail"
                  style={selected && styles.textSelected}
                >
                  {asset.code}
                </Kb.Text>
                <Kb.Text
                  type="BodySmall"
                  lineClamp={1}
                  ellipsizeMode="middle"
                  style={selected && styles.textSelected}
                >
                  {asset.issuerVerifiedDomain || asset.issuerAccountID}
                </Kb.Text>
              </Kb.Box2>
              {!!selected && <Kb.Icon type="iconfont-check" color={Styles.globalColors.blueDark} />}
            </Kb.ClickableBox>
          )
        }}
      />
    </Kb.BoxGrow>
  )
}

const PickAsset = (props: Props) => {
  const accountID = props.navigation.getParam('accountID')
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
        <AssetList accountID={accountID} isSender={isSender} />
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
    ...Styles.globalStyles.fullWidth,
    alignItems: 'center',
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
  },
  textSelected: {
    color: Styles.globalColors.blueDark,
  },
})
