import * as React from 'react'
import * as Kb from '@/common-adapters'
import type {Props} from '.'

const Prompt = () => (
  <Kb.Box2 direction="horizontal" fullWidth={true} gap="xtiny" style={promptContainerStyle}>
    <Kb.Text type="BodySmallSemibold">Explode messages after:</Kb.Text>
  </Kb.Box2>
)

const promptContainerStyle = {
  alignItems: 'center',
  justifyContent: 'center',
} as const

type State = {selected: number}

class SetExplodePopup extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {selected: props.selected || 0}
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.selected !== prevProps.selected) {
      this.setState({selected: this.props.selected || 0})
    }
  }

  setSelected = (value?: number) => {
    if (value !== undefined) {
      this.setState({selected: value})
    }
  }

  onCancel = () => {
    if (this.state.selected !== this.props.selected) {
      // reset selection
      this.setState({selected: this.props.selected || 0})
    }
    this.props.onHidden()
  }

  render() {
    const items = this.props.items.map(item => ({
      onClick: () => {
        this.props.onSelect(item.seconds)
        this.props.onHidden()
      },
      title: item.text,
      value: item.seconds,
    }))

    return (
      <Kb.FloatingModalContext.Provider value="bottomsheet">
        <Kb.FloatingMenu
          header={<Prompt />}
          closeOnSelect={true}
          items={items}
          onHidden={this.props.onHidden}
          visible={this.props.visible}
        />
      </Kb.FloatingModalContext.Provider>
    )
  }
}

export default SetExplodePopup
