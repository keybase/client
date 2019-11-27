import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'

type CheckboxesProps = {
  checkData: boolean
  checkTeams: boolean
  checkUsername: boolean
  onCheckData: (checked: boolean) => void
  onCheckTeams: (checked: boolean) => void
  onCheckUsername: (checked: boolean) => void
}

const Checkboxes = (props: CheckboxesProps) => (
  <Kb.Box2 direction="vertical">
    <Kb.Checkbox
      checked={props.checkUsername}
      label="No one will be able to use this username ever, including yourself."
      onCheck={checked => props.onCheckUsername(checked)}
    />
    <Kb.Checkbox
      checked={props.checkData}
      label="You will lose your personal chats, files and git data."
      onCheck={checked => props.onCheckData(checked)}
    />
    <Kb.Checkbox
      checked={props.checkTeams}
      label="You will be removed from teams. If you were the last owner or admin of a team, it'll be orphaned and unrecoverable."
      onCheck={checked => props.onCheckTeams(checked)}
    />
  </Kb.Box2>
)

export type Props = {
  username: string
  onCancel: () => void
  onDeleteForever: () => void
}

type State = {
  checkData: boolean
  checkTeams: boolean
  checkUsername: boolean
}

class DeleteConfirm extends React.Component<Props, State> {
  state = {
    checkData: false,
    checkTeams: false,
    checkUsername: false,
  }

  render() {
    return (
      <Kb.ConfirmModal
        confirmText="Yes, permanently delete it"
        content={
          <Checkboxes
            checkData={this.state.checkData}
            checkTeams={this.state.checkTeams}
            checkUsername={this.state.checkUsername}
            onCheckData={checkData => this.setState({checkData})}
            onCheckTeams={checkTeams => this.setState({checkTeams})}
            onCheckUsername={checkUsername => this.setState({checkUsername})}
          />
        }
        description="This cannot be undone. By deleting this account, you agree that:"
        header={
          <>
            <Kb.Avatar size={Styles.isMobile ? 64 : 48} username={this.props.username} style={styles.avatar}>
              <Kb.Box2 direction="horizontal" style={styles.iconContainer}>
                <Kb.Icon color={Styles.globalColors.red} type="iconfont-remove" />
              </Kb.Box2>
            </Kb.Avatar>
            <Kb.Text type="BodySemibold" style={styles.strike}>
              {this.props.username}
            </Kb.Text>
          </>
        }
        onCancel={this.props.onCancel}
        onConfirm={this.props.onDeleteForever}
        onConfirmDeactivated={!this.state.checkUsername || !this.state.checkData || !this.state.checkTeams}
        prompt="Are you sure you want to permanently delete your account?"
      />
    )
  }
}

const styles = Styles.styleSheetCreate(() => ({
  avatar: Styles.platformStyles({
    isMobile: {
      marginBottom: Styles.globalMargins.small,
      marginTop: Styles.globalMargins.small,
    },
  }),
  iconContainer: {
    ...Styles.padding(1, 0, 0, 1),
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.white,
    borderRadius: 100,
    borderStyle: 'solid',
    borderWidth: 2,
    bottom: 0,
    position: 'absolute',
    right: -4,
  },
  strike: {
    ...Styles.globalStyles.italic,
    color: Styles.globalColors.redDark,
    textDecorationLine: 'line-through',
  },
}))

export default DeleteConfirm
