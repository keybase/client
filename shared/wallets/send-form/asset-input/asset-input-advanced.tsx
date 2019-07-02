import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Types from '../../../constants/types/wallets'
import * as Constants from '../../../constants/wallets'
import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as WalletsGen from '../../../actions/wallets-gen'
import Available from '../available/container'
import {AmountInput, sharedStyles} from './shared'
import CalculateAdvancedButton from '../calculate-advanced-button'
import PaymentPathCircle, {pathCircleSmallDiameter} from '../../common/payment-path-circle'

type EmptyProps = {}

export const AssetInputRecipientAdvanced = (props: EmptyProps) => {
  const buildingAdvanced = Container.useSelector(state => state.wallets.buildingAdvanced)
  const dispatch = Container.useDispatch()
  const onChangeAmount = React.useCallback(
    recipientAmount => dispatch(WalletsGen.createSetBuildingAdvancedRecipientAmount({recipientAmount})),
    [dispatch]
  )
  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      style={Styles.collapseStyles([sharedStyles.container, styles.container])}
      gap="xtiny"
    >
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.topLabel} gap="xtiny">
        {buildingAdvanced.recipientType === 'keybaseUser' ? (
          <>
            <Kb.Avatar username={buildingAdvanced.recipient} size={16} style={styles.avatar} />
            <Kb.ConnectedUsernames
              usernames={[buildingAdvanced.recipient]}
              type="BodyTinySemibold"
              colorBroken={true}
              colorFollowing={true}
              underline={false}
            />
          </>
        ) : (
          <Kb.Text type="BodyTinySemibold" lineClamp={1} ellipsizeMode="middle">
            {buildingAdvanced.recipient}
          </Kb.Text>
        )}
        <Kb.Text type="BodyTinySemibold" style={styles.noShrink}>
          will receive:
        </Kb.Text>
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" fullWidth={true}>
        <AmountInput
          numDecimalsAllowed={7}
          onChangeAmount={onChangeAmount}
          value={buildingAdvanced.recipientAmount}
        />
        <PickAssetButton isSender={false} />
      </Kb.Box2>
    </Kb.Box2>
  )
}

const LeftBlock = (props: EmptyProps) => {
  const buildingAdvanced = Container.useSelector(state => state.wallets.buildingAdvanced)
  const builtPaymentAdvanced = Container.useSelector(state => state.wallets.builtPaymentAdvanced)
  return builtPaymentAdvanced.sourceDisplay ? (
    <Kb.Box2 direction="vertical" alignItems="flex-start">
      <Kb.Text type="HeaderBigExtrabold" style={!!builtPaymentAdvanced.amountError && styles.error}>
        ~{builtPaymentAdvanced.sourceDisplay}
      </Kb.Text>
      <Kb.Text type="BodyTiny">At most {builtPaymentAdvanced.sourceMaxDisplay}</Kb.Text>
      {!!buildingAdvanced.recipientAsset && (
        <Kb.Text type="BodyTiny">{builtPaymentAdvanced.exchangeRate}</Kb.Text>
      )}
      {!!builtPaymentAdvanced.amountError && (
        <Kb.Text type="BodySmall" style={styles.error} lineClamp={3}>
          {builtPaymentAdvanced.amountError}
        </Kb.Text>
      )}
    </Kb.Box2>
  ) : (
    <CalculateAdvancedButton isIcon={true} />
  )
}

export const AssetInputSenderAdvanced = (props: EmptyProps) => (
  <Kb.Box2
    direction="vertical"
    fullWidth={true}
    style={Styles.collapseStyles([sharedStyles.container, styles.container])}
  >
    <Kb.Text type="BodyTinySemibold" style={styles.topLabel}>
      You will send approximately:
    </Kb.Text>
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.senderMainContainer}>
      <LeftBlock />
      <Kb.Box style={Styles.globalStyles.flexGrow} />
      <PickAssetButton isSender={true} />
    </Kb.Box2>
    <Available />
  </Kb.Box2>
)

