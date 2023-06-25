import * as React from 'react'
import * as Constants from '../../constants/fs'

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
  const refresh = Constants.useState(s => s.dispatch.loadSettings)
  const props = {
    refresh,
  }
  return <Component {...props} />
}
