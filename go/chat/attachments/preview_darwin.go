// +build darwin

package attachments

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework AVFoundation -framework CoreFoundation -framework ImageIO -framework CoreMedia -framework CoreServices -framework Foundation -framework CoreGraphics -lobjc

#include <AVFoundation/AVFoundation.h>

NSData* imageData = NULL;

void MakeVideoThumbnail(const char* inFilename) {
	NSString* filename = [NSString stringWithUTF8String:inFilename];
	NSURL *videoURL = [NSURL fileURLWithPath:filename];

	AVURLAsset *asset = [[AVURLAsset alloc] initWithURL:videoURL options:nil];
	AVAssetImageGenerator *generateImg = [[AVAssetImageGenerator alloc] initWithAsset:asset];
	NSError *error = NULL;
	CMTime time = CMTimeMake(1, 1);
	CGImageRef image = [generateImg copyCGImageAtTime:time actualTime:NULL error:&error];

	CFMutableDataRef mutableData = CFDataCreateMutable(NULL, 0);
	CGImageDestinationRef idst = CGImageDestinationCreateWithData(
		mutableData, kUTTypeJPEG, 1, NULL
	);
	NSInteger exif             =    1;
	CGFloat compressionQuality = 0.70;
	NSDictionary *props = [
		[NSDictionary alloc]
		initWithObjectsAndKeys:[NSNumber numberWithFloat:compressionQuality],
		kCGImageDestinationLossyCompressionQuality,
		[NSNumber numberWithInteger:exif],
		kCGImagePropertyOrientation, nil
	];
	CGImageDestinationAddImage(idst, image, (CFDictionaryRef)props);
	CGImageDestinationFinalize(idst);
	imageData = [NSData dataWithData:(NSData *)mutableData];
	[props release];
	CFRelease(idst);
	CFRelease(mutableData);
	CGImageRelease(image);
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
	"bytes"
	"io"
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
	log.Debug(ctx, "previewVideo: length: %d", C.ImageLength())
	localDat := make([]byte, C.ImageLength())
	copy(localDat, (*[1 << 30]byte)(unsafe.Pointer(C.ImageData()))[0:C.ImageLength()])
	C.ImageFree()
	return previewImage(ctx, log, bytes.NewReader(localDat), basename, "image/jpeg")
}
