import * as React from 'react'
import * as Kb from '@/common-adapters'
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
              props.onAdd(props.userId)
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
const actionButtonSize = Kb.Styles.isMobile ? 22 : Kb.Styles.globalMargins.small

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
        style={Kb.Styles.collapseStyles([styles.actionButton, props.inTeam && {backgroundColor: undefined}])}
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
    color={Kb.Styles.globalColors.black_20}
  />
)

const AlreadyAddedIconButton = () => (
  <Kb.Icon type="iconfont-success" fontSize={actionButtonSize} color={Kb.Styles.globalColors.blue} />
)

const styles = Kb.Styles.styleSheetCreate(() => ({
  actionButton: Kb.Styles.platformStyles({
    common: {
      marginLeft: Kb.Styles.globalMargins.tiny,
    },
    isElectron: {
      height: Kb.Styles.globalMargins.small,
      width: Kb.Styles.globalMargins.small,
    },
    isMobile: {
      height: Kb.Styles.globalMargins.large,
      marginRight: Kb.Styles.globalMargins.tiny,
      width: Kb.Styles.globalMargins.large,
    },
  }),
  rowContainer: {
    ...Kb.Styles.padding(
      Kb.Styles.globalMargins.tiny,
      Kb.Styles.globalMargins.medium,
      Kb.Styles.globalMargins.tiny,
      Kb.Styles.globalMargins.xsmall
    ),
  },
}))

export default UserResult
