// @flow
import People from '.'
import * as PeopleGen from '../actions/people-gen'
import {connect} from 'react-redux'
import {compose, lifecycle} from 'recompose'
import {type TypedState} from '../util/container'
// import flags from '../util/feature-flags'

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  getData: () => dispatch(PeopleGen.createGetPeopleData({markViewed: false, numFollowSuggestionsWanted: 10})),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentWillMount() {
      this.props.getData()
    },
  })
)(People)
