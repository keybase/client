// +build windows

package logger

func (log *Standard) RotateLogFile() error {
	// This seems to mean copying a file descriptor to log.filename
	// on top of stdout and stderr, which is TBI on Windows
	return nil
}
