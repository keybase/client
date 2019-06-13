// +build darwin

package attachments

/*
#cgo CFLAGS: -x objective-c -fobjc-arc
#cgo LDFLAGS: -framework AVFoundation -framework CoreFoundation -framework ImageIO -framework CoreMedia  -framework Foundation -framework CoreGraphics -lobjc

#include <TargetConditionals.h>
#include <AVFoundation/AVFoundation.h>
#include <CoreFoundation/CoreFoundation.h>
#include <Foundation/Foundation.h>
#include <ImageIO/ImageIO.h>
#if TARGET_OS_IPHONE
#include <MobileCoreServices/MobileCoreServices.h>
#endif

NSData* imageData = NULL;
int duration = 0;

void MakeVideoThumbnail(const char* inFilename) {
	NSString* filename = [NSString stringWithUTF8String:inFilename];
	NSURL *videoURL = [NSURL fileURLWithPath:filename];

	AVURLAsset *asset = [[AVURLAsset alloc] initWithURL:videoURL options:nil];
	AVAssetImageGenerator *generateImg = [[AVAssetImageGenerator alloc] initWithAsset:asset];
	[generateImg setAppliesPreferredTrackTransform:YES];
	NSError *error = NULL;
	CMTime time = CMTimeMake(1, 1);
	CGImageRef image = [generateImg copyCGImageAtTime:time actualTime:NULL error:&error];
	duration = CMTimeGetSeconds([asset duration]);

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
	imageData = [NSData dataWithData:(__bridge_transfer NSData *)mutableData];
	CFRelease(idst);
	CGImageRelease(image);
}

const void* ImageData() {
	return [imageData bytes];
}

int ImageLength() {
	return [imageData length];
}

int VideoDuration() {
	return duration;
}
*/
import "C"
import (
	"bytes"
	"errors"
	"io"
	"unsafe"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"golang.org/x/net/context"
)

func previewVideo(ctx context.Context, log utils.DebugLabeler, src io.Reader,
	basename string, nvh types.NativeVideoHelper) (res *PreviewRes, err error) {
	defer log.Trace(ctx, func() error { return err }, "previewVideo")()
	C.MakeVideoThumbnail(C.CString(basename))
	duration := int(C.VideoDuration())
	if duration < 1 {
		// clamp to 1 so we know it is a video, but also not to compute a duration for it
		duration = 1
	} else {
		duration *= 1000
	}
	log.Debug(ctx, "previewVideo: length: %d duration: %ds", C.ImageLength(), duration)
	if C.ImageLength() == 0 {
		return res, errors.New("no data returned from native")
	}
	localDat := make([]byte, C.ImageLength())
	copy(localDat, (*[1 << 30]byte)(unsafe.Pointer(C.ImageData()))[0:C.ImageLength()])
	imagePreview, err := previewImage(ctx, log, bytes.NewReader(localDat), basename, "image/jpeg")
	if err != nil {
		return res, err
	}
	return &PreviewRes{
		Source:         imagePreview.Source,
		ContentType:    "image/jpeg",
		BaseWidth:      imagePreview.BaseWidth,
		BaseHeight:     imagePreview.BaseHeight,
		BaseDurationMs: duration,
		PreviewHeight:  imagePreview.PreviewHeight,
		PreviewWidth:   imagePreview.PreviewWidth,
	}, nil
}

func LinkNoop() {}
