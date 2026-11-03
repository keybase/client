// expo-file-system's own pure-JS path utilities: what its Directory and File constructors join
// their parts with before handing the uri to native. For fakes of those native classes, so a fake
// builds the uri the app would get. The package's exports map hides the subpath, hence the path.
export {PathUtilities} from '../node_modules/expo-file-system/build/pathUtilities'
