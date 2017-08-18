//
//  KBFinder.m
//  Keybase
//
//  Created by Gabriel on 6/16/15.
//  Copyright (c) 2017 Keybase. All rights reserved.
//

#import "KBFinder.h"

#import <AppKit/AppKit.h>
#import <CocoaLumberjack/CocoaLumberjack.h>

#import "KBWorkspace.h"
#import "KBAppExtension.h"
#import "KBRPClient.h"

@interface KBFinder ()
@property (nonatomic) KBRPClient *client;
@end

@implementation KBFinder

- (instancetype)initWithFinderSyncController:(FIFinderSyncController *)finderSyncController {
  if ((self = [super init])) {
    NSString *mountDir = [KBWorkspace.userDefaults objectForKey:@"MountDir"];
    if (mountDir) {
      DDLogDebug(@"Finder sync using: %@", mountDir);
      finderSyncController.directoryURLs = [NSSet setWithObject:[NSURL fileURLWithPath:mountDir]];
    } else {
      DDLogDebug(@"No mount for finder sync");
    }

    // Configure badge images for file fileStatuses
    for (id s in @[@(KBFSFileStatusNone), @(KBFSFileStatusUnavailable), @(KBFSFileStatusPartiallyAvailable), @(KBFSFileStatusAvailable)]) {
      KBFSFileStatus fileStatus = [s integerValue];
      NSImage *image = [self imageForFileStatus:fileStatus];
      if (image) {
        NSString *label = [self labelForFileStatus:fileStatus];
        NSString *badgeId = [self badgeIdForFileStatus:fileStatus];
        //DDLogDebug(@"Image: %@, %@, %@", image, label, badgeId);
        [finderSyncController setBadgeImage:image label:label forBadgeIdentifier:badgeId];
      }
    }
  }
  return self;
}

- (KBRPClient *)client {
  if (!_client) {
    KBEnvConfig *config = [KBEnvConfig envConfigFromUserDefaults:[KBWorkspace userDefaults]];
    _client = [[KBRPClient alloc] initWithConfig:config options:KBRClientOptionsAutoRetry];
  }
  return _client;
}

- (void)badgeIdForPath:(NSString *)path completion:(void (^)(NSString *badgeId))completion {
  if (!path) {
    completion(@"");
    return;
  }
  [self fileStatusForPath:path completion:^(KBFSFileStatus fileStatus) {
    completion([self badgeIdForFileStatus:fileStatus]);
  }];
}

- (void)fileStatusForPath:(NSString *)path completion:(void (^)(KBFSFileStatus fileStatus))completion {
  // Mock
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    KBFSFileStatus status = KBFSFileStatusUnknown;
    if ([path.pathExtension isEqualToString:@"ok"]) status = KBFSFileStatusAvailable;
    else if ([path.pathExtension isEqualToString:@"unavail"]) status = KBFSFileStatusUnavailable;
    else if ([path.pathExtension isEqualToString:@"part"]) status = KBFSFileStatusPartiallyAvailable;
    else if ([path.pathExtension isEqualToString:@"none"]) status = KBFSFileStatusNone;

    completion(status);
  });
}

- (NSImage *)imageForFileStatus:(KBFSFileStatus)fileStatus {
  NSString *name;
  switch (fileStatus) {
    case KBFSFileStatusUnknown: name = nil; break;
    case KBFSFileStatusNone: name = NSImageNameStatusNone; break;
    case KBFSFileStatusUnavailable: name = NSImageNameStatusUnavailable; break;
    case KBFSFileStatusPartiallyAvailable: name = NSImageNameStatusPartiallyAvailable; break;
    case KBFSFileStatusAvailable: name = NSImageNameStatusAvailable; break;
  }
  return name ? [NSImage imageNamed:name] : nil;
}

- (NSString *)labelForFileStatus:(KBFSFileStatus)fileStatus {
  switch (fileStatus) {
    case KBFSFileStatusUnknown: return nil;
    case KBFSFileStatusNone: return @"None";
    case KBFSFileStatusUnavailable: return @"Unavailable";
    case KBFSFileStatusPartiallyAvailable: return @"Partially Available";
    case KBFSFileStatusAvailable: return @"Available";
  }
}

- (NSString *)badgeIdForFileStatus:(KBFSFileStatus)fileStatus {
  switch (fileStatus) {
    case KBFSFileStatusUnknown: return @""; // Empty string means no badge
    case KBFSFileStatusNone: return @"None";
    case KBFSFileStatusUnavailable: return @"Unavailable";
    case KBFSFileStatusPartiallyAvailable: return @"PartiallyAvailable";
    case KBFSFileStatusAvailable: return @"Available";
  }
}

@end
