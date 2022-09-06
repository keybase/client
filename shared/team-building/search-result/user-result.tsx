import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import CommonResult, {type ResultProps} from './common-result'
import YouResult from './you-result'
import HellobotResult from './hellobot-result'

const UserResult = React.memo(function UserResult(props: ResultProps) {
  if (props.isYou) {
    return <YouResult {...props} />
  }

  // Fancy special case for new convo hellobot row
  if (props.username === 'hellobot' && props.namespace === 'chat2') {
    return <HellobotResult {...props} />
  }

  return (
    <CommonResult
      {...props}
      rowStyle={styles.rowContainer}
      rightButtons={
        !props.isPreExistingTeamMember && (
          <ActionButton
            inTeam={props.inTeam}
            onAdd={(e: React.BaseSyntheticEvent) => {
              e.stopPropagation()
              props?.onAdd(props.userId)
            }}
            onRemove={() => {
              props.onRemove(props.userId)
            }}
          />
        )
      }
    />
  )
})
const actionButtonSize = Styles.isMobile ? 22 : Styles.globalMargins.small

const ActionButton = (props: {
  inTeam: boolean
  onAdd: (e: React.BaseSyntheticEvent) => void
  onRemove: () => void
}) => {
  const Icon = props.inTeam ? AlreadyAddedIconButton : AddButton

  return (
    <Kb.ClickableBox onClick={props.inTeam ? props.onRemove : props.onAdd}>
      <Kb.Box2
        direction="vertical"
        centerChildren={true}
        style={Styles.collapseStyles([styles.actionButton, props.inTeam && {backgroundColor: undefined}])}
      >
        <Icon />
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}

const AddButton = () => (
  <Kb.Icon
    className="hover_contained_color_blue"
    type="iconfont-circle"
    fontSize={actionButtonSize}
    color={Styles.globalColors.black_20}
  />
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
