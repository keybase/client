import * as Electron from 'electron'

export declare function showOpenDialog(
  options: Electron.OpenDialogOptions
): Promise<Electron.OpenDialogReturnValue | undefined>
export declare function showSaveDialog(
  options: Electron.SaveDialogOptions
): Promise<Electron.SaveDialogReturnValue | undefined>

export declare function useOpenFile(
  counter: number,
  options: Electron.OpenDialogOptions,
  callback: (result: Electron.OpenDialogReturnValue) => void
): void
export declare function useSaveFile(
  counter: number,
  options: Electron.OpenDialogOptions,
  callback: (result: Electron.OpenDialogReturnValue) => void
): void
