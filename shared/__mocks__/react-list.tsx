import * as React from 'react'
import {clamp} from 'lodash-es'
if (!__STORYBOOK__) {
  throw new Error('Invalid load of mock')
}

type Props = {
  length: number
  itemRenderer: (index: number, key: number) => React.ReactNode
}

class ReactListMock extends React.Component<Props, {}> {
  render() {
    // It can take a while to render each item and some list stories have 100+ items, so we clamp them at 10
    const length = clamp(this.props.length, 10)

    return (
      <div className="ReactListMock">
        {[...Array(length).keys()].map(index => this.props.itemRenderer(index, index))}
      </div>
    )
  }
}

export default ReactListMock
