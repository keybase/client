import type {OpenDialogOptions, SaveDialogOptions} from './electron.desktop'

export declare function pickImages(title: string): Promise<Array<string>>
export declare function pickFiles(options: OpenDialogOptions): Promise<Array<string>>
export declare function pickSave(options: SaveDialogOptions): Promise<Array<string>>
