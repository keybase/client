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

type AllErrorInfo = {
  name: string,
  message: string,
  stack: string,
  componentStack: string,
}

const detailStyle = {
  ...globalStyles.selectable,
  whiteSpace: 'pre',
}

// eslint-disable-next-line handle-callback-err
const Fallback = ({info: {name, message, stack, componentStack}}: {info: AllErrorInfo}) => {
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
      <Text type="BodySmall" style={globalStyles.selectable}>{`${name}: ${message}`}</Text>
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

type State = {
  info: ?AllErrorInfo,
}

class ErrorBoundary extends React.PureComponent<any, State> {
  state = {info: null}

  componentWillReceiveProps(nextProps: any) {
    if (this.props.children !== nextProps.children) {
      this.setState({})
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const allInfo: AllErrorInfo = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    }
    this.setState({info: allInfo})
  }

  render() {
    if (this.state.info) {
      return <Fallback info={this.state.info} />
    }
    return this.props.children
  }
}

export default ErrorBoundary

export {Fallback}
