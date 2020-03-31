import {parseUri, launchImageLibraryAsync} from './expo-image-picker'

const pickFiles = async (_: string): Promise<Array<string>> => {
  const result = await launchImageLibraryAsync('photo')
  return result.cancelled === true ? [] : [parseUri(result)]
}
export default pickFiles
