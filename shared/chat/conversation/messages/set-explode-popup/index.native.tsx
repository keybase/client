import * as React from 'react'
import {Box2, Text, FloatingPicker} from '../../../../common-adapters/mobile.native'
import {Props} from './index.types'

const Prompt = () => (
  <Box2
    direction="horizontal"
    fullWidth={true}
    gap="xtiny"
    // @ts-ignore TODO fix styles
    style={promptContainerStyle}
  >
    <Text type="BodySmallSemibold">Explode messages after:</Text>
  </Box2>
)

const promptContainerStyle = {
  alignItems: 'center',
  justifyContent: 'center',
}

type State = {
  selected: number
}

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

  setSelected = (value: number | string) => {
    if (typeof value === 'string') {
      // never happens. makes flow happy.
      return
    }
    this.setState({selected: value})
  }

  onDone = () => {
    this.props.onSelect(this.state.selected)
    this.props.onHidden()
  }

  onCancel = () => {
    if (this.state.selected !== this.props.selected) {
      // reset selection
      this.setState({selected: this.props.selected || 0})
    }
    this.props.onHidden()
  }

  render() {
    const items = this.props.items.map(item => ({label: item.text, value: item.seconds}))
    return (
      <FloatingPicker
        items={items}
        onSelect={this.setSelected}
        onHidden={this.onCancel}
        onCancel={this.onCancel}
        onDone={this.onDone}
        prompt={<Prompt />}
        promptString="Pick a timeout"
        visible={this.props.visible}
        selectedValue={this.state.selected}
      />
    )
  }
}

export default SetExplodePopup
