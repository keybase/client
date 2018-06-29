// @noflow
import * as React from 'react'
if (!__STORYBOOK__) {
  throw new Error('Invalid load of mock')
}
class ReactListMock extends React.Component<any> {
  render() {
    return null
  }
}
export default ReactListMock
