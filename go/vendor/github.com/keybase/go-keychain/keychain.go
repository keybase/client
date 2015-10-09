// +build darwin ios

package keychain

// See https://developer.apple.com/library/ios/documentation/Security/Reference/keychainservices/index.html for the APIs used below.

// Also see https://developer.apple.com/library/ios/documentation/Security/Conceptual/keychainServConcepts/01introduction/introduction.html .

/*
#cgo LDFLAGS: -framework CoreFoundation -framework Security

#include <CoreFoundation/CoreFoundation.h>
#include <Security/Security.h>
*/
import "C"
import (
	"errors"
	"fmt"
	"math"
	"reflect"
	"unicode/utf8"
	"unsafe"
)

type Error int

var (
	ErrorUnimplemented         Error = Error(C.errSecUnimplemented)
	ErrorParam                       = Error(C.errSecParam)
	ErrorAllocate                    = Error(C.errSecAllocate)
	ErrorNotAvailable                = Error(C.errSecNotAvailable)
	ErrorAuthFailed                  = Error(C.errSecAuthFailed)
	ErrorDuplicateItem               = Error(C.errSecDuplicateItem)
	ErrorItemNotFound                = Error(C.errSecItemNotFound)
	ErrorInteractionNotAllowed       = Error(C.errSecInteractionNotAllowed)
	ErrorDecode                      = Error(C.errSecDecode)
)

func checkError(errCode C.OSStatus) error {
	if errCode == C.errSecSuccess {
		return nil
	}
	return Error(errCode)
}

func (k Error) Error() string {
	var msg string
	// SecCopyErrorMessageString is only available on OSX, so derive manually.
	switch k {
	case ErrorItemNotFound:
		msg = fmt.Sprintf("Item not found (%d)", k)
	case ErrorDuplicateItem:
		msg = fmt.Sprintf("Duplicate item (%d)", k)
	case ErrorParam:
		msg = fmt.Sprintf("One or more parameters passed to the function were not valid (%d)", k)
	case -25243:
		msg = fmt.Sprintf("No access for item (%d)", k)
	default:
		msg = fmt.Sprintf("Keychain Error (%d)", k)
	}
	return msg
}

type SecClass int

// Keychain Item Classes
var (
	/*
		kSecClassGenericPassword item attributes:
		 kSecAttrAccess (OS X only)
		 kSecAttrAccessGroup (iOS; also OS X if kSecAttrSynchronizable specified)
		 kSecAttrAccessible (iOS; also OS X if kSecAttrSynchronizable specified)
		 kSecAttrAccount
		 kSecAttrService
	*/
	SecClassGenericPassword SecClass = 1
)

var SecClassKey = attrKey(C.CFTypeRef(C.kSecClass))
var secClassTypeRef = map[SecClass]C.CFTypeRef{
	SecClassGenericPassword: C.CFTypeRef(C.kSecClassGenericPassword),
}

var (
	ServiceKey     = attrKey(C.CFTypeRef(C.kSecAttrService))
	LabelKey       = attrKey(C.CFTypeRef(C.kSecAttrLabel))
	AccountKey     = attrKey(C.CFTypeRef(C.kSecAttrAccount))
	AccessGroupKey = attrKey(C.CFTypeRef(C.kSecAttrAccessGroup))
	DataKey        = attrKey(C.CFTypeRef(C.kSecValueData))
)

type Synchronizable int

const (
	SynchronizableDefault Synchronizable = 0
	SynchronizableAny                    = 1
	SynchronizableYes                    = 2
	SynchronizableNo                     = 3
)

var SynchronizableKey = attrKey(C.CFTypeRef(C.kSecAttrSynchronizable))
var syncTypeRef = map[Synchronizable]C.CFTypeRef{
	SynchronizableAny: C.CFTypeRef(C.kSecAttrSynchronizableAny),
	SynchronizableYes: C.CFTypeRef(C.kCFBooleanTrue),
	SynchronizableNo:  C.CFTypeRef(C.kCFBooleanFalse),
}

type Accessible int

const (
	AccessibleDefault                        Accessible = 0
	AccessibleWhenUnlocked                              = 1
	AccessibleAfterFirstUnlock                          = 2
	AccessibleAlways                                    = 3
	AccessibleWhenPasscodeSetThisDeviceOnly             = 4
	AccessibleWhenUnlockedThisDeviceOnly                = 5
	AccessibleAfterFirstUnlockThisDeviceOnly            = 6
	AccessibleAccessibleAlwaysThisDeviceOnly            = 7
)

