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

@interface KBKeybaseLaunchd : NSObject

+ (void)install:(NSString *)binPath label:(NSString *)label args:(NSArray *)args completion:(KBCompletion)completion;

+ (void)status:(NSString *)binPath name:(NSString *)name bundleVersion:(KBSemVersion *)bundleVersion completion:(KBOnServiceStatus)completion;

+ (void)run:(NSString *)binPath args:(NSArray *)args completion:(KBCompletion)completion;

@end
