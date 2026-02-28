//go:build darwin
// +build darwin

package attachments

/*
#cgo CFLAGS: -x objective-c -fobjc-arc -Werror=unguarded-availability-new
#cgo LDFLAGS: -framework AVFoundation -framework CoreFoundation -framework ImageIO -framework CoreMedia -framework Foundation -framework CoreGraphics -framework AppKit -framework UniformTypeIdentifiers -lobjc

#include <TargetConditionals.h>
#include <AVFoundation/AVFoundation.h>
#include <CoreFoundation/CoreFoundation.h>
#include <Foundation/Foundation.h>
#include <ImageIO/ImageIO.h>
#include <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
#if TARGET_OS_IPHONE
#include <MobileCoreServices/MobileCoreServices.h>
#include <UIKit/UIKit.h>
#else
#include <AppKit/AppKit.h>
#endif

typedef struct {
	const void* imageData;
	int imageLength;
	int duration;
} VideoPreviewResult;

typedef struct {
	const void* imageData;
	int imageLength;
} ImageConversionResult;

VideoPreviewResult MakeVideoThumbnail(const char* inFilename) {
	VideoPreviewResult result = {NULL, 0, 0};
	NSString* filename = [NSString stringWithUTF8String:inFilename];
	NSURL *videoURL = [NSURL fileURLWithPath:filename];

	AVURLAsset *asset = [[AVURLAsset alloc] initWithURL:videoURL options:nil];
	AVAssetImageGenerator *generateImg = [[AVAssetImageGenerator alloc] initWithAsset:asset];
	[generateImg setAppliesPreferredTrackTransform:YES];
	CMTime time = CMTimeMake(1, 1);
	// NOTE Once iOS <16 support is dropped generateCGImageAsynchronouslyForTime can be used. https://github.com/keybase/client/pull/28530
	NSError *error = NULL;
	CGImageRef image = [generateImg copyCGImageAtTime:time actualTime:NULL error:&error];
	result.duration = (int)CMTimeGetSeconds([asset duration]);

	if (image != NULL) {
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
		NSData *localImageData = [[NSData alloc] initWithData:(__bridge_transfer NSData *)mutableData];
		result.imageData = [localImageData bytes];
		result.imageLength = (int)[localImageData length];
		CFRelease(idst);
		CGImageRelease(image);
	}

	return result;
}

#if TARGET_OS_IPHONE
ImageConversionResult HEICToJPEG(const char* inFilename) {
	ImageConversionResult result = {NULL, 0};
	NSString* filename = [NSString stringWithUTF8String:inFilename];
	UIImage* heicImage = [UIImage imageWithContentsOfFile:filename];
	if (heicImage) {
		NSData *localImageData = UIImageJPEGRepresentation(heicImage, 1.0);
		if (localImageData) {
			result.imageData = [localImageData bytes];
			result.imageLength = (int)[localImageData length];
		}
	}
	return result;
}
#else
ImageConversionResult HEICToJPEG(const char* inFilename) {
	ImageConversionResult result = {NULL, 0};
	NSString* filename = [NSString stringWithUTF8String:inFilename];
	NSImage *heicImage = [[NSImage alloc] initWithContentsOfFile:filename];
    if (heicImage) {
        NSArray<NSImageRep *> *imageReps = [heicImage representations];
        NSImageRep *imageRep = [imageReps firstObject];
        if (imageRep) {
            NSBitmapImageRep *bitmapRep = (NSBitmapImageRep *)imageRep;
            if (bitmapRep) {
                NSData *localImageData = [bitmapRep representationUsingType:NSBitmapImageFileTypeJPEG properties:@{}];
				if (localImageData) {
					result.imageData = [localImageData bytes];
					result.imageLength = (int)[localImageData length];
				}
            }
        }
    }
	return result;
}
#endif
*/
import "C"

import (
	"bytes"
	"context"
	"errors"
	"io"
	"unsafe"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
)

func previewVideo(ctx context.Context, log utils.DebugLabeler, src io.Reader,
	basename string, nvh types.NativeVideoHelper,
) (res *PreviewRes, err error) {
	defer log.Trace(ctx, &err, "previewVideo")()
	cbasename := C.CString(basename)
	defer C.free(unsafe.Pointer(cbasename))
	result := C.MakeVideoThumbnail(cbasename)
	duration := int(result.duration)
	if duration < 1 {
		// clamp to 1 so we know it is a video, but also not to compute a duration for it
		duration = 1
	} else {
		duration *= 1000
	}
	log.Debug(ctx, "previewVideo: length: %d duration: %ds", result.imageLength, duration)
	if result.imageLength == 0 {
		return res, errors.New("no data returned from native")
	}
	localDat := make([]byte, result.imageLength)
	copy(localDat, (*[1 << 30]byte)(result.imageData)[0:result.imageLength])
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
	result := C.HEICToJPEG(cbasename)
	log.Debug(ctx, "HEICToJPEG: length: %d", result.imageLength)
	if result.imageLength == 0 {
		log.Debug(ctx, "unable to convert heic to jpeg")
		return nil, nil
	}
	dat = make([]byte, result.imageLength)
	copy(dat, (*[1 << 30]byte)(result.imageData)[0:result.imageLength])
	return dat, nil
}

func LinkNoop() {}
