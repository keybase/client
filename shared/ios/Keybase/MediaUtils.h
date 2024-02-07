//
//  MediaUtils.h
//  KeybaseShare
//
//  Created by Song Gao on 2/20/20.
//  Copyright © 2020 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN
typedef void (^ProcessMediaCompletion) (NSError* _Nullable error, NSURL* _Nullable scaled);
typedef void (^ProcessMediaCompletionErrorOnly) (NSError* _Nullable error);


@interface MediaUtils : NSObject
+ (void)processImageFromOriginal:(NSURL*)url completion:(ProcessMediaCompletion)completion;
+ (void)processVideoFromOriginal:(NSURL*)url completion:(ProcessMediaCompletion)completion;
@end

NS_ASSUME_NONNULL_END