var AccessibleKey = attrKey(C.CFTypeRef(C.kSecAttrAccessible))
var accessibleTypeRef = map[Accessible]C.CFTypeRef{
	AccessibleWhenUnlocked:                   C.CFTypeRef(C.kSecAttrAccessibleWhenUnlocked),
	AccessibleAfterFirstUnlock:               C.CFTypeRef(C.kSecAttrAccessibleAfterFirstUnlock),
	AccessibleAlways:                         C.CFTypeRef(C.kSecAttrAccessibleAlways),
	AccessibleWhenPasscodeSetThisDeviceOnly:  C.CFTypeRef(C.kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly),
	AccessibleWhenUnlockedThisDeviceOnly:     C.CFTypeRef(C.kSecAttrAccessibleWhenUnlockedThisDeviceOnly),
	AccessibleAfterFirstUnlockThisDeviceOnly: C.CFTypeRef(C.kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly),
	AccessibleAccessibleAlwaysThisDeviceOnly: C.CFTypeRef(C.kSecAttrAccessibleAlwaysThisDeviceOnly),
}

type MatchLimit int

const (
	MatchLimitDefault MatchLimit = 0
	MatchLimitOne                = 1
	MatchLimitAll                = 2
)

var MatchLimitKey = attrKey(C.CFTypeRef(C.kSecMatchLimit))
var matchTypeRef = map[MatchLimit]C.CFTypeRef{
	MatchLimitOne: C.CFTypeRef(C.kSecMatchLimitOne),
	MatchLimitAll: C.CFTypeRef(C.kSecMatchLimitAll),
}

var ReturnAttributesKey = attrKey(C.CFTypeRef(C.kSecReturnAttributes))
var ReturnDataKey = attrKey(C.CFTypeRef(C.kSecReturnData))

// Item for adding, querying or deleting.
type Item struct {
	// Values can be string, []byte, Convertable or CFTypeRef (constant).
	attr map[string]interface{}
}

type Convertable interface {
	Convert() (C.CFTypeRef, error)
}

func (k *Item) SetSecClass(sc SecClass) {
	k.attr[SecClassKey] = secClassTypeRef[sc]
}

func (k *Item) SetString(key string, s string) {
	if s != "" {
		k.attr[key] = s
	} else {
		delete(k.attr, key)
	}
}

func (k *Item) SetService(s string) {
	k.SetString(ServiceKey, s)
}

func (k *Item) SetAccount(a string) {
	k.SetString(AccountKey, a)
}

func (k *Item) SetLabel(l string) {
	k.SetString(LabelKey, l)
}

func (k *Item) SetData(b []byte) {
	if b != nil {
		k.attr[DataKey] = b
	} else {
		delete(k.attr, DataKey)
	}
}

func (k *Item) SetAccessGroup(ag string) {
	k.SetString(AccessGroupKey, ag)
}

func (k *Item) SetSynchronizable(sync Synchronizable) {
	if sync != SynchronizableDefault {
		k.attr[SynchronizableKey] = syncTypeRef[sync]
	} else {
		delete(k.attr, SynchronizableKey)
	}
}

func (k *Item) SetAccessible(accessible Accessible) {
	if accessible != AccessibleDefault {
		k.attr[AccessibleKey] = accessibleTypeRef[accessible]
	} else {
		delete(k.attr, AccessibleKey)
	}
}

func (k *Item) SetMatchLimit(matchLimit MatchLimit) {
	if matchLimit != MatchLimitDefault {
		k.attr[MatchLimitKey] = matchTypeRef[matchLimit]
	} else {
		delete(k.attr, MatchLimitKey)
	}
}

func (k *Item) SetReturnAttributes(b bool) {
	k.attr[ReturnAttributesKey] = b
}

func (k *Item) SetReturnData(b bool) {
	k.attr[ReturnDataKey] = b
}

// NewItem is a new empty keychain item.
func NewItem() Item {
	return Item{make(map[string]interface{})}
}

// NewGenericPassword creates a generic password item. This is a convenience method.
func NewGenericPassword(service string, account string, label string, data []byte, accessGroup string) Item {
	item := NewItem()
	item.SetSecClass(SecClassGenericPassword)
	item.SetService(service)
	item.SetAccount(account)
	item.SetLabel(label)
	item.SetData(data)
	item.SetAccessGroup(accessGroup)
	return item
}

// AddItem adds a Item
func AddItem(item Item) error {
	cfDict, err := convertAttr(item.attr)
	if err != nil {
		return err
	}
	defer C.CFRelease(C.CFTypeRef(cfDict))

	errCode := C.SecItemAdd(cfDict, nil)
	err = checkError(errCode)
	return err
}

// QueryResult stores all possible results from queries.
// Not all fields are applicable all the time. Results depend on query.
type QueryResult struct {
	Service     string
	Account     string
	AccessGroup string
	Label       string
	Data        []byte
}

