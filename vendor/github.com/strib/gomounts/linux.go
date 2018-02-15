package gomounts

/*
#include <stdio.h>
#include <stdlib.h>
#include <mntent.h>
*/
import "C"
import (
	"errors"
	"strings"
	"unsafe"
)

func getMountedVolumes() ([]Volume, error) {
	result := make([]Volume, 0)

	cpath := C.CString("/proc/mounts")
	defer C.free(unsafe.Pointer(cpath))
	cmode := C.CString("r")
	defer C.free(unsafe.Pointer(cmode))
	var file *C.FILE = C.setmntent(cpath, cmode)
	if file == nil {
		return nil, errors.New("Unable to open /proc/mounts")
	}
	defer C.endmntent(file)
	var ent *C.struct_mntent

	mntopt := C.CString("user_id")
	for ent = C.getmntent(file); ent != nil; ent = C.getmntent(file) {
		mntType := C.GoString(ent.mnt_type)
		uidstr := ""
		if substr := C.GoString(C.hasmntopt(ent, mntopt)); len(substr) > 0 {
			commasplit := strings.SplitN(substr, ",", 2)
			equalsplit := strings.SplitN(commasplit[0], "=", 2)
			uidstr = equalsplit[len(equalsplit)-1]
		}
		result = append(result, Volume{
			C.GoString(ent.mnt_dir), mntType, uidstr})
	}

	return result, nil
}
