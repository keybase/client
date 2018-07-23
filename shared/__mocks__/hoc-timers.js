// @noflow
import * as React from 'react'

if (!__STORYBOOK__) {
  throw new Error('Invalid load of mock')
}

function getDisplayName(WrappedComponent): string {
  return WrappedComponent.displayName || WrappedComponent.name || 'Component'
}

function HOCTimers<Props: TimerProps>(
  WrappedComponent: React.ComponentType<Props>
): React.ComponentType<$Diff<Props, TimerProps>> {
  class TimersComponent extends React.Component<$Diff<Props, TimerProps>> {
    static displayName = `HOCTimers(${getDisplayName(WrappedComponent)})`
    setTimeout = (f, n) => 0
    clearTimeout = id => {}
    setInterval = (f, n) => 0
    clearInterval = id => {}
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
