// +build darwin,!ios

package attachments

/*
#cgo CFLAGS: -x objective-c -fobjc-arc
#include <Foundation/Foundation.h>
void quarantineFile(const char* inFilename) {
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
import "golang.org/x/net/context"

func Quarantine(ctx context.Context, path string) error {
	C.quarantineFile(C.CString(path))
	return nil
}
