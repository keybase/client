// +build darwin,!ios
// +build !go1.10

// TODO: Remove this file once we've completely migrated to go 1.10.x.

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
	if cfKextID != nil {
		defer Release(C.CFTypeRef(cfKextID))
	}
	if err != nil {
		return nil, err
	}
	cfKextIDs := ArrayToCFArray([]C.CFTypeRef{C.CFTypeRef(cfKextID)})
	if cfKextIDs != nil {
		defer Release(C.CFTypeRef(cfKextIDs))
	}

	cfDict := C.KextManagerCopyLoadedKextInfo(cfKextIDs, nil)

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
	if cfKextID != nil {
		defer Release(C.CFTypeRef(cfKextID))
	}
	if err != nil {
		return err
	}

	var urls []C.CFTypeRef
	for _, p := range paths {
		cfPath, err := StringToCFString(p)
		if cfPath != nil {
			defer Release(C.CFTypeRef(cfPath))
		}
		if err != nil {
			return err
		}
		cfURL := C.CFURLCreateWithFileSystemPath(nil, cfPath, 0, 1)
		if cfURL != nil {
			defer Release(C.CFTypeRef(cfURL))
		}

		urls = append(urls, C.CFTypeRef(cfURL))
	}

	cfURLs := ArrayToCFArray(urls)
	if cfURLs != nil {
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
	if cfKextID != nil {
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
