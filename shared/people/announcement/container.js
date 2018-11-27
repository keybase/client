// @flow
import Announcement from '.'
type OwnProps = {||}

const mapStateToProps = () => ({})

const mapDispatchToProps = () => ({})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(Announcement)
