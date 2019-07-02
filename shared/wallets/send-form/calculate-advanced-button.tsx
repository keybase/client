import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as WalletsGen from '../../actions/wallets-gen'
import * as Constants from '../../constants/wallets'

type CalculateAdvancedButtonProps = {
  isIcon: boolean
}

const CalculateAdvancedButton = (props: CalculateAdvancedButtonProps) => {
  const dispatch = Container.useDispatch()
  const onClick = React.useCallback(() => {
    dispatch(WalletsGen.createCalculateBuildingAdvanced())
  }, [dispatch])
  const isLoading = Container.useAnyWaiting(Constants.calculateBuildingAdvancedWaitingKey)
  const buildingAdvanced = Container.useSelector(state => state.wallets.buildingAdvanced)
  const isDisabled =
    !buildingAdvanced.recipientAmount ||
    buildingAdvanced.recipientAsset === Constants.emptyAssetDescription ||
    buildingAdvanced.senderAsset === Constants.emptyAssetDescription
  const builtPaymentAdvanced = Container.useSelector(state => state.wallets.builtPaymentAdvanced)
  return !isLoading ? (
    props.isIcon ? (
      builtPaymentAdvanced.noPathFoundError ? (
        <Kb.Icon type="iconfont-remove" sizeType="Big" color={Styles.globalColors.red} />
      ) : (
        <Kb.WithTooltip
          text="Calculate the amount you will send"
          position="bottom left"
          disabled={isDisabled}
        >
          <Kb.Icon
            type="iconfont-calculate"
            sizeType="Big"
            color={isDisabled ? Styles.globalColors.purple_30 : Styles.globalColors.purple}
            onClick={isDisabled ? null : onClick}
          />
        </Kb.WithTooltip>
      )
    ) : (
      <Kb.Button
        type="Wallet"
        label="Calculate"
        children={
          <Kb.Icon type="iconfont-calculator" color={Styles.globalColors.white} style={styles.icon} />
        }
        waiting={isLoading}
        disabled={isDisabled}
        fullWidth={true}
        onClick={onClick}
      />
    )
  ) : (
    <Kb.ProgressIndicator style={styles.calculating} />
  )
}

export default CalculateAdvancedButton

const styles = Styles.styleSheetCreate({
  calculating: Styles.platformStyles({
    isElectron: {
      height: Styles.globalMargins.medium,
      width: Styles.globalMargins.medium,
    },
    isMobile: {
      height: Styles.globalMargins.mediumLarge,
      width: Styles.globalMargins.mediumLarge,
    },
  }),
  icon: {
    marginRight: Styles.globalMargins.tiny,
  },
})
