// @noflow
import * as React from 'react'
import {clamp} from 'lodash-es'
if (!__STORYBOOK__) {
  throw new Error('Invalid load of mock')
}

type Props = {
  length: number,
  itemRenderer: (index: number, key: number) => React.Node,
}

class ReactListMock extends React.Component<Props, {}> {
  render() {
    // It can take a while to render each item, so we clamp it at 10
    const length = clamp(this.props.length, 10)

    return (
      <div className="ReactListMock">
        {[...Array(length).keys()].map(index => this.props.itemRenderer(index, index))}
      </div>
    )
  }
}

export default ReactListMock
