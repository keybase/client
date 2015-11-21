import React, {Component} from '../base-react'
import ReactDOM from 'react-dom'
import remote from 'remote'

const currentWindow = remote.getCurrentWindow()

class RemoteComponentLoader extends Component {
  constructor (props) {
    super(props)
    this.state = {loaded: false}

    const componentToLoad = window.location.hash.substring(1)
    if (!componentToLoad) {
      throw new TypeError('Remote Component not passed through hash')
    }

    // We assume the thing we'll load is within react/
    console.log('I want to load', componentToLoad)
    this.Component = require('../' + componentToLoad).RemoteComponent
  }
  
  componentWillMount () {
    // TODO: get the props for this component
    console.log('need props!')

    currentWindow.on('hasProps', (props) => {
      console.log('setting props to be:', props)
      this.setState({props: props, loaded: true})
      this.forceUpdate()
    })

    currentWindow.emit('needProps')
  }

  render () {
    const Component = this.Component

    console.log('rendering')
    if (!this.state.loaded) {
      return <div>loading</div>
    }
    return <Component {...this.state.props}/>
  }

  shouldComponentUpdate () {
    // Always return false because this isn't a real component
    return false
  }
}

ReactDOM.render(<RemoteComponentLoader/>, document.getElementById('remoteComponent'))
