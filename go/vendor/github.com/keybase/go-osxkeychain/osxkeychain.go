package osxkeychain

// See https://developer.apple.com/library/mac/documentation/Security/Reference/keychainservices/index.html for the APIs used below.

// Also see https://developer.apple.com/library/ios/documentation/Security/Conceptual/keychainServConcepts/01introduction/introduction.html .

/*
#cgo CFLAGS: -mmacosx-version-min=10.6 -D__MAC_OS_X_VERSION_MAX_ALLOWED=1060
#cgo LDFLAGS: -framework CoreFoundation -framework Security

#include <stdlib.h>
#include <CoreFoundation/CoreFoundation.h>
#include <Security/Security.h>
*/
import "C"

import (
	"errors"
	"fmt"
	"math"
	"unicode/utf8"
	"unsafe"
)

// GenericPasswordAttributes holds all the info for a generic password
// in a keychain.
//
// All string fields must have size that fits in 32 bits. All string
// fields except for Password must be encoded in UTF-8.
//
// TrustedApplications is a list of additional application (paths)
// that should have access to the keychain item. The application
// that creates the keychain item always has access, so this list
// is for additional apps or executables.
type GenericPasswordAttributes struct {
	ServiceName         string
	AccountName         string
	Password            []byte
	TrustedApplications []string
}

func check32Bit(paramName string, paramValue []byte) error {
	if uint64(len(paramValue)) > math.MaxUint32 {
		return errors.New(paramName + " has size overflowing 32 bits")
	}
	return nil
}

func check32BitUTF8(paramName, paramValue string) error {
	if uint64(len(paramValue)) > math.MaxUint32 {
		return errors.New(paramName + " has size overflowing 32 bits")
	}
	if !utf8.ValidString(paramValue) {
		return errors.New(paramName + " is not a valid UTF-8 string")
	}
	return nil
}

// CheckValidity returns an error if any of the attributes in the
// given GenericPasswordAttributes are invalid. Otherwise, it returns
// nil.
func (attributes *GenericPasswordAttributes) CheckValidity() error {
	if err := check32BitUTF8("ServiceName", attributes.ServiceName); err != nil {
		return err
	}
	if err := check32BitUTF8("AccountName", attributes.AccountName); err != nil {
		return err
	}
	if err := check32Bit("Password", attributes.Password); err != nil {
		return err
	}
	for _, trustedApplication := range attributes.TrustedApplications {
		if err := check32BitUTF8("TrustedApplications", trustedApplication); err != nil {
			return err
		}
	}
	return nil
}

type keychainError C.OSStatus

// Error codes from https://developer.apple.com/library/mac/documentation/security/Reference/keychainservices/Reference/reference.html#//apple_ref/doc/uid/TP30000898-CH5g-CJBEABHG
const (
	ErrUnimplemented     keychainError = C.errSecUnimplemented
	ErrParam             keychainError = C.errSecParam
	ErrAllocate          keychainError = C.errSecAllocate
	ErrNotAvailable      keychainError = C.errSecNotAvailable
	ErrReadOnly          keychainError = C.errSecReadOnly
	ErrAuthFailed        keychainError = C.errSecAuthFailed
	ErrNoSuchKeychain    keychainError = C.errSecNoSuchKeychain
	ErrInvalidKeychain   keychainError = C.errSecInvalidKeychain
	ErrDuplicateKeychain keychainError = C.errSecDuplicateKeychain
	ErrDuplicateCallback keychainError = C.errSecDuplicateCallback
	ErrInvalidCallback   keychainError = C.errSecInvalidCallback
	ErrDuplicateItem     keychainError = C.errSecDuplicateItem
	ErrItemNotFound      keychainError = C.errSecItemNotFound
	ErrBufferTooSmall    keychainError = C.errSecBufferTooSmall
	ErrDataTooLarge      keychainError = C.errSecDataTooLarge
	ErrNoSuchAttr        keychainError = C.errSecNoSuchAttr
	ErrInvalidItemRef    keychainError = C.errSecInvalidItemRef
	ErrInvalidSearchRef  keychainError = C.errSecInvalidSearchRef
	ErrNoSuchClass       keychainError = C.errSecNoSuchClass
	ErrNoDefaultKeychain keychainError = C.errSecNoDefaultKeychain
	ErrReadOnlyAttr      keychainError = C.errSecReadOnlyAttr
	// TODO: Fill out more of these?
)

func newKeychainError(errCode C.OSStatus) error {
	if errCode == C.noErr {
		return nil
	}
	return keychainError(errCode)
}