export const AssetPathIntermediate = () => {
  const [expanded, setExpanded] = React.useState(false)
  const path = Container.useSelector(state => state.wallets.builtPaymentAdvanced.fullPath.path)
  if (!path.size) {
    return <Kb.Divider />
  }
  return (
    <Kb.Box
      style={Styles.collapseStyles([
        styles.intermediateContainer,
        expanded && styles.intermediateContainerExpanded,
        !expanded && styles.intermediateContainerCollapsed,
      ])}
    >
      <Kb.Box2
        direction="vertical"
        alignItems="center"
        style={Styles.collapseStyles([
          styles.intermediateAbsoluteBlock,
          {
            top: -Styles.globalMargins.medium,
          },
        ])}
      >
        <PaymentPathCircle isLarge={false} />
      </Kb.Box2>
      <Kb.Box2
        direction="vertical"
        alignItems="center"
        style={Styles.collapseStyles([
          styles.intermediateAbsoluteBlock,
          {
            bottom: -(Styles.globalMargins.medium + Styles.globalMargins.xtiny),
          },
        ])}
      >
        <PaymentPathCircle isLarge={false} />
      </Kb.Box2>
      <Kb.Box2
        direction="vertical"
        alignItems="center"
        style={Styles.collapseStyles([
          styles.intermediateAbsoluteBlock,
          {
            bottom: -(Styles.globalMargins.medium + Styles.globalMargins.xtiny - pathCircleSmallDiameter),
            top: -(Styles.globalMargins.medium - pathCircleSmallDiameter),
          },
        ])}
      >
        <Kb.Box style={styles.intermediateLine} />
      </Kb.Box2>
      <Kb.ClickableBox
        style={Styles.collapseStyles([
          styles.intermediateAbsoluteBlock,
          styles.intermediateExpandButton,
          expanded && styles.intermediateExpandButtonExpanded,
          !expanded && styles.intermediateExpandButtonCollapsed,
        ])}
        onClick={() => setExpanded(expanded => !expanded)}
      >
        {expanded ? (
          <Kb.Icon type="iconfont-collapse" sizeType="Default" color={Styles.globalColors.purple} />
        ) : (
          <Kb.Icon type="iconfont-expand" sizeType="Default" color={Styles.globalColors.purple} />
        )}
      </Kb.ClickableBox>
      {expanded && (
        <Kb.Box2
          direction="vertical"
          alignItems="flex-end"
          fullWidth={true}
          style={styles.intermediateExpandedContainer}
        >
          {path
            .toArray()
            .reverse()
            .map(asset => (
              <Kb.Box2
                key={Types.assetDescriptionToAssetID(asset)}
                alignSelf="flex-end"
                direction="horizontal"
                style={styles.intermediateAssetPathItem}
              >
                <Kb.Text type="BodyTinyExtrabold">{asset === 'native' ? 'XLM' : `${asset.code}`}</Kb.Text>
                <Kb.Box style={styles.intermediateAssetPathItemDomainContainer}>
                  <Kb.Text type="BodyTiny" lineClamp={1} ellipsizeMode="middle">
                    {asset === 'native'
                      ? '/Stellar Lumens'
                      : `/${asset.issuerVerifiedDomain || asset.issuerAccountID}`}
                  </Kb.Text>
                </Kb.Box>
                <Kb.Box2
                  direction="horizontal"
                  centerChildren={true}
                  fullHeight={true}
                  style={styles.intermediateAssetPathItemCircleContainerOuter}
                >
                  <Kb.Box style={styles.intermediateAssetPathItemCircleContainerInner}>
                    <PaymentPathCircle isLarge={false} />
                  </Kb.Box>
                </Kb.Box2>
              </Kb.Box2>
            ))}
        </Kb.Box2>
      )}
    </Kb.Box>
  )
}

type PickAssetButtonProps = {
  isSender: boolean
}

const useGoToPickAssetCallback = (buildingAdvanced: Types.BuildingAdvanced, isSender: boolean) => {
  const accountID = !isSender
    ? buildingAdvanced.recipientType === 'keybaseUser'
      ? Types.noAccountID
      : buildingAdvanced.recipient
    : buildingAdvanced.senderAccountID
  const username = !isSender
    ? buildingAdvanced.recipientType === 'keybaseUser'
      ? buildingAdvanced.recipient
      : ''
    : ''
  const dispatch = Container.useDispatch()
  return React.useMemo(
    () =>
      accountID === Types.noAccountID && !username
        ? null
        : () =>
            dispatch(
              RouteTreeGen.createNavigateAppend({
                path: [
                  {
                    props: {
                      accountID,
                      isSender,
                      username,
                    },
                    selected: Constants.pickAssetFormRouteKey,
                  },
                ],
              })
            ),
    [dispatch, accountID, username, isSender]
  )
}

