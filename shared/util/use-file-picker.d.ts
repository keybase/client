import * as Electron from 'electron'

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
