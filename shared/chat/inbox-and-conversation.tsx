// TODO deprecate
// Just for desktop, we show inbox and conversation side by side
import * as React from 'react'
import Inbox from './inbox/container'
import {globalStyles} from '../styles'
import {RouteProps} from '../route-tree/render-route'

type Props = RouteProps<
  {},
  {
    smallTeamsExpanded: boolean
  }
> & {
  children: React.ElementType
}

class Render extends React.PureComponent<Props> {
  render() {
    return (
      <div style={style}>
        <Inbox />
        {this.props.children}
      </div>
    )
  }
}

const style = {
  ...globalStyles.flexBoxRow,
  flex: 1,
}

export default Render
