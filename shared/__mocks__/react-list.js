// @noflow
import * as React from 'react'
if (!__STORYBOOK__) {
  throw new Error('Invalid load of mock')
}

type Props = {
  length: number,
  itemRenderer: (index: number, key: number) => React.Node,
}

class ReactListMock extends React.Component<Props, {}> {
  render() {
    const length = this.props.length > 20 ? 20 : this.props.length

    return (
      <div className="ReactListMock">
        {[...Array(length).keys()].map(index => this.props.itemRenderer(index, index))}
      </div>
    )
  }
}

export default ReactListMock
