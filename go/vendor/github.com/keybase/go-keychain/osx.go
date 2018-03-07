// +build darwin,!ios

package keychain

/*
#cgo LDFLAGS: -framework CoreFoundation -framework Security

#include <CoreFoundation/CoreFoundation.h>
#include <Security/Security.h>
*/
import "C"
import "unsafe"

var AccessibleKey = attrKey(C.CFTypeRef(C.kSecAttrAccessible))
var accessibleTypeRef = map[Accessible]C.CFTypeRef{
	AccessibleWhenUnlocked:                   C.CFTypeRef(C.kSecAttrAccessibleWhenUnlocked),
	AccessibleAfterFirstUnlock:               C.CFTypeRef(C.kSecAttrAccessibleAfterFirstUnlock),
	AccessibleAlways:                         C.CFTypeRef(C.kSecAttrAccessibleAlways),
	AccessibleWhenUnlockedThisDeviceOnly:     C.CFTypeRef(C.kSecAttrAccessibleWhenUnlockedThisDeviceOnly),
	AccessibleAfterFirstUnlockThisDeviceOnly: C.CFTypeRef(C.kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly),
	AccessibleAccessibleAlwaysThisDeviceOnly: C.CFTypeRef(C.kSecAttrAccessibleAlwaysThisDeviceOnly),

	// Only available in 10.10
	//AccessibleWhenPasscodeSetThisDeviceOnly:  C.CFTypeRef(C.kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly),
}

var (
	AccessKey = attrKey(C.CFTypeRef(C.kSecAttrAccess))
)

// The returned SecAccessRef, if non-nil, must be released via CFRelease.
func createAccess(label string, trustedApplications []string) (C.CFTypeRef, error) {
	if len(trustedApplications) == 0 {
		return nil, nil
	}

	// Always prepend with empty string which signifies that we
	// include a NULL application, which means ourselves.
	trustedApplications = append([]string{""}, trustedApplications...)

	var err error
	var labelRef C.CFStringRef
	if labelRef, err = StringToCFString(label); err != nil {
		return nil, err
	}
	defer C.CFRelease(C.CFTypeRef(labelRef))

	var trustedApplicationsRefs []C.CFTypeRef
	for _, trustedApplication := range trustedApplications {
		trustedApplicationRef, err := createTrustedApplication(trustedApplication)
		if err != nil {
			return nil, err
		}
		defer C.CFRelease(C.CFTypeRef(trustedApplicationRef))
		trustedApplicationsRefs = append(trustedApplicationsRefs, trustedApplicationRef)
	}

	var access C.SecAccessRef
	trustedApplicationsArray := ArrayToCFArray(trustedApplicationsRefs)
	defer C.CFRelease(C.CFTypeRef(trustedApplicationsArray))
	errCode := C.SecAccessCreate(labelRef, trustedApplicationsArray, &access)
	err = checkError(errCode)
	if err != nil {
		return nil, err
	}

	return C.CFTypeRef(access), nil
}

// The returned SecTrustedApplicationRef, if non-nil, must be released via CFRelease.
func createTrustedApplication(trustedApplication string) (C.CFTypeRef, error) {
	var trustedApplicationCStr *C.char
	if trustedApplication != "" {
		trustedApplicationCStr = C.CString(trustedApplication)
		defer C.free(unsafe.Pointer(trustedApplicationCStr))
	}

	var trustedApplicationRef C.SecTrustedApplicationRef
	errCode := C.SecTrustedApplicationCreateFromPath(trustedApplicationCStr, &trustedApplicationRef)
	err := checkError(errCode)
	if err != nil {
		return nil, err
	}

	return C.CFTypeRef(trustedApplicationRef), nil
}

type Access struct {
	Label               string
	TrustedApplications []string
}

func (a Access) Convert() (C.CFTypeRef, error) {
	return createAccess(a.Label, a.TrustedApplications)
}

func (k *Item) SetAccess(a *Access) {
	if a != nil {
		k.attr[AccessKey] = a
	} else {
		delete(k.attr, AccessKey)
	}
}

// DeleteItemRef deletes a keychain item reference.
func DeleteItemRef(ref C.CFTypeRef) error {
	errCode := C.SecKeychainItemDelete(C.SecKeychainItemRef(ref))
	return checkError(errCode)
}
