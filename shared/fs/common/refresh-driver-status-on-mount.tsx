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
  const refreshDriverStatusDesktop = C.useFSState(s => s.dispatch.dynamic.refreshDriverStatusDesktop)
  const refresh = () => refreshDriverStatusDesktop?.()
  const props = {
    refresh,
  }
  return <Component {...props} />
}
