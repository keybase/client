//
//  KBKeybaseLaunchd.h
//  Keybase
//
//  Created by Gabriel on 10/27/15.
//  Copyright © 2015 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBDefines.h"
#import "KBRModels.h"

typedef void (^KBOnServiceStatus)(NSError *error, KBRServiceStatus *serviceStatus);

@interface KBKeybaseLaunchd : NSObject

+ (void)status:(NSString *)binPath name:(NSString *)name timeout:(NSTimeInterval)timeout completion:(KBOnServiceStatus)completion;

@end