const PickAssetButton = (props: PickAssetButtonProps) => {
  const _buildingAdvanced = Container.useSelector(state => state.wallets.buildingAdvanced)
  const {isSender} = props
  const goToPickAsset = useGoToPickAssetCallback(_buildingAdvanced, isSender)
  const asset = isSender ? _buildingAdvanced.senderAsset : _buildingAdvanced.recipientAsset
  return (
    <Kb.Box style={styles.pickAssetButtonOverlayOuter}>
      <Kb.Box style={styles.pickAssetButtonOverlayInner}>
        <Kb.Box2
          direction="vertical"
          fullHeight={true}
          alignSelf="flex-start"
          alignItems="flex-end"
          style={styles.pickAssetButton}
        >
          <Kb.ClickableBox onClick={goToPickAsset} style={!goToPickAsset && styles.disabled}>
            <Kb.Box2 direction="horizontal" centerChildren={true} gap="tiny" alignSelf="flex-end">
              <Kb.Text type="HeaderBigExtrabold" style={sharedStyles.purple}>
                {asset !== Constants.emptyAssetDescription
                  ? asset === 'native'
                    ? 'XLM'
                    : asset.code
                  : 'Pick an asset'}
              </Kb.Text>
              <Kb.Icon type="iconfont-caret-down" sizeType="Small" color={Styles.globalColors.purple} />
            </Kb.Box2>
          </Kb.ClickableBox>
          {asset !== Constants.emptyAssetDescription && (
            <Kb.Text type="BodyTiny" style={sharedStyles.purple}>
              {asset === 'native' ? 'Stellar Lumens' : asset.issuerVerifiedDomain}
            </Kb.Text>
          )}
        </Kb.Box2>
      </Kb.Box>
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate({
  amountLoading: {
    height: 20,
    width: 20,
  },
  assetPathContainer: {
    backgroundColor: Styles.globalColors.blueGrey,
    padding: Styles.globalMargins.small,
  },
  avatar: {
    marginRight: Styles.globalMargins.xtiny,
  },
  container: Styles.platformStyles({
    isElectron: {
      minHeight: 106,
    },
    isMobile: {
      minHeight: 108,
    },
  }),
  disabled: {
    opacity: 0.3,
  },
  error: {
    color: Styles.globalColors.redDark,
  },
  intermediateAbsoluteBlock: {
    position: 'absolute',
    right: Styles.globalMargins.mediumLarge,
    width: Styles.globalMargins.mediumLarge,
  },
  intermediateAssetPathItem: {
    height: 20,
    paddingBottom: Styles.globalMargins.xxtiny,
    paddingTop: Styles.globalMargins.xxtiny,
  },
  intermediateAssetPathItemCircleContainerInner: {
    // This one has to be absolute as well otherwise it goes under the vertical line.
    position: 'absolute',
  },
  intermediateAssetPathItemCircleContainerOuter: {
    flexShrink: 0,
    marginRight: Styles.globalMargins.tiny,
    position: 'relative',
    width: Styles.globalMargins.small,
  },
  intermediateAssetPathItemDomainContainer: {
    flexShrink: 1,
    maxWidth: Styles.globalMargins.large * 5,
  },
  intermediateContainer: {
    backgroundColor: Styles.globalColors.blueGrey,
    position: 'relative',
    width: '100%',
  },
  intermediateContainerCollapsed: {
    height: Styles.globalMargins.tiny,
  },
  intermediateContainerExpanded: {
    minHeight: Styles.globalMargins.tiny,
    paddingBottom: Styles.globalMargins.medium,
    paddingTop: Styles.globalMargins.tiny,
  },
  intermediateExpandButton: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.black_20,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
  },
  intermediateExpandButtonCollapsed: {
    top: -10,
  },
  intermediateExpandButtonExpanded: {
    bottom: -14,
  },
  intermediateExpandedContainer: {
    paddingRight: Styles.globalMargins.mediumLarge,
  },
  intermediateLine: {
    backgroundColor: Styles.globalColors.purple,
    height: '100%',
    width: 2,
  },
  noShrink: {
    flexShrink: 0,
  },
  pickAssetButton: {
    width: Styles.globalMargins.xlarge * 3,
  },
  // We need this to make the PickAssetButton on top of other stuff so amount
  // error can extend below it.
  pickAssetButtonOverlayInner: {position: 'absolute', right: 0, top: 0},
  pickAssetButtonOverlayOuter: {position: 'relative'},
  senderMainContainer: {marginTop: Styles.globalMargins.xtiny},
  topLabel: {
    marginBottom: Styles.globalMargins.xtiny,
  },
})
