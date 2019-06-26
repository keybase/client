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

type RecipientProps = {
  currencyLoading?: boolean
  numDecimalsAllowed: number
  onChangeAmount: (string) => void
  recipient: string
  recipientAsset?: Types.AssetDescription
  recipientType: Types.CounterpartyType
  value: string
}

const recipientTopLabel = (props: RecipientProps) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} gap="xtiny" style={styles.topLabel}>
    {props.recipientType === 'keybaseUser' ? (
      // <Kb.NameWithIcon size="smaller" horizontal={true} username={props.account.username} />
      <Kb.Text type="BodyTinySemibold" lineClamp={1} ellipsizeMode="middle">
        {props.recipient}
      </Kb.Text>
    ) : (
      <Kb.Text type="BodyTinySemibold" lineClamp={1} ellipsizeMode="middle">
        {props.recipient}
      </Kb.Text>
    )}
    <Kb.Text type="BodyTinySemibold" style={styles.noShrink}>
      will receive:
    </Kb.Text>
  </Kb.Box2>
)

const recipientAmountInput = (props: RecipientProps) => (
  <AmountInput
    numDecimalsAllowed={props.numDecimalsAllowed}
    onChangeAmount={props.onChangeAmount}
    rightBlock={
      props.currencyLoading ? 'loading' : <PickAssetButton asset={props.recipientAsset} isSender={false} />
    }
    value={props.value}
  />
)

export const AssetInputRecipientAdvanced = (props: RecipientProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={sharedStyles.container}>
    {recipientTopLabel(props)}
    {recipientAmountInput(props)}
  </Kb.Box2>
)

type SenderProps = {
  amountLoading: boolean
  approximate?: number
  atMost?: number
  error?: boolean
  numDecimals: number
  recipientAsset?: Types.AssetDescription
  senderAsset?: Types.AssetDescription | 'native'
  xlmToRecipientAsset?: number
}

const ApproximateBlock = (props: SenderProps) => {
  return (
    <Kb.Box2 direction="vertical" alignItems="flex-start">
      <Kb.Text type="HeaderBigExtrabold" style={!!props.error && styles.error}>
        ~{props.approximate}
      </Kb.Text>
      <Kb.Text type="BodyTiny">At most {props.atMost}</Kb.Text>
      {!!props.recipientAsset && (
        <Kb.Text type="BodyTiny">
          1 {props.recipientAsset.code} = {props.xlmToRecipientAsset} XLM
        </Kb.Text>
      )}
    </Kb.Box2>
  )
}

const CalculateButton = (props: SenderProps) => {
  const dispatch = Container.useDispatch()
  const onClick = React.useCallback(() => {
    dispatch(WalletsGen.createCalculateBuildingAdvanced())
  }, [dispatch])
  return (
    <Kb.Icon type="iconfont-calculate" sizeType="Big" color={Styles.globalColors.purple} onClick={onClick} />
  )
}

const senderAmount = (props: SenderProps) =>
  props.amountLoading ? (
    <Kb.ProgressIndicator style={styles.amountLoading} />
  ) : props.approximate ? (
    <ApproximateBlock {...props} />
  ) : (
    <CalculateButton {...props} />
  )

export const AssetInputSenderAdvanced = (props: SenderProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={sharedStyles.container}>
    <Kb.Text type="BodyTinySemibold" style={styles.topLabel}>
      You will send approximately:
    </Kb.Text>
    <Kb.Box2 direction="horizontal" fullWidth={true}>
      {senderAmount(props)}
      <Kb.Box style={Styles.globalStyles.flexGrow} />
      <PickAssetButton asset={props.senderAsset} isSender={true} />
    </Kb.Box2>
    <Available />
  </Kb.Box2>
)

type PickAssetButtonProps = {
  // TODO get this from store after PickAssetButton is connected
  asset: Types.AssetDescription | 'native'
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
  return React.useCallback(
    () =>
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
    <Kb.Box2 direction="vertical" fullHeight={true} alignSelf="flex-start" alignItems="flex-end">
      <Kb.ClickableBox onClick={goToPickAsset}>
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
      {asset !== Constants.emptyAssetDescription && asset !== 'native' && (
        <Kb.Text type="BodyTiny" style={sharedStyles.purple}>
          {asset.issuerVerifiedDomain}
        </Kb.Text>
      )}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  amountLoading: {
    height: 20,
    width: 20,
  },
  error: {
    color: Styles.globalColors.redDark,
  },
  noShrink: {
    flexShrink: 0,
  },
  topLabel: {
    marginBottom: Styles.globalMargins.tiny,
  },
})
