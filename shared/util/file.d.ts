type WriteStream = {
  readonly write: (arg0: any) => Promise<void>
  readonly close: () => void
}

type Encoding = 'utf8' | 'ascii' | 'base64'

export declare const downloadFolder: string
/** TODO deprecate
 */
export declare function writeStream(
  filepath: string,
  encoding: Encoding,
  append?: boolean
): Promise<WriteStream>
/** TODO deprecated
 */
export declare function readFile(filepath: string, encoding: Encoding): Promise<any>
