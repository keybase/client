// @flow
import * as React from 'react'
import * as Creators from '../actions/chat/creators'
import * as Constants from '../constants/chat'
import UserInput from '../search/user-input/container'
import ServiceFilter from '../search/services-filter'
import {Box} from '../common-adapters'
import {compose, withState, withHandlers, lifecycle} from 'recompose'
import {connect} from 'react-redux'
import {globalStyles, globalMargins} from '../styles'

type OwnProps = {
  selectedConversationIDKey: Constants.ConversationIDKey,
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onExitSearch: () => dispatch(Creators.exitSearch(false)),
})

const SearchHeader = props => (
  <Box style={{...globalStyles.flexBoxColumn, marginLeft: globalMargins.medium}}>
    <UserInput
      autoFocus={true}
      searchKey={'chatSearch'}
      focusInputCounter={props.focusInputCounter}
      placeholder={props.placeholder}
      onExitSearch={props.onExitSearch}
    />
    <Box style={{alignSelf: 'center'}}>
      {props.showServiceFilter &&
        <ServiceFilter selectedService={props.selectedService} onSelectService={props.onSelectService} />}
    </Box>
  </Box>
)

export default compose(
  connect(undefined, mapDispatchToProps),
  withState('focusInputCounter', 'setFocusInputCounter', 0),
  withHandlers({
    onFocusInput: props => () => {
      props.setFocusInputCounter(n => n + 1)
    },
  }),
  lifecycle({
    componentWillReceiveProps(nextProps: OwnProps) {
      if (this.props.selectedConversationIDKey !== nextProps.selectedConversationIDKey) {
        this.props.onFocusInput()
      }
    },
  })
)(SearchHeader)