// QueryItem returns a list of query results.
func QueryItem(item Item) ([]QueryResult, error) {
	cfDict, err := convertAttr(item.attr)
	if err != nil {
		return nil, err
	}
	defer C.CFRelease(C.CFTypeRef(cfDict))

	var resultsRef C.CFTypeRef
	errCode := C.SecItemCopyMatching(cfDict, &resultsRef)
	if Error(errCode) == ErrorItemNotFound {
		return nil, nil
	}
	err = checkError(errCode)
	if err != nil {
		return nil, err
	}
	defer C.CFRelease(resultsRef)

	results := make([]QueryResult, 0, 1)

	typeID := C.CFGetTypeID(resultsRef)
	if typeID == C.CFArrayGetTypeID() {
		arr := cfArrayToArray(C.CFArrayRef(resultsRef))
		for _, dictRef := range arr {
			item, err := convertResult(C.CFDictionaryRef(dictRef))
			if err != nil {
				return nil, err
			}
			results = append(results, *item)
		}
	} else if typeID == C.CFDictionaryGetTypeID() {
		item, err := convertResult(C.CFDictionaryRef(resultsRef))
		if err != nil {
			return nil, err
		}
		results = append(results, *item)
	} else if typeID == C.CFDataGetTypeID() {
		b, err := cfDataToBytes(C.CFDataRef(resultsRef))
		if err != nil {
			return nil, err
		}
		item := QueryResult{Data: b}
		results = append(results, item)
	} else {
		return nil, fmt.Errorf("Invalid result type: %s", cfTypeDescription(resultsRef))
	}

	return results, nil
}

func cfTypeDescription(ref C.CFTypeRef) string {
	typeID := C.CFGetTypeID(ref)
	typeDesc := C.CFCopyTypeIDDescription(typeID)
	defer C.CFRelease(C.CFTypeRef(typeDesc))
	return cfStringToString(typeDesc)
}

func attrKey(ref C.CFTypeRef) string {
	return cfStringToString(C.CFStringRef(ref))
}

func convertResult(d C.CFDictionaryRef) (*QueryResult, error) {
	m := cfDictionaryToMap(C.CFDictionaryRef(d))
	result := QueryResult{}
	for k, v := range m {
		switch attrKey(k) {
		case ServiceKey:
			result.Service = cfStringToString(C.CFStringRef(v))
		case AccountKey:
			result.Account = cfStringToString(C.CFStringRef(v))
		case AccessGroupKey:
			result.AccessGroup = cfStringToString(C.CFStringRef(v))
		case LabelKey:
			result.Label = cfStringToString(C.CFStringRef(v))
		case DataKey:
			b, err := cfDataToBytes(C.CFDataRef(v))
			if err != nil {
				return nil, err
			}
			result.Data = b
			// default:
			// fmt.Printf("Unhandled key in conversion: %v = %v\n", cfTypeValue(k), cfTypeValue(v))
		}
	}
	return &result, nil
}

// DeleteGenericPasswordItem removes a generic password item.
func DeleteGenericPasswordItem(service string, account string) error {
	item := NewItem()
	item.SetSecClass(SecClassGenericPassword)
	item.SetService(service)
	item.SetAccount(account)
	return DeleteItem(item)
}

// DeleteItem removes a Item
func DeleteItem(item Item) error {
	cfDict, err := convertAttr(item.attr)
	if err != nil {
		return err
	}
	defer C.CFRelease(C.CFTypeRef(cfDict))

	errCode := C.SecItemDelete(cfDict)
	return checkError(errCode)
}

// Deprecated
func GetAccountsForService(service string) ([]string, error) {
	return GetGenericPasswordAccounts(service)
}

// GetGenericPasswordAccounts returns generic password accounts for service. This is a convenience method.
func GetGenericPasswordAccounts(service string) ([]string, error) {
	query := NewItem()
	query.SetSecClass(SecClassGenericPassword)
	query.SetService(service)
	query.SetMatchLimit(MatchLimitAll)
	query.SetReturnAttributes(true)
	results, err := QueryItem(query)
	if err != nil {
		return nil, err
	}

	accounts := make([]string, 0, len(results))
	for _, r := range results {
		accounts = append(accounts, r.Account)
	}

	return accounts, nil
}

