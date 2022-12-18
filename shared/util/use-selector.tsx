// Only doing this indirection so we can easily patch using why did you render
const {useSelector} = require('react-redux')
const useSelectorHolder = {useSelector}
export default useSelectorHolder
