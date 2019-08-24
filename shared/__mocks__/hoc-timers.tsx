import * as React from 'react'

if (!__STORYBOOK__) {
  throw new Error('Invalid load of mock')
}

function getDisplayName(WrappedComponent): string {
  return WrappedComponent.displayName || WrappedComponent.name || 'Component'
}

function HOCTimers(WrappedComponent) {
  class TimersComponent extends React.Component {
    static displayName = `HOCTimers(${getDisplayName(WrappedComponent)})`
    setTimeout = () => 0
    clearTimeout = () => {}
    setInterval = () => 0
    clearInterval = () => {}
    render() {
      return (
        <WrappedComponent
          {...this.props}
          setTimeout={this.setTimeout}
          setInterval={this.setInterval}
          clearInterval={this.clearInterval}
          clearTimeout={this.clearTimeout}
        />
      )
    }
  }

  return TimersComponent
}

export default HOCTimers