// GetGenericPassword returns password data for service and account. This is a convenience method.
func GetGenericPassword(service string, account string, label string, accessGroup string) ([]byte, error) {
	query := NewItem()
	query.SetSecClass(SecClassGenericPassword)
	query.SetService(service)
	query.SetAccount(account)
	query.SetLabel(label)
	query.SetAccessGroup(accessGroup)
	query.SetMatchLimit(MatchLimitOne)
	query.SetReturnData(true)
	results, err := QueryItem(query)
	if err != nil {
		return nil, err
	}
	if len(results) > 1 {
		return nil, fmt.Errorf("Too many results")
	}
	if len(results) == 1 {
		return results[0].Data, nil
	}
	return nil, nil
}

// Covert attributes to CFDictionaryRef. You need to release the result.
func convertAttr(attr map[string]interface{}) (C.CFDictionaryRef, error) {
	m := make(map[C.CFTypeRef]C.CFTypeRef)
	for key, i := range attr {
		var valueRef C.CFTypeRef
		switch i.(type) {
		default:
			return nil, fmt.Errorf("Unsupported value type for keychain item: %v", reflect.TypeOf(i))
		case C.CFTypeRef:
			valueRef = i.(C.CFTypeRef)
		case bool:
			if i == true {
				valueRef = C.CFTypeRef(C.kCFBooleanTrue)
			} else {
				valueRef = C.CFTypeRef(C.kCFBooleanFalse)
			}
		case []byte:
			bytesRef, err := bytesToCFData(i.([]byte))
			if err != nil {
				return nil, err
			}
			valueRef = C.CFTypeRef(bytesRef)
			defer C.CFRelease(valueRef)
		case string:
			stringRef, err := stringToCFString(i.(string))
			if err != nil {
				return nil, err
			}
			valueRef = C.CFTypeRef(stringRef)
			defer C.CFRelease(valueRef)
		case Convertable:
			convertedRef, err := (i.(Convertable)).Convert()
			if err != nil {
				return nil, err
			}
			valueRef = C.CFTypeRef(convertedRef)
			defer C.CFRelease(valueRef)
		}
		keyRef, err := stringToCFString(key)
		if err != nil {
			return nil, err
		}
		m[C.CFTypeRef(keyRef)] = valueRef
	}

	cfDict, err := mapToCFDictionary(m)
	if err != nil {
		return nil, err
	}
	return cfDict, nil
}

// The returned CFDataRef, if non-nil, must be released via CFRelease.
func bytesToCFData(b []byte) (C.CFDataRef, error) {
	if uint64(len(b)) > math.MaxUint32 {
		return nil, errors.New("Data is too large")
	}
	var p *C.UInt8
	if len(b) > 0 {
		p = (*C.UInt8)(&b[0])
	}
	cfData := C.CFDataCreate(nil, p, C.CFIndex(len(b)))
	if cfData == nil {
		return nil, fmt.Errorf("CFDataCreate failed")
	}
	return cfData, nil
}

func cfDataToBytes(cfData C.CFDataRef) ([]byte, error) {
	return C.GoBytes(unsafe.Pointer(C.CFDataGetBytePtr(cfData)), C.int(C.CFDataGetLength(cfData))), nil
}

// The returned CFDictionaryRef, if non-nil, must be released via CFRelease.
func mapToCFDictionary(m map[C.CFTypeRef]C.CFTypeRef) (C.CFDictionaryRef, error) {
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
	cfDict := C.CFDictionaryCreate(nil, keysPointer, valuesPointer, C.CFIndex(numValues), &C.kCFTypeDictionaryKeyCallBacks, &C.kCFTypeDictionaryValueCallBacks)
	if cfDict == nil {
		return nil, fmt.Errorf("CFDictionaryCreate failed")
	}
	return cfDict, nil
}

// The returned CFStringRef, if non-nil, must be released via CFRelease.
func stringToCFString(s string) (C.CFStringRef, error) {
	if !utf8.ValidString(s) {
		return nil, errors.New("Invalid UTF-8 string")
	}
	if uint64(len(s)) > math.MaxUint32 {
		return nil, errors.New("String is too large")
	}

	bytes := []byte(s)
	var p *C.UInt8
	if len(bytes) > 0 {
		p = (*C.UInt8)(&bytes[0])
	}
	return C.CFStringCreateWithBytes(nil, p, C.CFIndex(len(s)), C.kCFStringEncodingUTF8, C.false), nil
}

func cfArrayToArray(cfArray C.CFArrayRef) (a []C.CFTypeRef) {
	count := C.CFArrayGetCount(cfArray)
	if count > 0 {
		a = make([]C.CFTypeRef, count)
		C.CFArrayGetValues(cfArray, C.CFRange{0, count}, (*unsafe.Pointer)(&a[0]))
	}
	return
}

func cfDictionaryToMap(cfDict C.CFDictionaryRef) (m map[C.CFTypeRef]C.CFTypeRef) {
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

func cfStringToString(s C.CFStringRef) string {
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
