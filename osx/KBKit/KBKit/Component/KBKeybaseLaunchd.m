//
//  KBKeybaseLaunchd.m
//  Keybase
//
//  Created by Gabriel on 10/27/15.
//  Copyright © 2015 Keybase. All rights reserved.
//

#import "KBKeybaseLaunchd.h"

#import "KBLaunchCtl.h"
#import "KBComponentStatus.h"
#import "KBTask.h"
#import <Mantle/Mantle.h>
#import <ObjectiveSugar/ObjectiveSugar.h>

@interface KBKeybaseLaunchd ()
@end

@implementation KBKeybaseLaunchd

+ (void)run:(NSString *)binPath args:(NSArray *)args completion:(KBCompletion)completion {
  [KBTask execute:binPath args:args completion:^(NSError *error, NSData *outData, NSData *errData) {
    completion(error);
  }];
}

+ (void)list:(NSString *)binPath name:(NSString *)name completion:(KBOnServiceStatuses)completion {
  [KBTask executeForJSONWithCommand:binPath args:@[@"--log-format=file", @"launchd", @"list", @"--format=json", name] completion:^(NSError *error, id value) {
    NSArray *statuses = [MTLJSONAdapter modelsOfClass:KBRServiceStatus.class fromJSONArray:value[name] error:&error];
    completion(nil, statuses);
  }];
}

+ (void)status:(NSString *)binPath name:(NSString *)name completion:(KBOnServiceStatus)completion {
  DDLogDebug(@"Checking launchd status for %@", name);
  [KBTask executeForJSONWithCommand:binPath args:@[@"--log-format=file", @"launchd", @"status", @"--format=json", name] completion:^(NSError *error, id value) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBRServiceStatus *status = [MTLJSONAdapter modelOfClass:KBRServiceStatus.class fromJSONDictionary:value error:&error];
    completion(nil, status);
  }];
}

@end
