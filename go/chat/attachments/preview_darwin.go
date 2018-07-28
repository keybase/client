// +build darwin

package attachments

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework AVFoundation -framework CoreFoundation -framework ImageIO -framework CoreMedia -framework CoreServices -framework Foundation -lobjc

#include <AVFoundation/AVFoundation.h>

NSMutableData* makeVideoThumbnail(const char* inFilename) {
	NSString* filename = [NSString stringWithUTF8String:inFilename];
	NSURL *videoURL = [NSURL fileURLWithPath:filename];

	AVURLAsset *asset = [[AVURLAsset alloc] initWithURL:videoURL options:nil];
	AVAssetImageGenerator *generateImg = [[AVAssetImageGenerator alloc] initWithAsset:asset];
	NSError *error = NULL;
	CMTime time = CMTimeMake(1, 1);
	CGImageRef refImg = [generateImg copyCGImageAtTime:time actualTime:NULL error:&error];

	NSMutableData *imageData = nil;
	CGImageDestinationRef destination = NULL;
	imageData = [NSMutableData data];
	destination = CGImageDestinationCreateWithData((CFMutableDataRef)imageData, kUTTypeJPEG, 1, NULL);
	CGImageDestinationFinalize(destination);
	return imageData;
}
*/
import "C"
import (
	"io"

	"github.com/keybase/client/go/chat/utils"
	"golang.org/x/net/context"
)

func previewVideo(ctx context.Context, log utils.DebugLabeler, src io.Reader, basename string) (*PreviewRes, error) {
	C.makeVideoThumbnail(C.CString(basename))
	return nil, nil
}