// The various kSec* variables are either CFTypeRef or CFStringRef,
// depending on OS X version. So define CFTypeRef-cast variables for
// the ones we use, so we can use them in maps.
var secClass = C.CFTypeRef(C.kSecClass)
var secClassGenericPassword = C.CFTypeRef(C.kSecClassGenericPassword)
var secAttrService = C.CFTypeRef(C.kSecAttrService)
var secAttrAccount = C.CFTypeRef(C.kSecAttrAccount)
var secAttrAccess = C.CFTypeRef(C.kSecAttrAccess)
var secValueData = C.CFTypeRef(C.kSecValueData)
var secMatchLimit = C.CFTypeRef(C.kSecMatchLimit)
var secMatchLimitAll = C.CFTypeRef(C.kSecMatchLimitAll)
var secReturnAttributes = C.CFTypeRef(C.kSecReturnAttributes)

func (ke keychainError) Error() string {
	errorMessageCFString := C.SecCopyErrorMessageString(C.OSStatus(ke), nil)
	defer C.CFRelease(C.CFTypeRef(errorMessageCFString))

	errorMessageCString := C.CFStringGetCStringPtr(errorMessageCFString, C.kCFStringEncodingASCII)

	if errorMessageCString != nil {
		return C.GoString(errorMessageCString)
	}

	return fmt.Sprintf("keychainError with unknown error code %d", C.OSStatus(ke))
}

// AddGenericPassword adds a generic password with the given
// attributes to the default keychain.
func AddGenericPassword(attributes *GenericPasswordAttributes) (err error) {
	if err = attributes.CheckValidity(); err != nil {
		return
	}

	var serviceNameString C.CFStringRef
	if serviceNameString, err = _UTF8StringToCFString(attributes.ServiceName); err != nil {
		return
	}
	defer C.CFRelease(C.CFTypeRef(serviceNameString))

	var accountNameString C.CFStringRef
	if accountNameString, err = _UTF8StringToCFString(attributes.AccountName); err != nil {
		return
	}
	defer C.CFRelease(C.CFTypeRef(accountNameString))

	dataBytes := bytesToCFData(attributes.Password)
	defer C.CFRelease(C.CFTypeRef(dataBytes))

	query := map[C.CFTypeRef]C.CFTypeRef{
		secClass:       secClassGenericPassword,
		secAttrService: C.CFTypeRef(serviceNameString),
		secAttrAccount: C.CFTypeRef(accountNameString),
		secValueData:   C.CFTypeRef(dataBytes),
	}

	access, err := createAccess(attributes.ServiceName, attributes.TrustedApplications)
	if err != nil {
		return
	}

	if access != nil {
		defer C.CFRelease(C.CFTypeRef(access))
		query[secAttrAccess] = C.CFTypeRef(access)
	}

	queryDict := mapToCFDictionary(query)
	defer C.CFRelease(C.CFTypeRef(queryDict))

	errCode := C.SecItemAdd(queryDict, nil)

	err = newKeychainError(errCode)
	return
}

// FindGenericPassword finds a generic password with the given
// attributes in the default keychain and returns the password field
// if found. If not found, an error is returned.
func FindGenericPassword(attributes *GenericPasswordAttributes) ([]byte, error) {
	if err := attributes.CheckValidity(); err != nil {
		return nil, err
	}

	serviceName := C.CString(attributes.ServiceName)
	defer C.free(unsafe.Pointer(serviceName))

	accountName := C.CString(attributes.AccountName)
	defer C.free(unsafe.Pointer(accountName))

	var passwordLength C.UInt32

	var password unsafe.Pointer

	errCode := C.SecKeychainFindGenericPassword(
		nil, // default keychain
		C.UInt32(len(attributes.ServiceName)),
		serviceName,
		C.UInt32(len(attributes.AccountName)),
		accountName,
		&passwordLength,
		&password,
		nil,
	)

	if err := newKeychainError(errCode); err != nil {
		return nil, err
	}

	defer C.SecKeychainItemFreeContent(nil, password)

	return C.GoBytes(password, C.int(passwordLength)), nil
}

// FindAndRemoveGenericPassword finds a generic password with the
// given attributes in the default keychain and removes it if
// found. If not found, an error is returned.
func FindAndRemoveGenericPassword(attributes *GenericPasswordAttributes) error {
	itemRef, err := findGenericPasswordItem(attributes)
	if err != nil {
		return err
	}

	defer C.CFRelease(C.CFTypeRef(itemRef))

	errCode := C.SecKeychainItemDelete(itemRef)
	return newKeychainError(errCode)
}

