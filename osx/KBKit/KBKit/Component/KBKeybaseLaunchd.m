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
#import <Mantle/Mantle.h>

@interface KBKeybaseLaunchd ()
@end

@implementation KBKeybaseLaunchd

+ (void)install:(NSString *)binPath label:(NSString *)label args:(NSArray *)args completion:(KBCompletion)completion {
  NSMutableArray *pargs = [NSMutableArray array];
  [pargs addObjectsFromArray:@[@"launchd", @"install", label, binPath]];
  [pargs addObjectsFromArray:args];
  [self execute:binPath args:pargs completion:^(NSError *error, NSData *data) {
    completion(error);
  }];
}

+ (void)run:(NSString *)binPath args:(NSArray *)args completion:(KBCompletion)completion {
  [self execute:binPath args:args completion:^(NSError *error, NSData *data) {
    completion(error);
  }];
}

+ (void)status:(NSString *)binPath name:(NSString *)name bundleVersion:(KBSemVersion *)bundleVersion completion:(KBOnServiceStatus)completion {
  [self execute:binPath args:@[@"launchd", @"status", name, [bundleVersion description]] completion:^(NSError *error, NSData *data) {
    if (error) {
      completion(error, nil);
      return;
    }
    if (!data) {
      completion(KBMakeError(-1, @"No data for launchd status"), nil);
      return;
    }

    id dict = [NSJSONSerialization JSONObjectWithData:data options:NSJSONReadingMutableContainers error:&error];
    if (error) {
      completion(error, nil);
      return;
    }
    if (!dict) {
      completion(KBMakeError(-1, @"Invalid data for launchd status"), nil);
      return;
    }

    KBRServiceStatus *status = [MTLJSONAdapter modelOfClass:KBRServiceStatus.class fromJSONDictionary:dict error:&error];
    completion(nil, status);
  }];
}

+ (void)execute:(NSString *)command args:(NSArray *)args completion:(void (^)(NSError *error, NSData *data))completion {
  NSTask *task = [[NSTask alloc] init];
  task.launchPath = command;
  task.arguments = args;
  NSPipe *outpipe = [NSPipe pipe];
  [task setStandardOutput:outpipe];
  [task setStandardError:outpipe];
  task.terminationHandler = ^(NSTask *t) {
    //DDLogDebug(@"Task: \"%@ %@\" (%@)", command, [args componentsJoinedByString:@" "], @(t.terminationStatus));
    NSFileHandle *read = [outpipe fileHandleForReading];
    NSData *data = [read readDataToEndOfFile];
    dispatch_async(dispatch_get_main_queue(), ^{
      // TODO Check termination status and complete with error if > 0
      completion(nil, data);
    });
  };

  @try {
    [task launch];
  } @catch (NSException *e) {
    completion(KBMakeError(-1, @"%@ (%@ %@)", e.reason, command, args), nil);
  }
}

@end
