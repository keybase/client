// @flow
import * as I from 'immutable'
import Render from './index'
import {
  compose,
  withHandlers,
  withPropsOnChange,
  withStateHandlers,
  connect,
  type TypedState,
} from '../../util/container'
import {createEditProfile} from '../../actions/profile-gen'
import {maxProfileBioChars} from '../../constants/profile'
import {navigateUp} from '../../actions/route-tree'
import {HeaderHoc} from '../../common-adapters'
import {isMobile} from '../../constants/platform'

const mapStateToProps = (state: TypedState) => {
  return {
    _teamNameToIsOpen: state.entities.getIn(['teams', 'teamNameToIsOpen'], I.Map()),
    _teammembercounts: state.entities.getIn(['teams', 'teammembercounts'], I.Map()),
    _teamnames: state.entities.getIn(['teams', 'teamnames'], I.Set()),
    teams: [
      {fqName: 'teama', open: true, member: true, canPromote: true},
      {fqName: 'teamb', open: true, member: true, canPromote: true},
      {fqName: 'teamc', open: true, member: true, canPromote: true},
      {fqName: 'teamd', open: true, member: true, canPromote: true},
      {fqName: 'teame', open: true, member: true, canPromote: true},
      {fqName: 'teamf', open: true, member: true, canPromote: true},
      {fqName: 'teamg', open: true, member: true, canPromote: true},
      {fqName: 'teamh', open: true, member: true, canPromote: true},
      {fqName: 'teami', open: true, member: true, canPromote: true},
      {fqName: 'teamj', open: true, member: true, canPromote: true},
      {fqName: 'teamk', open: true, member: true, canPromote: true},
      {fqName: 'teaml', open: true, member: true, canPromote: true},
      {fqName: 'teamm', open: true, member: true, canPromote: true},
    ],
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBack: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps) => {
  let teamnames = stateProps._teamnames.toArray()
  teamnames.sort((a, b) => {
    const aName = a.toUpperCase()
    const bName = b.toUpperCase()
    if (aName < bName) {
      return -1
    } else if (aName > bName) {
      return 1
    } else {
      return 0
    }
  })

  return {
    teamNameToIsOpen: stateProps._teamNameToIsOpen.toObject(),
    teammembercounts: stateProps._teammembercounts.toObject(),
    teamnames,
  }
}

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), isMobile ? HeaderHoc : a => a)(Render)
