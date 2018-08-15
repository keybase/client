// @noflow
import * as React from 'react'
if (!__STORYBOOK__) {
  throw new Error('Invalid load of mock')
}

/*
react-list

*/

type Props = {
  length: number,
  itemRenderer: (index: number, key: number) => React.Node,
}

class ReactListMock extends React.Component<Props, {}> {
  render() {
    const length = this.props.length > 20 ? 20 : this.props.length

    return (
      <div className="ReactListMock">
        {[...Array(length).keys()].map(index => (
          <div className="ReactListItem" key={index}>
            {this.props.itemRenderer(index, index)}
          </div>
        ))}
      </div>
    )
  }
}

export default ReactListMock
