// +build darwin,!ios
// +build go1.10

package kext

/*
#cgo LDFLAGS: -framework CoreFoundation -framework IOKit

#include <IOKit/kext/KextManager.h>
*/
import "C"
import "fmt"

type Info struct {
	Version string
	Started bool
}

func LoadInfo(kextID string) (*Info, error) {
	info, err := LoadInfoRaw(kextID)
	if err != nil {
		return nil, err
	}
	if info == nil {
		return nil, nil
	}

	return &Info{
		Version: info["CFBundleVersion"].(string),
		Started: info["OSBundleStarted"].(bool),
	}, nil
}

func LoadInfoRaw(kextID string) (map[interface{}]interface{}, error) {
	cfKextID, err := StringToCFString(kextID)
	if cfKextID != 0 {
		defer Release(C.CFTypeRef(cfKextID))
	}
	if err != nil {
		return nil, err
	}
	cfKextIDs := ArrayToCFArray([]C.CFTypeRef{C.CFTypeRef(cfKextID)})
	if cfKextIDs != 0 {
		defer Release(C.CFTypeRef(cfKextIDs))
	}

	cfDict := C.KextManagerCopyLoadedKextInfo(C.CFArrayRef(cfKextIDs), 0)

	m, err := ConvertCFDictionary(cfDict)
	if err != nil {
		return nil, err
	}

	info, hasKey := m[kextID]
	if !hasKey {
		return nil, nil
	}

	var ret, cast = info.(map[interface{}]interface{})
	if !cast {
		return nil, fmt.Errorf("Unexpected value for kext info")
	}

	return ret, nil
}

func Load(kextID string, paths []string) error {
	cfKextID, err := StringToCFString(kextID)
	if cfKextID != 0 {
		defer Release(C.CFTypeRef(cfKextID))
	}
	if err != nil {
		return err
	}

	var urls []C.CFTypeRef
	for _, p := range paths {
		cfPath, err := StringToCFString(p)
		if cfPath != 0 {
			defer Release(C.CFTypeRef(cfPath))
		}
		if err != nil {
			return err
		}
		cfURL := C.CFURLCreateWithFileSystemPath(C.kCFAllocatorDefault, C.CFStringRef(cfPath), 0, 1)
		if cfURL != 0 {
			defer Release(C.CFTypeRef(C.CFURLRef(cfURL)))
		}

		urls = append(urls, C.CFTypeRef(C.CFURLRef(cfURL)))
	}

	cfURLs := ArrayToCFArray(urls)
	if cfURLs != 0 {
		defer Release(C.CFTypeRef(cfURLs))
	}

	ret := C.KextManagerLoadKextWithIdentifier(cfKextID, cfURLs)
	if ret != 0 {
		return fmt.Errorf("Error loading kext(%d)", ret)
	}
	return nil
}

func Unload(kextID string) error {
	cfKextID, err := StringToCFString(kextID)
	if cfKextID != 0 {
		defer Release(C.CFTypeRef(cfKextID))
	}
	if err != nil {
		return err
	}
	ret := C.KextManagerUnloadKextWithIdentifier(cfKextID)
	if ret != 0 {
		return fmt.Errorf("Error unloading kext (%d)", ret)
	}
	return nil
}
