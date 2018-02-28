// +build windows

package gomounts

/*
#include <string.h>
#include <stdlib.h>
#include <Windows.h>
*/
import "C"

import (
	"unsafe"
)

// Windows implementation
func getMountedVolumes() ([]Volume, error) {
	result := make([]Volume, 0)
	var buf [256]C.char

	drives := uint32(C.GetLogicalDrives())

	for i := uint32(0); i < 26; i++ {
		if (1<<i)&drives != 0 {
			letter := 'A' + i
			rootPath := string(letter) + `:\`
			fsType := func() string {
				cRootPath := C.CString(rootPath)
				defer C.free(unsafe.Pointer(cRootPath))
				if C.GetVolumeInformation(C.LPCSTR(unsafe.Pointer(cRootPath)), nil, 0, nil, nil, nil, C.LPCSTR(unsafe.Pointer(&buf[0])), C.DWORD(len(buf))) != 0 {
					return C.GoString(&buf[0])
				}
				return "Unknown"
			}()
			result = append(result, Volume{rootPath, fsType})
		}
	}

	return result, nil
}
