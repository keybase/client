// @noflow
if (!__STORYBOOK__) {
  throw new Error('Invalid load of mock')
}
import * as React from 'react'
class ReactListMock extends React.Component<any> {
  render() {
    return null
  }
}
export default ReactListMock
