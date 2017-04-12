//
//  KBKeybaseLaunchd.h
//  Keybase
//
//  Created by Gabriel on 10/27/15.
//  Copyright © 2015 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBSemVersion.h"
#import "KBRPC.h"
#import <GHODictionary/GHODictionary.h>

typedef void (^KBOnServiceStatus)(NSError *error, KBRServiceStatus *serviceStatus);
typedef void (^KBOnServiceStatuses)(NSError *error, NSArray *serviceStatuses);

@interface KBKeybaseLaunchd : NSObject

+ (void)list:(NSString *)binPath name:(NSString *)name completion:(KBOnServiceStatuses)completion;

+ (void)status:(NSString *)binPath name:(NSString *)name timeout:(NSTimeInterval)timeout completion:(KBOnServiceStatus)completion;

+ (void)run:(NSString *)binPath args:(NSArray *)args completion:(KBCompletion)completion;

@end
