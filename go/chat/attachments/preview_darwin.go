// +build darwin

package attachments

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework AVFoundation -framework CoreFoundation -framework ImageIO -framework CoreMedia -framework CoreServices -framework Foundation -lobjc

#include <AVFoundation/AVFoundation.h>

NSData* imageData = NULL;

void MakeVideoThumbnail(const char* inFilename) {
	NSString* filename = [NSString stringWithUTF8String:inFilename];
	NSURL *videoURL = [NSURL fileURLWithPath:filename];

	AVURLAsset *asset = [[AVURLAsset alloc] initWithURL:videoURL options:nil];
	AVAssetImageGenerator *generateImg = [[AVAssetImageGenerator alloc] initWithAsset:asset];
	NSError *error = NULL;
	CMTime time = CMTimeMake(1, 1);
	CGImageRef refImg = [generateImg copyCGImageAtTime:time actualTime:NULL error:&error];

	imageData = NULL;
	CGImageDestinationRef destination = NULL;
	imageData = [NSMutableData data];
	destination = CGImageDestinationCreateWithData((CFMutableDataRef)imageData, kUTTypeJPEG, 1, NULL);
	CGImageDestinationFinalize(destination);
}

const void* ImageData() {
	return [imageData bytes];
}

void ImageFree() {
	[imageData release];
}

int ImageLength() {
	return [imageData length];
}
*/
import "C"
import (
	"io"
	"io/ioutil"
	"unsafe"

	"github.com/keybase/client/go/chat/utils"
	"golang.org/x/net/context"
)

func CFDataToBytes(cfData C.CFDataRef) ([]byte, error) {
	return C.GoBytes(unsafe.Pointer(C.CFDataGetBytePtr(cfData)), C.int(C.CFDataGetLength(cfData))), nil
}

func previewVideo(ctx context.Context, log utils.DebugLabeler, src io.Reader, basename string) (res *PreviewRes, err error) {
	defer log.Trace(ctx, func() error { return err }, "previewVideo")()
	C.MakeVideoThumbnail(C.CString(basename))
	ioutil.WriteFile(
		"/tmp/s.jpg",
		(*[1 << 30]byte)(unsafe.Pointer(C.ImageData()))[0:C.ImageLength()],
		0644,
	)
	C.ImageFree()
	return nil, nil
}