// RemoveAndAddGenericPassword calls FindAndRemoveGenericPassword()
// with the given attributes (ignoring ErrItemNotFound) and then calls
// AddGenericPassword with the same attributes.
//
// https://developer.apple.com/library/mac/documentation/Security/Reference/keychainservices/index.html says:
//
// Do not delete a keychain item and recreate it in order to modify
// it; instead, use the SecKeychainItemModifyContent or
// SecKeychainItemModifyAttributesAndData function to modify an
// existing keychain item. When you delete a keychain item, you lose
// any access controls and trust settings added by the user or by
// other applications.
//
// But this is a security problem, since a malicious app can delete a
// keychain item and recreate it with an ACL such that it can read it,
// and then wait for an app to write to
// it; see http://arxiv.org/abs/1505.06836 .
//
// TODO: Add a test that this function doesn't actually do
// update-or-add. This would involve setting a separate attribute and
// then checking for it, though.
func RemoveAndAddGenericPassword(attributes *GenericPasswordAttributes) error {
	return removeAndAddGenericPasswordHelper(attributes, func() {})
}

// removeAndAddGenericPasswordHelper is a helper function to help test
// RemoveAndAddGenericPassword's handling of race conditions.
func removeAndAddGenericPasswordHelper(attributes *GenericPasswordAttributes, fn func()) error {
	err := FindAndRemoveGenericPassword(attributes)
	if err != nil && err != ErrItemNotFound {
		return err
	}

	fn()

	return AddGenericPassword(attributes)
}

func findGenericPasswordItem(attributes *GenericPasswordAttributes) (itemRef C.SecKeychainItemRef, err error) {
	if err = attributes.CheckValidity(); err != nil {
		return
	}

	serviceName := C.CString(attributes.ServiceName)
	defer C.free(unsafe.Pointer(serviceName))

	accountName := C.CString(attributes.AccountName)
	defer C.free(unsafe.Pointer(accountName))

	errCode := C.SecKeychainFindGenericPassword(
		nil, // default keychain
		C.UInt32(len(attributes.ServiceName)),
		serviceName,
		C.UInt32(len(attributes.AccountName)),
		accountName,
		nil,
		nil,
		&itemRef,
	)

	err = newKeychainError(errCode)
	return
}

// The returned CFStringRef, if non-nil, must be released via CFRelease.
func _UTF8StringToCFString(s string) (C.CFStringRef, error) {
	if !utf8.ValidString(s) {
		return nil, errors.New("invalid UTF-8 string")
	}

	bytes := []byte(s)
	var p *C.UInt8
	if len(bytes) > 0 {
		p = (*C.UInt8)(&bytes[0])
	}
	return C.CFStringCreateWithBytes(nil, p, C.CFIndex(len(s)), C.kCFStringEncodingUTF8, C.false), nil
}

func _CFStringToUTF8String(s C.CFStringRef) string {
	p := C.CFStringGetCStringPtr(s, C.kCFStringEncodingUTF8)
	if p != nil {
		return C.GoString(p)
	}
	length := C.CFStringGetLength(s)
	if length == 0 {
		return ""
	}
	maxBufLen := C.CFStringGetMaximumSizeForEncoding(length, C.kCFStringEncodingUTF8)
	if maxBufLen == 0 {
		return ""
	}
	buf := make([]byte, maxBufLen)
	var usedBufLen C.CFIndex
	_ = C.CFStringGetBytes(s, C.CFRange{0, length}, C.kCFStringEncodingUTF8, C.UInt8(0), C.false, (*C.UInt8)(&buf[0]), maxBufLen, &usedBufLen)
	return string(buf[:usedBufLen])
}

// The returned CFDictionaryRef, if non-nil, must be released via CFRelease.
func mapToCFDictionary(m map[C.CFTypeRef]C.CFTypeRef) C.CFDictionaryRef {
	var keys, values []unsafe.Pointer
	for key, value := range m {
		keys = append(keys, unsafe.Pointer(key))
		values = append(values, unsafe.Pointer(value))
	}
	numValues := len(values)
	var keysPointer, valuesPointer *unsafe.Pointer
	if numValues > 0 {
		keysPointer = &keys[0]
		valuesPointer = &values[0]
	}
	return C.CFDictionaryCreate(nil, keysPointer, valuesPointer, C.CFIndex(numValues), &C.kCFTypeDictionaryKeyCallBacks, &C.kCFTypeDictionaryValueCallBacks)
}

func _CFDictionaryToMap(cfDict C.CFDictionaryRef) (m map[C.CFTypeRef]C.CFTypeRef) {
	count := C.CFDictionaryGetCount(cfDict)
	if count > 0 {
		keys := make([]C.CFTypeRef, count)
		values := make([]C.CFTypeRef, count)
		C.CFDictionaryGetKeysAndValues(cfDict, (*unsafe.Pointer)(&keys[0]), (*unsafe.Pointer)(&values[0]))
		m = make(map[C.CFTypeRef]C.CFTypeRef, count)
		for i := C.CFIndex(0); i < count; i++ {
			m[keys[i]] = values[i]
		}
	}
	return
}

