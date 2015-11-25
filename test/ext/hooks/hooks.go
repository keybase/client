package main

//
// /* Helpers for passing around arrays via the FFI. */
//
// /*
//  * TODO: These structs leak as do any strings returned via C.CString().
//  *       This isn't such a big deal right now but we should fix it.
//  */
//
// #include <stdlib.h>
//
// typedef struct { long long size; const char **array; } StringArray;
// typedef struct { void *t; void *v; } Interface;
// typedef struct { long long size; Interface *array; } InterfaceArray;
//
// static StringArray* newStringArray(long long size) {
//     StringArray *sa = malloc(sizeof(StringArray));
//     sa->array = malloc(sizeof(char*) * size);
//     sa->size = size;
//     return sa;
// }
//
// static void setString(StringArray *sa, char *s, long long index) {
//     sa->array[index] = s;
// }
//
// static const char* stringAt(const StringArray *sa, long long index) {
//     return sa->array[index];
// }
//
// static InterfaceArray* newInterfaceArray(long long size) {
//     InterfaceArray *ia = malloc(sizeof(InterfaceArray));
//     ia->array = malloc(sizeof(Interface) * size);
//     ia->size = size;
//     return ia;
// }
//
// static void setInterface(InterfaceArray *ia, void *i, long long index) {
//      ia->array[index] = *(Interface*)i;
// }
//
import "C"

import (
	test "github.com/keybase/kbfs/test/ext"
	"unsafe"
)

// Global engine delegate.
var engine test.Engine

// Init initializes the engine registry and creates the necessary engine.
//export Init
func Init(engineName *C.char) (ok bool) {
	engineRegistry := make(map[string]test.Engine)

	// register new engines here
	engineRegistry["libkbfs"] = &test.LibKBFS{}

	engine, ok = engineRegistry[C.GoString(engineName)]
	if !ok {
		return false
	}
	engine.Init()
	return true
}

// InitTest creates the specified set of users for the active engine.
//export InitTest
func InitTest(blockSize int64, names *C.StringArray) *C.InterfaceArray {
	userNames := arrayToStrings(names)
	userMap := engine.InitTest(blockSize, userNames...)
	users := make([]interface{}, len(userMap))
	for i, name := range userNames {
		users[i] = userMap[name]
	}
	return interfacesToArray(users)
}

// GetUID returns the UID of a given user from the engine.
//export GetUID
func GetUID(u interface{}) *C.char {
	return C.CString(engine.GetUID(u).String())
}

// GetRootDir returns the root dir of the given folder.
//export GetRootDir
func GetRootDir(u interface{}, isPublic bool, writers *C.StringArray, readers *C.StringArray) (
	dir interface{}, errString *C.char) {

	writerNames := arrayToStrings(writers)
	readerNames := arrayToStrings(readers)

	var err error
	dir, err = engine.GetRootDir(u, isPublic, writerNames, readerNames)
	if err != nil {
		errString = C.CString(err.Error())
	}
	return dir, errString
}

// CreateDir creates a subdirectory under the given parent node.
//export CreateDir
func CreateDir(u, parent interface{}, name *C.char) (dir interface{}, errString *C.char) {
	var err error
	dir, err = engine.CreateDir(u, parent, C.GoString(name))
	if err != nil {
		errString = C.CString(err.Error())
	}
	return dir, errString
}

// CreateFile creates a file under the given parent node.
//export CreateFile
func CreateFile(u, parent interface{}, name *C.char) (file interface{}, errString *C.char) {
	var err error
	file, err = engine.CreateFile(u, parent, C.GoString(name))
	if err != nil {
		errString = C.CString(err.Error())
	}
	return file, errString
}

// CreateLink creates a symlink under the given parent node.
//export CreateLink
func CreateLink(u, parent interface{}, fromName, toPath *C.char) (errString *C.char) {
	err := engine.CreateLink(u, parent, C.GoString(fromName), C.GoString(toPath))
	if err != nil {
		errString = C.CString(err.Error())
	}
	return errString
}

// RemoveDir removes a directory from under the given dir.
//export RemoveDir
func RemoveDir(u, dir interface{}, name *C.char) (errString *C.char) {
	err := engine.RemoveDir(u, dir, C.GoString(name))
	if err != nil {
		errString = C.CString(err.Error())
	}
	return errString
}

// RemoveEntry removes a file from under the given dir.
//export RemoveEntry
func RemoveEntry(u, dir interface{}, name *C.char) (errString *C.char) {
	err := engine.RemoveEntry(u, dir, C.GoString(name))
	if err != nil {
		errString = C.CString(err.Error())
	}
	return errString
}

