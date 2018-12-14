// +build darwin

package gomounts

/*
#include <sys/param.h>
#include <sys/ucred.h>
#include <sys/mount.h>
*/
import "C"
import (
	"fmt"
	"strconv"
	"sync"
	"unsafe"
)

var mtx sync.Mutex = sync.Mutex{}

func getMountedVolumes() ([]Volume, error) {
	// getmntinfo is non-reentrant
	mtx.Lock()
	defer mtx.Unlock()

	result := make([]Volume, 0)

	var mntbuf *C.struct_statfs
	c, err := C.getmntinfo(&mntbuf, C.MNT_NOWAIT)
	if err != nil {
		return result, fmt.Errorf("Failure calling getmntinfo: %+v", err)
	}
	count := int(c)
	if count == 0 {
		return nil, nil
	}

	// Convert to go slice per https://code.google.com/p/go-wiki/wiki/cgo
	mntSlice := (*[1 << 30]C.struct_statfs)(unsafe.Pointer(mntbuf))[:count:count]

	for _, v := range mntSlice {
		uidstr := strconv.Itoa(int(v.f_owner))
		result = append(result, Volume{C.GoString(&v.f_mntonname[0]), C.GoString(&v.f_fstypename[0]), uidstr})
	}

	return result, nil
}
