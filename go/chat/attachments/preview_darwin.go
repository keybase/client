//go:build darwin
// +build darwin

package attachments

/*
#cgo CFLAGS: -x objective-c -fobjc-arc
#cgo LDFLAGS: -framework AVFoundation -framework CoreFoundation -framework ImageIO -framework CoreMedia -framework Foundation -framework CoreGraphics -framework AppKit -framework UniformTypeIdentifiers -lobjc

#include <TargetConditionals.h>
#include <AVFoundation/AVFoundation.h>
#include <CoreFoundation/CoreFoundation.h>
#include <Foundation/Foundation.h>
#include <ImageIO/ImageIO.h>
#include <AppKit/AppKit.h>
#include <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
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
		mutableData, (CFStringRef)UTTypeJPEG.identifier, 1, NULL
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

int HEICToJPEG(const char* inFilename) {
    // Load the HEIC image
	NSString* filename = [NSString stringWithUTF8String:inFilename];
	NSImage *heicImage = [[NSImage alloc] initWithContentsOfFile:filename];

    if (heicImage) {
        // Get the representations of the image
        NSArray<NSImageRep *> *imageReps = [heicImage representations];

        // Choose the first representation
        NSImageRep *imageRep = [imageReps firstObject];

        if (imageRep) {
            // Convert to NSBitmapImageRep
            NSBitmapImageRep *bitmapRep = (NSBitmapImageRep *)imageRep;
            if (bitmapRep) {
                // Get the JPEG data
                imageData = [bitmapRep representationUsingType:NSBitmapImageFileTypeJPEG properties:@{}];
				return 0;
            }
        }
    }
	return 1;
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
	defer log.Trace(ctx, &err, "previewVideo")()
	cbasename := C.CString(basename)
	defer C.free(unsafe.Pointer(cbasename))
	C.MakeVideoThumbnail(cbasename)
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
	copy(localDat, (*[1 << 30]byte)(C.ImageData())[0:C.ImageLength()])
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

func HEICToJPEG(ctx context.Context, log utils.DebugLabeler, basename string) (dat []byte, err error) {
	defer log.Trace(ctx, &err, "HEICToJPEG")()
	cbasename := C.CString(basename)
	defer C.free(unsafe.Pointer(cbasename))
	ret := C.HEICToJPEG(cbasename)
	if ret != 0 {
		log.Debug(ctx, "unable to convert heic to jpeg")
		return nil, nil
	}
	log.Debug(ctx, "HEICToJPEG: length: %d", C.ImageLength())
	dat = make([]byte, C.ImageLength())
	copy(dat, (*[1 << 30]byte)(C.ImageData())[0:C.ImageLength()])
	return dat, nil
}

func LinkNoop() {}
