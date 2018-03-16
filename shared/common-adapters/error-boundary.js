// @flow
import * as React from 'react'
import Box from './box'
import ScrollView from './scroll-view'
import Text from './text'
import Icon from './icon'
import {globalStyles, globalColors, isMobile, globalMargins, platformStyles} from '../styles'

// Although not mentioned in
// https://reactjs.org/blog/2017/07/26/error-handling-in-react-16.html ,
// the info parameter to componentDidCatch looks like this.
type ErrorInfo = {
  componentStack: string,
}

type AllErrorInfo = {
  name: string,
  message: string,
  stack: string,
  componentStack: string,
}

type FallbackProps = {
  closeOnClick?: () => void,
  info: AllErrorInfo,
}

const detailHeaderStyle = {
  marginTop: 20,
  marginBottom: 10,
}

const detailContainerStyle = {
  maxHeight: 100,
  padding: 10,
  minWidth: '75%',
}

const detailStyle = platformStyles({
  isElectron: {
    whiteSpace: 'pre',
  },
})

const Fallback = ({closeOnClick, info: {name, message, stack, componentStack}}: FallbackProps) => {
  return (
    <ScrollView style={{width: '100%', height: '100%', padding: globalMargins.medium, position: 'relative'}}>
      <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', flex: 1, justifyContent: 'center'}}>
        <Text type="Header">Something went wrong...</Text>
        <Text type="Body" style={{marginBottom: 10, marginTop: 10}}>
          Please submit a bug report by
          {isMobile ? ' going into Settings / Feedback' : ' running this command in your terminal:'}
        </Text>
        {!isMobile && (
          <Box
            style={{
              ...globalStyles.flexBoxColumn,
              backgroundColor: globalColors.darkBlue3,
              borderRadius: 4,
              minWidth: 100,
              padding: 10,
            }}
          >
            <Text type="Terminal" backgroundMode="Terminal" selectable={true}>
              keybase log send
            </Text>
          </Box>
        )}
        <Text type="BodySmall" style={detailHeaderStyle}>
          Error details
        </Text>
        <Text type="BodySmall" selectable={true} style={{margin: 10}}>{`${name}: ${message}`}</Text>
        <Text type="BodySmall" style={{marginTop: 20}}>
          Stack trace
        </Text>
        <ScrollView style={detailContainerStyle}>
          <Text type="BodySmall" selectable={true} style={detailStyle}>
            {stack}
          </Text>
        </ScrollView>

        <Text type="BodySmall" style={detailHeaderStyle}>
          Component stack trace
        </Text>
        <ScrollView style={detailContainerStyle}>
          <Text type="BodySmall" selectable={true} style={detailStyle}>
            {componentStack}
          </Text>
        </ScrollView>
      </Box>
      {closeOnClick && (
        <Icon
          type="iconfont-close"
          style={{position: 'absolute', top: globalMargins.tiny, right: globalMargins.tiny}}
          onClick={closeOnClick}
        />
      )}
    </ScrollView>
  )
}

type Props = {
  children: React.Node,
  closeOnClick?: () => void,
}

type State = {
  info: ?AllErrorInfo,
}

class ErrorBoundary extends React.PureComponent<Props, State> {
  state = {info: null}

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.children !== nextProps.children) {
      this.setState({info: null})
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const allInfo: AllErrorInfo = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    }
    console.log('Got boundary error:', allInfo)
    this.setState({info: allInfo})
  }

  render() {
    if (this.state.info) {
      return <Fallback info={this.state.info} closeOnClick={this.props.closeOnClick} />
    }
    return this.props.children
  }
}

export default ErrorBoundary

export {Fallback}
