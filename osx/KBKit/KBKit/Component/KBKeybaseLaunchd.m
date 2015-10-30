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
  [self execute:binPath args:pargs completion:^(NSError *error, NSData *outData, NSData *errData) {
    completion(error);
  }];
}

+ (void)run:(NSString *)binPath args:(NSArray *)args completion:(KBCompletion)completion {
  [self execute:binPath args:args completion:^(NSError *error, NSData *outData, NSData *errData) {
    completion(error);
  }];
}

+ (void)status:(NSString *)binPath name:(NSString *)name bundleVersion:(KBSemVersion *)bundleVersion completion:(KBOnServiceStatus)completion {
  [self execute:binPath args:@[@"launchd", @"status", name, [bundleVersion description]] completion:^(NSError *error, NSData *outData, NSData *errData) {
    if (error) {
      completion(error, nil);
      return;
    }
    if (!outData) {
      completion(KBMakeError(-1, @"No data for launchd status"), nil);
      return;
    }

    id dict = [NSJSONSerialization JSONObjectWithData:outData options:NSJSONReadingMutableContainers error:&error];
    if (error) {
      DDLogError(@"Invalid data: %@", [[NSString alloc] initWithData:outData encoding:NSUTF8StringEncoding]);
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

+ (void)execute:(NSString *)command args:(NSArray *)args completion:(void (^)(NSError *error, NSData *outData, NSData *errData))completion {
  NSTask *task = [[NSTask alloc] init];
  task.launchPath = command;
  task.arguments = args;
  NSPipe *outPipe = [NSPipe pipe];
  [task setStandardOutput:outPipe];
  NSPipe *errPipe = [NSPipe pipe];
  [task setStandardError:errPipe];
  task.terminationHandler = ^(NSTask *t) {
    //DDLogDebug(@"Task: \"%@ %@\" (%@)", command, [args componentsJoinedByString:@" "], @(t.terminationStatus));
    NSFileHandle *outRead = [outPipe fileHandleForReading];
    NSData *outData = [outRead readDataToEndOfFile];
    NSFileHandle *errRead = [outPipe fileHandleForReading];
    NSData *errData = [errRead readDataToEndOfFile];
    dispatch_async(dispatch_get_main_queue(), ^{
      // TODO Check termination status and complete with error if > 0
      completion(nil, outData, errData);
    });
  };

  @try {
    DDLogDebug(@"Running: %@ %@", command, [args componentsJoinedByString:@" "]);
    [task launch];
  } @catch (NSException *e) {
    completion(KBMakeError(-1, @"%@ (%@ %@)", e.reason, command, args), nil, nil);
  }
}

@end
