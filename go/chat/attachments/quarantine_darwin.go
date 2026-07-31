//go:build darwin && !ios

package attachments

/*
#cgo CFLAGS: -x objective-c -fobjc-arc
#include <Foundation/Foundation.h>
// Name must stay package-specific: kbfs/simplefs has an identical shim, and
// go/bind links both into one binary, so a shared name is a duplicate symbol.
void chatAttachmentsQuarantineFile(const char* inFilename) {
	NSError* error = NULL;
	NSString* filename = [NSString stringWithUTF8String:inFilename];
	NSURL* url = [NSURL fileURLWithPath:filename];
	NSDictionary* opts = [[NSDictionary alloc] initWithObjectsAndKeys:
				(id)@"Keybase", (id)kLSQuarantineAgentNameKey,
				(id)kLSQuarantineTypeOtherDownload, (id)kLSQuarantineTypeKey,
				nil];
	[url setResourceValue:opts forKey:NSURLQuarantinePropertiesKey error:&error];
}
*/
import "C"

import (
	"context"
	"unsafe"
)

func Quarantine(ctx context.Context, path string) error {
	cpath := C.CString(path)
	defer C.free(unsafe.Pointer(cpath))
	C.chatAttachmentsQuarantineFile(cpath)
	return nil
}
