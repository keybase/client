import * as React from 'react'
import * as C from '../../constants'

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
  const refresh = C.useFSState(s => s.dispatch.loadSettings)
  const props = {
    refresh,
  }
  return <Component {...props} />
}
