// @flow
import * as React from 'react'
import Box from './box'
import ScrollView from './scroll-view'
import Text from './text'
import {globalStyles, globalColors} from '../styles'
import {isMobile} from '../constants/platform'

type ErrorInfo = {
  componentStack: string,
}

// eslint-disable-next-line handle-callback-err
const Fallback = ({error, info}: *) => {
  let safeError
  let safeInfo = (info && info.componentStack) || ''

  try {
    safeError = error.toString()
  } catch (_) {
    safeError = ''
  }

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
          <Text type="Terminal" backgroundMode="Terminal">keybase log send</Text>
        </Box>}
      <Text type="BodySmall" style={{marginTop: 20}}>some details...</Text>
      <ScrollView style={{maxHeight: 100, padding: 10}}>
        <Text type="BodySmall" style={globalStyles.selectable}>{safeError}</Text>
        <Text type="BodySmall" style={globalStyles.selectable}>{safeInfo}</Text>
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

  unstable_handleError(error: Error, info: ErrorInfo): void {
    this.componentDidError(error, info)
  }

  componentDidError(error: Error, info: ErrorInfo): void {
    console.log('Got boundary error!')
    console.log(error)
    console.log(info)
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
