import * as React from 'react'
import * as Container from '../../util/container'
import * as FsGen from '../../actions/fs-gen'

type Props = {
  refresh: () => void
}

class Component extends React.PureComponent<Props> {
  componentDidMount() {
    this.props.refresh()
  }
  render() {
    return null
  }
}

export default () => {
  const dispatch = Container.useDispatch()
  const refresh = () => dispatch(FsGen.createRefreshDriverStatus())
  const props = {
    refresh,
  }
  return <Component {...props} />
}