// The returned CFArrayRef, if non-nil, must be released via CFRelease.
func arrayToCFArray(a []C.CFTypeRef) C.CFArrayRef {
	var values []unsafe.Pointer
	for _, value := range a {
		values = append(values, unsafe.Pointer(value))
	}
	numValues := len(values)
	var valuesPointer *unsafe.Pointer
	if numValues > 0 {
		valuesPointer = &values[0]
	}
	return C.CFArrayCreate(nil, valuesPointer, C.CFIndex(numValues), &C.kCFTypeArrayCallBacks)
}

func _CFArrayToArray(cfArray C.CFArrayRef) (a []C.CFTypeRef) {
	count := C.CFArrayGetCount(cfArray)
	if count > 0 {
		a = make([]C.CFTypeRef, count)
		C.CFArrayGetValues(cfArray, C.CFRange{0, count}, (*unsafe.Pointer)(&a[0]))
	}
	return
}

// The returned CFDataRef, if non-nil, must be released via CFRelease.
func bytesToCFData(b []byte) C.CFDataRef {
	var p *C.UInt8
	if len(b) > 0 {
		p = (*C.UInt8)(&b[0])
	}
	return C.CFDataCreate(nil, p, C.CFIndex(len(b)))
}

// GetAllAccountNames returns a list of all account names for the
// given service name in the default keychain.
func GetAllAccountNames(serviceName string) (accountNames []string, err error) {
	var serviceNameString C.CFStringRef
	if serviceNameString, err = _UTF8StringToCFString(serviceName); err != nil {
		return
	}
	defer C.CFRelease(C.CFTypeRef(serviceNameString))

	query := map[C.CFTypeRef]C.CFTypeRef{
		secClass:            secClassGenericPassword,
		secAttrService:      C.CFTypeRef(serviceNameString),
		secMatchLimit:       secMatchLimitAll,
		secReturnAttributes: C.CFTypeRef(C.kCFBooleanTrue),
	}
	queryDict := mapToCFDictionary(query)
	defer C.CFRelease(C.CFTypeRef(queryDict))

	var resultsRef C.CFTypeRef
	errCode := C.SecItemCopyMatching(queryDict, &resultsRef)
	err = newKeychainError(errCode)
	if err == ErrItemNotFound {
		return []string{}, nil
	} else if err != nil {
		return nil, err
	}

	defer C.CFRelease(resultsRef)

	// The resultsRef should always be an array (because kSecReturnAttributes is true)
	// but it's a good sanity check and useful if want to support kSecReturnRef in the future.
	typeID := C.CFGetTypeID(resultsRef)
	if typeID != C.CFArrayGetTypeID() {
		typeDesc := C.CFCopyTypeIDDescription(typeID)
		defer C.CFRelease(C.CFTypeRef(typeDesc))
		err = fmt.Errorf("Invalid result type: %s", _CFStringToUTF8String(typeDesc))
		return
	}

	results := _CFArrayToArray(C.CFArrayRef(resultsRef))
	for _, result := range results {
		m := _CFDictionaryToMap(C.CFDictionaryRef(result))
		resultServiceName := _CFStringToUTF8String(C.CFStringRef(m[secAttrService]))
		if resultServiceName != serviceName {
			err = fmt.Errorf("Expected service name %s, got %s", serviceName, resultServiceName)
			return
		}
		accountName := _CFStringToUTF8String(C.CFStringRef(m[secAttrAccount]))
		accountNames = append(accountNames, accountName)
	}
	return
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
	err := newKeychainError(errCode)
	if err != nil {
		return nil, err
	}

	return C.CFTypeRef(trustedApplicationRef), nil
}

// The returned SecAccessRef, if non-nil, must be released via CFRelease.
func createAccess(label string, trustedApplications []string) (C.SecAccessRef, error) {
	if len(trustedApplications) == 0 {
		return nil, nil
	}

	// Always prepend with empty string which signifies that we
	// include a NULL application, which means ourselves.
	trustedApplications = append([]string{""}, trustedApplications...)

	var err error
	var labelRef C.CFStringRef
	if labelRef, err = _UTF8StringToCFString(label); err != nil {
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
	trustedApplicationsArray := arrayToCFArray(trustedApplicationsRefs)
	defer C.CFRelease(C.CFTypeRef(trustedApplicationsArray))
	errCode := C.SecAccessCreate(labelRef, trustedApplicationsArray, &access)
	err = newKeychainError(errCode)
	if err != nil {
		return nil, err
	}

	return access, nil
}
