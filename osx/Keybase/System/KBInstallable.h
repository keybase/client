//
//  KBInstallable.h
//  Keybase
//
//  Created by Gabriel on 5/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

typedef NS_ENUM (NSInteger, KBInstallStatus) {
  KBInstallStatusError = 1,
  KBInstallStatusNotInstalled,
  KBInstallStatusInstalledNotRunning,
  KBInstallStatusNeedsUpgrade,
  KBInstallStatusInstalled,
};

typedef void (^KBInstalledStatus)(NSError *error, KBInstallStatus installStatus, NSString *info);

typedef void (^KBInstalled)(NSError *error, KBInstallStatus installStatus, NSString *info);

NSString *NSStringFromKBInstallStatus(KBInstallStatus status);

@protocol KBInstallable <NSObject>

- (NSString *)info;

- (void)installStatus:(KBInstalledStatus)completion;

- (void)install:(KBInstalled)completion;

@end
