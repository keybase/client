//
//  MediaUtils.m
//  KeybaseShare
//
//  Created by Song Gao on 2/20/20.
//  Copyright © 2020 Keybase. All rights reserved.
//

#import "MediaUtils.h"
#import <AVFoundation/AVFoundation.h>
#import <UIKit/UIKit.h>

@implementation MediaUtils

+ (CFDictionaryRef) _scaledImageOptions{
  return (__bridge CFDictionaryRef) @{
    (id) kCGImageSourceCreateThumbnailWithTransform : @YES,
    (id) kCGImageSourceCreateThumbnailFromImageAlways : @YES,
    (id) kCGImageSourceThumbnailMaxPixelSize : @(1200),
  };
}

+ (CFDictionaryRef) _thumbnailImageOptions{
  return (__bridge CFDictionaryRef) @{
    (id) kCGImageSourceCreateThumbnailWithTransform : @YES,
    (id) kCGImageSourceCreateThumbnailFromImageAlways : @YES,
    (id) kCGImageSourceThumbnailMaxPixelSize : @(480),
  };
}

+ (NSError *) _scaleDownCGImageSourceRef:(CGImageSourceRef)img dstURL:(NSURL *)dstURL options:(CFDictionaryRef)options {
  NSLog(@"dstURL: %@", dstURL);
  CGImageRef scaledRef = CGImageSourceCreateThumbnailAtIndex(img, 0, options);
  NSData * scaled = UIImageJPEGRepresentation([UIImage imageWithCGImage:scaledRef], 0.85);
  CGImageRelease(scaledRef);
  BOOL OK = [scaled writeToURL:dstURL atomically:true];
  if (!OK) {
    return [NSError errorWithDomain:@"MediaUtils" code:1 userInfo:@{NSLocalizedDescriptionKey:@"error writing scaled down image"}];
  }
  return nil;
}

+ (void) processImageFromOriginal:(NSURL*)url completion:(ProcessMediaCompletion)completion {
  NSString * basename = [[url URLByDeletingPathExtension] lastPathComponent];
  NSURL * parent = [url URLByDeletingLastPathComponent];
  NSURL * scaledURL = [parent URLByAppendingPathComponent:[NSString stringWithFormat:@"%@.scaled.jpg", basename]];
  NSURL * thumbnailURL = [parent URLByAppendingPathComponent:[NSString stringWithFormat:@"%@.thumbnail.jpg", basename]];
  
  CGImageSourceRef cgSource = CGImageSourceCreateWithURL((__bridge CFURLRef)url, nil);
  
  NSError * error = [MediaUtils _scaleDownCGImageSourceRef:cgSource dstURL:scaledURL options:[MediaUtils _scaledImageOptions]];
  if (error != nil) {
    completion(error, nil, nil);
    return;
  }
  
  error = [MediaUtils _scaleDownCGImageSourceRef:cgSource dstURL:thumbnailURL options:[MediaUtils _thumbnailImageOptions]];
  if (error != nil) {
    completion(error, nil, nil);
    return;
  }
  
  completion(nil, scaledURL, thumbnailURL);
}

+ (void) processVideoFromOriginal:(NSURL*)url completion:(ProcessMediaCompletion)completion {
  NSString * basename = [[url URLByDeletingPathExtension] lastPathComponent];
  NSURL * parent = [url URLByDeletingLastPathComponent];
  NSURL * normalVideoURL = [parent URLByAppendingPathComponent:[NSString stringWithFormat:@"%@.scaled.mp4", basename]];
  NSURL * thumbnailURL = [parent URLByAppendingPathComponent:[NSString stringWithFormat:@"%@.thumbnail.jpg", basename]];
  NSError * error;
  
  AVURLAsset * asset = [[AVURLAsset alloc] initWithURL:url options:nil];
  
  CMTime time = CMTimeMake(1, 1);
  AVAssetImageGenerator *generateImg = [[AVAssetImageGenerator alloc] initWithAsset:asset];
  [generateImg setAppliesPreferredTrackTransform:YES];
  CGImageRef cgOriginal = [generateImg copyCGImageAtTime:time actualTime:NULL error:&error];
  if (error != nil) {
    completion(error, nil, nil);
    return;
  }
  
  // TODO: this is just the original frame. Figure out how to make thumbnail work here.
  /*
  CGImageSourceRef cfSouruce = CGImageSourceCreateWithDataProvider(CGImageGetDataProvider(cgOriginal), nil);
  error = [MediaUtils _scaleDownCGImageSourceRef:cfSouruce dstURL:thumbnailURL options:[MediaUtils _thumbnailImageOptions]];
  CGImageRelease(cgOriginal);
  if (error != nil) {
    NSLog(@"scale down error: %@", error);
    completion(error, nil, nil);
    return;
  }
   */
  NSData * thumbnail = UIImageJPEGRepresentation([UIImage imageWithCGImage:cgOriginal], 0.85);
  BOOL OK = [thumbnail writeToURL:thumbnailURL atomically:true];
  if (!OK) {
    completion([NSError errorWithDomain:@"MediaUtils" code:1 userInfo:@{NSLocalizedDescriptionKey:@"error getting thumbnail for video"}], nil, nil);
    return;
  }
  
  NSArray<AVAssetTrack *> * tracks = [asset tracks];
  BOOL needScaleDown = false;
  if (tracks != nil){
    for (int i = 0; i < tracks.count; ++i) {
      CGSize size = [tracks[i] naturalSize];
      if (size.height * size.width > 640*480) {
        needScaleDown = true;
        break;
      }
    }
  }
  if (!needScaleDown) {
    completion(nil, url, thumbnailURL);
    return;
  }
  
  AVAssetExportSession * exportSession = [[AVAssetExportSession alloc] initWithAsset:asset presetName:AVAssetExportPreset640x480];
  exportSession.shouldOptimizeForNetworkUse = true;
  exportSession.outputFileType = AVFileTypeMPEG4;
  exportSession.outputURL = normalVideoURL;
  [exportSession exportAsynchronouslyWithCompletionHandler:^{
    if (exportSession.error != nil) {
      completion(exportSession.error, nil, nil);
      return;
    }
    completion(nil, normalVideoURL, thumbnailURL);
  }];
}

@end
