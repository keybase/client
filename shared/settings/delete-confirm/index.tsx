import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'

type CheckboxesProps = {
  box1: boolean
  box2: boolean
  box3: boolean
  onSetBox1: (checked: boolean) => void
  onSetBox2: (checked: boolean) => void
  onSetBox3: (checked: boolean) => void
}

const Checkboxes = (props: CheckboxesProps) => (
  <Kb.Box2 direction="vertical">
    <Kb.Checkbox
      checked={props.box1}
      label="No one will be able to use this username ever, including yourself."
      onCheck={checked => props.onSetBox1(checked)}
    />
    <Kb.Checkbox
      checked={props.box2}
      label="You will lose your personal chats, files and git data."
      onCheck={checked => props.onSetBox2(checked)}
    />
    <Kb.Checkbox
      checked={props.box3}
      label="You will be removed from teams. If you were the last owner or admin of a team, it'll be orphaned and unrecoverable."
      onCheck={checked => props.onSetBox3(checked)}
    />
  </Kb.Box2>
)

export type Props = {
  username: string
  onCancel: () => void
  onDeleteForever: () => void
}

type State = {
  box1: boolean
  box2: boolean
  box3: boolean
}

class DeleteConfirm extends React.Component<Props, State> {
  state = {
    box1: false,
    box2: false,
    box3: false,
  }

  render() {
    return (
      <Kb.ConfirmModal
        confirmText="Yes, permanently delete it"
        content={
          <Checkboxes
            box1={this.state.box1}
            box2={this.state.box2}
            box3={this.state.box3}
            onSetBox1={box1 => this.setState({box1})}
            onSetBox2={box2 => this.setState({box2})}
            onSetBox3={box3 => this.setState({box3})}
          />
        }
        description="This cannot be undone. By deleting this, you agree that:"
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
        onConfirmDeactivated={!this.state.box1 || !this.state.box2 || !this.state.box3}
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
