//
//  KBKeybaseLaunchd.m
//  Keybase
//
//  Created by Gabriel on 10/27/15.
//  Copyright © 2015 Keybase. All rights reserved.
//

#import "KBKeybaseLaunchd.h"

#import "KBComponentStatus.h"
#import "KBTask.h"
#import <Mantle/Mantle.h>
#import <ObjectiveSugar/ObjectiveSugar.h>
#import "KBInstallable.h"

@interface KBKeybaseLaunchd ()
@end

@implementation KBKeybaseLaunchd

+ (void)status:(NSString *)binPath name:(NSString *)name timeout:(NSTimeInterval)timeout completion:(KBOnServiceStatus)completion {
  DDLogDebug(@"Checking launchd status for %@", name);
  [KBTask executeForJSONWithCommand:binPath args:@[@"-d", @"--log-format=file", @"launchd", @"status", @"--format=json", NSStringWithFormat(@"--timeout=%@s", @(timeout)), name] timeout:KBDefaultTaskTimeout completion:^(NSError *error, id value) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBRServiceStatus *status = [MTLJSONAdapter modelOfClass:KBRServiceStatus.class fromJSONDictionary:value error:&error];
    completion(nil, status);
  }];
}

@end
