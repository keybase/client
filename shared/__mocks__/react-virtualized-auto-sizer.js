// @noflow
import * as React from 'react'
if (!__STORYBOOK__) {
  throw new Error('Invalid load of mock')
}

type Props = {|
  children: ({height: number, width: number}) => React.Node,
|}

const mockSize = {height: 300, width: 300}

class AutoSizerMock extends React.Component<Props, {}> {
  render() {
    return (
      <div className="AutoSizerMock" style={{...mockSize, overflow: 'visible'}}>
        {this.props.children(mockSize)}
      </div>
    )
  }
}

export default AutoSizerMock
