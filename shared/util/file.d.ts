export type StatResult = {
  readonly size: number
  readonly lastModified: number
}

export type WriteStream = {
  readonly write: (arg0: any) => Promise<void>
  readonly close: () => void
}

export type Encoding = 'utf8' | 'ascii' | 'base64'

export declare const downloadFolder: string
export declare function tmpDir(): string
export declare function tmpFile(suffix: string): string
export declare function downloadFilePath(filename: string): Promise<string>
export declare function downloadFilePathNoSearch(filename: string): string
export declare function copy(from: string, to: string): Promise<boolean>
export declare function exists(filename: string): Promise<boolean>
export declare function stat(filename: string): Promise<StatResult>
export declare function writeStream(
  filepath: string,
  encoding: Encoding,
  append?: boolean
): Promise<WriteStream>
export declare function unlink(filepath: string): Promise<void>
export declare function readFile(filepath: string, encoding: Encoding): Promise<any>
