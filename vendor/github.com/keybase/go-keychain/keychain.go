// +build darwin

package keychain

// See https://developer.apple.com/library/ios/documentation/Security/Reference/keychainservices/index.html for the APIs used below.

// Also see https://developer.apple.com/library/ios/documentation/Security/Conceptual/keychainServConcepts/01introduction/introduction.html .

/*
#cgo LDFLAGS: -framework CoreFoundation -framework Security

#include <CoreFoundation/CoreFoundation.h>
#include <Security/Security.h>
*/
import "C"
import "fmt"

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
var ReturnRefKey = attrKey(C.CFTypeRef(C.kSecReturnRef))

// Item for adding, querying or deleting.
type Item struct {
	// Values can be string, []byte, Convertable or CFTypeRef (constant).
	attr map[string]interface{}
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

func (k *Item) SetReturnRef(b bool) {
	k.attr[ReturnRefKey] = b
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
	cfDict, err := ConvertMapToCFDictionary(item.attr)
	if err != nil {
		return err
	}
	defer Release(C.CFTypeRef(cfDict))

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

// QueryItemRef returns query result as CFTypeRef. You must release it when you are done.
func QueryItemRef(item Item) (C.CFTypeRef, error) {
	cfDict, err := ConvertMapToCFDictionary(item.attr)
	if err != nil {
		return nil, err
	}
	defer Release(C.CFTypeRef(cfDict))

	var resultsRef C.CFTypeRef
	errCode := C.SecItemCopyMatching(cfDict, &resultsRef)
	if Error(errCode) == ErrorItemNotFound {
		return nil, nil
	}
	err = checkError(errCode)
	if err != nil {
		return nil, err
	}
	return resultsRef, nil
}

// QueryItem returns a list of query results.
func QueryItem(item Item) ([]QueryResult, error) {
	resultsRef, err := QueryItemRef(item)
	if err != nil {
		return nil, err
	}
	if resultsRef == nil {
		return nil, nil
	}
	defer Release(resultsRef)

	results := make([]QueryResult, 0, 1)

	typeID := C.CFGetTypeID(resultsRef)
	if typeID == C.CFArrayGetTypeID() {
		arr := CFArrayToArray(C.CFArrayRef(resultsRef))
		for _, ref := range arr {
			typeID := C.CFGetTypeID(ref)
			if typeID == C.CFDictionaryGetTypeID() {
				item, err := convertResult(C.CFDictionaryRef(ref))
				if err != nil {
					return nil, err
				}
				results = append(results, *item)
			} else {
				return nil, fmt.Errorf("Invalid result type (If you SetReturnRef(true) you should use QueryItemRef directly).")
			}
		}
	} else if typeID == C.CFDictionaryGetTypeID() {
		item, err := convertResult(C.CFDictionaryRef(resultsRef))
		if err != nil {
			return nil, err
		}
		results = append(results, *item)
	} else if typeID == C.CFDataGetTypeID() {
		b, err := CFDataToBytes(C.CFDataRef(resultsRef))
		if err != nil {
			return nil, err
		}
		item := QueryResult{Data: b}
		results = append(results, item)
	} else {
		return nil, fmt.Errorf("Invalid result type: %s", CFTypeDescription(resultsRef))
	}

	return results, nil
}

func attrKey(ref C.CFTypeRef) string {
	return CFStringToString(C.CFStringRef(ref))
}

func convertResult(d C.CFDictionaryRef) (*QueryResult, error) {
	m := CFDictionaryToMap(C.CFDictionaryRef(d))
	result := QueryResult{}
	for k, v := range m {
		switch attrKey(k) {
		case ServiceKey:
			result.Service = CFStringToString(C.CFStringRef(v))
		case AccountKey:
			result.Account = CFStringToString(C.CFStringRef(v))
		case AccessGroupKey:
			result.AccessGroup = CFStringToString(C.CFStringRef(v))
		case LabelKey:
			result.Label = CFStringToString(C.CFStringRef(v))
		case DataKey:
			b, err := CFDataToBytes(C.CFDataRef(v))
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
	cfDict, err := ConvertMapToCFDictionary(item.attr)
	if err != nil {
		return err
	}
	defer Release(C.CFTypeRef(cfDict))

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
// If item is not found returns nil, nil.
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
