// @flow
import People from './'
import * as PeopleGen from '../actions/people-gen'
import {connect} from 'react-redux'
import {compose, lifecycle} from 'recompose'
import {type TypedState} from '../util/container'
// import flags from '../util/feature-flags'

const mapStateToProps = (state: TypedState) => ({
  newItems: state.people.newItems,
  oldItems: state.people.oldItems,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  getData: () => dispatch(PeopleGen.createGetPeopleData({markViewed: true, numFollowSuggestionsWanted: 10})),
  todoDispatch: {},
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentWillMount() {
      this.props.getData()
    },
  })
)(People)
