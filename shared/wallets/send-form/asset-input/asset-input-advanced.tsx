import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Types from '../../../constants/types/wallets'
import * as Constants from '../../../constants/wallets'
import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import Available from '../available/container'
import {AmountInput, sharedStyles} from './shared'

type RecipientProps = {
  recipientAsset?: Types.AssetDescription
  currencyLoading: boolean
  numDecimalsAllowed: number
  onChangeAmount: (string) => void
  recipientType: Types.CounterpartyType
  recipient: string
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

const senderAmount = (props: SenderProps) =>
  props.amountLoading ? (
    <Kb.ProgressIndicator style={styles.amountLoading} />
  ) : typeof props.approximate === 'number' ? (
    <Kb.Box2 direction="vertical" alignItems="flex-start">
      <Kb.Text type="HeaderBigExtrabold" style={!!props.error && styles.error}>
        ~{props.approximate.toFixed(props.numDecimals)}
      </Kb.Text>
      <Kb.Text type="BodyTiny">At most {props.atMost}</Kb.Text>
      {!!props.recipientAsset && (
        <Kb.Text type="BodyTiny">
          1 {props.recipientAsset.code}= {props.xlmToRecipientAsset} XLM
        </Kb.Text>
      )}
    </Kb.Box2>
  ) : (
    <Kb.Icon type="iconfont-calculate" sizeType="Big" color={Styles.globalColors.purple} />
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

export const PickAssetButton = (props: PickAssetButtonProps) => {
  const _buildingAdvanced = Container.useSelector(state => state.wallets.buildingAdvanced)
  const accountID = props.isSender
    ? _buildingAdvanced.senderAccountID
    : _buildingAdvanced.recipientType === 'keybaseUser'
    ? ''
    : _buildingAdvanced.recipient
  const username = props.isSender
    ? ''
    : _buildingAdvanced.recipientType === 'keybaseUser'
    ? _buildingAdvanced.recipient
    : ''
  const asset = props.isSender ? _buildingAdvanced.senderAsset : _buildingAdvanced.recipientAsset
  const dispatch = Container.useDispatch()
  const goToPickAsset = React.useCallback(
    () =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [
            {
              props: {
                accountID,
                isSender: props.isSender,
                username,
              },
              selected: Constants.pickAssetFormRouteKey,
            },
          ],
        })
      ),
    [dispatch]
  )
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
