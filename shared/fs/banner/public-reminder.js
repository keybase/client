// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import openUrl from '../../util/open-url'

type Props = {|
  path: Types.Path,
|}
type State = {|
  closed: boolean,
|}

const getURL = (path: Types.Path) => {
  const parsedPath = Constants.parsePath(path)
  switch (parsedPath.kind) {
    case 'group-tlf':
    case 'in-group-tlf':
      return `https://keybase.pub/${parsedPath.tlfName}`
    default:
      return ''
  }
}

class PublicBanner extends React.Component<Props, State> {
  state = {closed: false}

  _onClose = () => this.setState({closed: true})

  componentDidUpdate(prevProps: Props) {
    if (!Constants.pathsInSameTlf(prevProps.path, this.props.path)) {
      this.setState({closed: false})
    }
  }

  render() {
    if (this.state.closed) {
      return null
    }
    const url = getURL(this.props.path)
    return (
      <Kb.Banner
        color="yellow"
        text="Everything you upload in here can be viewed by everyone at "
        actions={[{onClick: () => openUrl(url), title: url + '.'}]}
        onClose={this._onClose}
      />
    )
  }
}

export default PublicBanner
