import type * as React from 'react'
import * as Kb from '@/common-adapters'
import CommonResult, {type ResultProps, rowContainerWithLargePadding} from './common-result'
import YouResult from './you-result'
import HellobotResult from './hellobot-result'

const UserResult = function UserResult(props: ResultProps) {
  const {inTeam, isPreExistingTeamMember, isYou, namespace, onAdd, onRemove, userId, username} = props
  if (isYou) {
    return <YouResult {...props} />
  }

  // Fancy special case for new convo hellobot row
  if (username === 'hellobot' && namespace === 'chat') {
    return <HellobotResult {...props} />
  }

  return (
    <CommonResult
      {...props}
      rowStyle={rowContainerWithLargePadding}
      rightButtons={
        !isPreExistingTeamMember && (
          <ActionButton
            inTeam={inTeam}
            onAdd={(e?: React.BaseSyntheticEvent) => {
              e?.stopPropagation()
              onAdd(userId)
            }}
            onRemove={() => {
              onRemove(userId)
            }}
          />
        )
      }
    />
  )
}
const actionButtonSize = isMobile ? 22 : Kb.Styles.globalMargins.small

const ActionButton = (props: {
  inTeam: boolean
  onAdd: (e?: React.BaseSyntheticEvent) => void
  onRemove: () => void
}) => {
  const styles = useStyles()
  const Icon = props.inTeam ? AlreadyAddedIconButton : AddButton

  return (
    <Kb.ClickableBox
      onClick={props.inTeam ? props.onRemove : props.onAdd}
      direction="vertical"
      centerChildren={true}
      style={Kb.Styles.collapseStyles([styles.actionButton, props.inTeam && {backgroundColor: undefined}])}
    >
      <Icon />
    </Kb.ClickableBox>
  )
}

const AddButton = () => {
  const theme = Kb.Styles.useTheme()
  return (
    <Kb.Icon
      className="hover_contained_color_blue"
      type="iconfont-circle"
      fontSize={actionButtonSize}
      color={theme.black_20}
    />
  )
}

const AlreadyAddedIconButton = () => {
  const theme = Kb.Styles.useTheme()
  return (
    <Kb.Icon type="iconfont-success" fontSize={actionButtonSize} color={theme.blue} />
  )
}

const useStyles = Kb.Styles.createStyleHook(() => ({
  actionButton: Kb.Styles.platformStyles({
    common: {
      marginLeft: Kb.Styles.globalMargins.tiny,
    },
    isElectron: {
      ...Kb.Styles.size(Kb.Styles.globalMargins.small),
    },
    isMobile: {
      ...Kb.Styles.size(Kb.Styles.globalMargins.large),
      marginRight: Kb.Styles.globalMargins.tiny,
    },
  }),
}))

export default UserResult
