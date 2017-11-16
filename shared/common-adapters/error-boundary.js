// @flow
import * as React from 'react'
import Box from './box'
import ScrollView from './scroll-view'
import Text from './text'
import {globalStyles, globalColors} from '../styles'
import {isMobile} from '../constants/platform'

// Although not mentioned in
// https://reactjs.org/blog/2017/07/26/error-handling-in-react-16.html ,
// the info parameter to componentDidCatch looks like this.
type ErrorInfo = {
  componentStack: string,
}

const detailStyle = {
  ...globalStyles.selectable,
  whiteSpace: 'pre',
}

// eslint-disable-next-line handle-callback-err
const Fallback = ({error, info}: *) => {
  const message = error.message || '(No error message)'
  const stack = error.stack || '(No error stack)'
  let componentStack = (info && info.componentStack) || '(No component stack)'

  return (
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', flex: 1, justifyContent: 'center'}}>
      <Text type="Header">Something went wrong...</Text>
      <Text type="Body" style={{marginBottom: 10, marginTop: 10}}>
        Please submit a bug report by
        {isMobile ? ' going into Settings / Feedback' : ' running this command in your terminal:'}
      </Text>
      {!isMobile &&
        <Box
          style={{
            ...globalStyles.flexBoxColumn,
            backgroundColor: globalColors.midnightBlue,
            borderRadius: 4,
            minWidth: 100,
            padding: 10,
          }}
        >
          <Text type="Terminal" backgroundMode="Terminal" style={globalStyles.selectable}>
            keybase log send
          </Text>
        </Box>}
      <Text type="BodySmall" style={{marginTop: 20}}>Error message: </Text>
      <Text type="BodySmall" style={globalStyles.selectable}>{message}</Text>
      <Text type="BodySmall" style={{marginTop: 20}}>Error stack: </Text>
      <ScrollView style={{maxHeight: 100, padding: 10}}>
        <Text type="BodySmall" style={detailStyle}>{stack}</Text>
      </ScrollView>
      <Text type="BodySmall" style={{marginTop: 20}}>Component stack: </Text>
      <ScrollView style={{maxHeight: 100, padding: 10}}>
        <Text type="BodySmall" style={detailStyle}>{componentStack}</Text>
      </ScrollView>
    </Box>
  )
}

class ErrorBoundary extends React.PureComponent<any, {error: ?Error, info: ?ErrorInfo}> {
  state = {
    error: null,
    info: null,
  }

  componentWillReceiveProps(nextProps: any) {
    if (this.props.children !== nextProps.children) {
      if (this.state.error) {
        this.setState({error: null, info: null})
      }
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.log('Got boundary error!')
    console.log('Error message:', error.message)
    console.log('Error stack:', error.stack)
    console.log('Component stack:', info.componentStack)
    this.setState({error, info})
  }

  render() {
    if (this.state.error) {
      return <Fallback error={this.state.error} info={this.state.info} />
    }
    return this.props.children
  }
}

export default ErrorBoundary

export {Fallback}
