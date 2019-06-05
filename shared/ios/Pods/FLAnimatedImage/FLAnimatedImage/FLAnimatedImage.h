//
//  FLAnimatedImage.h
//  Flipboard
//
//  Created by Raphael Schaad on 7/8/13.
//  Copyright (c) 2013-2015 Flipboard. All rights reserved.
//


#import <UIKit/UIKit.h>

// Allow user classes conveniently just importing one header.
#import "FLAnimatedImageView.h"


#ifndef NS_DESIGNATED_INITIALIZER
    #if __has_attribute(objc_designated_initializer)
        #define NS_DESIGNATED_INITIALIZER __attribute((objc_designated_initializer))
    #else
        #define NS_DESIGNATED_INITIALIZER
    #endif
#endif

extern const NSTimeInterval kFLAnimatedImageDelayTimeIntervalMinimum;

//
//  An `FLAnimatedImage`'s job is to deliver frames in a highly performant way and works in conjunction with `FLAnimatedImageView`.
//  It subclasses `NSObject` and not `UIImage` because it's only an "image" in the sense that a sea lion is a lion.
//  It tries to intelligently choose the frame cache size depending on the image and memory situation with the goal to lower CPU usage for smaller ones, lower memory usage for larger ones and always deliver frames for high performant play-back.
//  Note: `posterImage`, `size`, `loopCount`, `delayTimes` and `frameCount` don't change after successful initialization.
//
@interface FLAnimatedImage : NSObject

@property (nonatomic, strong, readonly) UIImage *posterImage; // Guaranteed to be loaded; usually equivalent to `-imageLazilyCachedAtIndex:0`
@property (nonatomic, assign, readonly) CGSize size; // The `.posterImage`'s `.size`

@property (nonatomic, assign, readonly) NSUInteger loopCount; // 0 means repeating the animation indefinitely
@property (nonatomic, strong, readonly) NSDictionary *delayTimesForIndexes; // Of type `NSTimeInterval` boxed in `NSNumber`s
@property (nonatomic, assign, readonly) NSUInteger frameCount; // Number of valid frames; equal to `[.delayTimes count]`

@property (nonatomic, assign, readonly) NSUInteger frameCacheSizeCurrent; // Current size of intelligently chosen buffer window; can range in the interval [1..frameCount]
@property (nonatomic, assign) NSUInteger frameCacheSizeMax; // Allow to cap the cache size; 0 means no specific limit (default)

// Intended to be called from main thread synchronously; will return immediately.
// If the result isn't cached, will return `nil`; the caller should then pause playback, not increment frame counter and keep polling.
// After an initial loading time, depending on `frameCacheSize`, frames should be available immediately from the cache.
- (UIImage *)imageLazilyCachedAtIndex:(NSUInteger)index;

// Pass either a `UIImage` or an `FLAnimatedImage` and get back its size
+ (CGSize)sizeForImage:(id)image;

// On success, the initializers return an `FLAnimatedImage` with all fields initialized, on failure they return `nil` and an error will be logged.
- (instancetype)initWithAnimatedGIFData:(NSData *)data;
// Pass 0 for optimalFrameCacheSize to get the default, predrawing is enabled by default.
- (instancetype)initWithAnimatedGIFData:(NSData *)data optimalFrameCacheSize:(NSUInteger)optimalFrameCacheSize predrawingEnabled:(BOOL)isPredrawingEnabled NS_DESIGNATED_INITIALIZER;
+ (instancetype)animatedImageWithGIFData:(NSData *)data;

@property (nonatomic, strong, readonly) NSData *data; // The data the receiver was initialized with; read-only

@end

typedef NS_ENUM(NSUInteger, FLLogLevel) {
    FLLogLevelNone = 0,
    FLLogLevelError,
    FLLogLevelWarn,
    FLLogLevelInfo,
    FLLogLevelDebug,
    FLLogLevelVerbose
};

@interface FLAnimatedImage (Logging)

+ (void)setLogBlock:(void (^)(NSString *logString, FLLogLevel logLevel))logBlock logLevel:(FLLogLevel)logLevel;
+ (void)logStringFromBlock:(NSString *(^)(void))stringBlock withLevel:(FLLogLevel)level;

@end

#define FLLog(logLevel, format, ...) [FLAnimatedImage logStringFromBlock:^NSString *{ return [NSString stringWithFormat:(format), ## __VA_ARGS__]; } withLevel:(logLevel)]

@interface FLWeakProxy : NSProxy

+ (instancetype)weakProxyForObject:(id)targetObject;

@end
