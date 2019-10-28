import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import CommonResult, {ResultProps} from './common-result'

const UserResult = (props: ResultProps) => {
  return (
    <CommonResult
      {...props}
      rowStyle={styles.rowContainer}
      rightButtons={
        !props.isPreExistingTeamMember && (
          <ActionButton inTeam={props.inTeam} onAdd={props.onAdd} onRemove={props.onRemove} />
        )
      }
    />
  )
}
const actionButtonSize = Styles.isMobile ? 22 : Styles.globalMargins.small

const ActionButton = (props: {inTeam: boolean; onAdd: () => void; onRemove: () => void}) => {
  const Icon = props.inTeam ? AlreadyAddedIconButton : AddButton

  return (
    <Kb.ClickableBox onClick={props.inTeam ? props.onRemove : props.onAdd}>
      <Kb.Box2
        direction="vertical"
        centerChildren={true}
        style={Styles.collapseStyles([styles.actionButton, props.inTeam && {backgroundColor: null}])}
      >
        <Icon />
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}

const AddButton = () => (
  <Kb.Icon type="iconfont-circle" fontSize={actionButtonSize} color={Styles.globalColors.black_20} />
)

const AlreadyAddedIconButton = () => (
  <Kb.Icon type="iconfont-success" fontSize={actionButtonSize} color={Styles.globalColors.blue} />
)

const styles = Styles.styleSheetCreate(() => ({
  actionButton: Styles.platformStyles({
    common: {
      marginLeft: Styles.globalMargins.tiny,
    },
    isElectron: {
      height: Styles.globalMargins.small,
      width: Styles.globalMargins.small,
    },
    isMobile: {
      height: Styles.globalMargins.large,
      marginRight: Styles.globalMargins.tiny,
      width: Styles.globalMargins.large,
    },
  }),
  rowContainer: {
    ...Styles.padding(
      Styles.globalMargins.tiny,
      Styles.globalMargins.medium,
      Styles.globalMargins.tiny,
      Styles.globalMargins.xsmall
    ),
  },
}))

export default UserResult