// Rename renames an entry from one directory to another.
//export Rename
func Rename(u, srcDir interface{}, srcName *C.char, dstDir interface{}, dstName *C.char) (errString *C.char) {
	err := engine.Rename(u, srcDir, C.GoString(srcName), dstDir, C.GoString(dstName))
	if err != nil {
		errString = C.CString(err.Error())
	}
	return errString
}

// WriteFile writes data to the given file node.
//export WriteFile
func WriteFile(u, file interface{}, data *C.char, off int64, sync bool) (errString *C.char) {
	err := engine.WriteFile(u, file, C.GoString(data), off, sync)
	if err != nil {
		errString = C.CString(err.Error())
	}
	return errString
}

// Sync syncs the given file node, flushing all recently-written data.
//export Sync
func Sync(u, file interface{}) (errString *C.char) {
	err := engine.Sync(u, file)
	if err != nil {
		errString = C.CString(err.Error())
	}
	return errString
}

// ReadFile reads data out of the given file node.
//export ReadFile
func ReadFile(u, file interface{}, off, len int64) (data, errString *C.char) {
	var err error
	var d string
	d, err = engine.ReadFile(u, file, off, len)
	if err != nil {
		errString = C.CString(err.Error())
	} else {
		data = C.CString(d)
	}
	return data, errString
}

// Lookup looks up the direntry for a given name out of the given parent.
//export Lookup
func Lookup(u, parent interface{}, name *C.char) (file interface{}, symPath, errString *C.char) {
	var symP string
	var err error
	file, symP, err = engine.Lookup(u, parent, C.GoString(name))
	if err != nil {
		errString = C.CString(err.Error())
	}
	if len(symP) != 0 {
		symPath = C.CString(symP)
	}
	return file, symPath, errString
}

// GetDirChildren lists all the children of a given dir node.
//export GetDirChildren
func GetDirChildren(u, parent interface{}) (children *C.StringArray, errString *C.char) {
	entries, err := engine.GetDirChildren(u, parent)
	if err != nil {
		errString = C.CString(err.Error())
		return children, errString
	}
	var flattened []string
	for entryName, entryType := range entries {
		flattened = append(flattened, entryName)
		flattened = append(flattened, entryType)
	}
	return stringsToArray(flattened), nil
}

// DisableUpdatesForTesting stops the given user from getting updates and
// from doing conflict resolution.
//export DisableUpdatesForTesting
func DisableUpdatesForTesting(u, folder interface{}) (errString *C.char) {
	err := engine.DisableUpdatesForTesting(u, folder)
	if err != nil {
		errString = C.CString(err.Error())
	}
	return errString
}

// SetEx toggles the executability of the given file.
//export SetEx
func SetEx(u, file interface{}, ex bool) (errString *C.char) {
	err := engine.SetEx(u, file, ex)
	if err != nil {
		errString = C.CString(err.Error())
	}
	return errString
}

// ReenableUpdates re-enables CR and updates for the given user.
//export ReenableUpdates
func ReenableUpdates(u, folder interface{}) {
	engine.ReenableUpdates(u, folder)
}

// SyncFromServer blocks until the user has finished CR and fetched the
// latest updates from the server.
//export SyncFromServer
func SyncFromServer(u, folder interface{}) (errString *C.char) {
	err := engine.SyncFromServer(u, folder)
	if err != nil {
		errString = C.CString(err.Error())
	}
	return errString
}

// Shutdown shuts down the test for the given user.
//export Shutdown
func Shutdown(u interface{}) {
	engine.Shutdown(u)
}

// PrintLog prints the logs for the last test.
//export PrintLog
func PrintLog() {
	engine.PrintLog()
}

// CheckState checks the state of the given folder for consistency.
//export CheckState
func CheckState(u, folder interface{}) (errString *C.char) {
	err := engine.CheckState(u, folder)
	if err != nil {
		errString = C.CString(err.Error())
	}
	return errString
}

// Helper to convert from C.StringArray to []string
func arrayToStrings(arg *C.StringArray) (strings []string) {
	strings = make([]string, int(arg.size))
	for i := 0; i < int(arg.size); i++ {
		s := C.stringAt(arg, C.longlong(i))
		strings[i] = C.GoString(s)
	}
	return strings
}

// Helper to convert from []string to C.StringArray
func stringsToArray(strings []string) *C.StringArray {
	array := C.newStringArray(C.longlong(len(strings)))
	for i, s := range strings {
		C.setString(array, C.CString(s), C.longlong(i))
	}
	return array
}

// Helper to convert from []interface{} to C.InterfaceArray
func interfacesToArray(interfaces []interface{}) *C.InterfaceArray {
	array := C.newInterfaceArray(C.longlong(len(interfaces)))
	for i, iface := range interfaces {
		C.setInterface(array, unsafe.Pointer(&iface), C.longlong(i))
	}
	return array
}

func main() {}
