export type Encoding = 'utf8' | 'ascii' | 'base64'

export declare const downloadFolder: string
export declare function copy(from: string, to: string): Promise<boolean>
export declare function downloadFilePath(filename: string): Promise<string>
export declare function downloadFilePathNoSearch(filename: string): string
export declare function readFile(filepath: string, encoding: Encoding): Promise<any>
export declare function unlink(filepath: string): Promise<void>
export declare function writeStream(
  filepath: string,
  encoding: Encoding,
  append?: boolean
): Promise<{
  readonly write: (arg0: any) => Promise<void>
  readonly close: () => void
}>
