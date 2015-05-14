//
//  KBInstallStatus.h
//  Keybase
//
//  Created by Gabriel on 5/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBDefines.h"

typedef NS_ENUM (NSInteger, KBInstalledStatus) {
  KBInstalledStatusError = 1,
  KBInstalledStatusNotInstalled,
  KBInstalledStatusNeedsUpgrade,
  KBInstalledStatusInstalled,
};

typedef NS_ENUM (NSInteger, KBRuntimeStatus) {
  KBRuntimeStatusNone,
  KBRuntimeStatusRunning,
  KBRuntimeStatusNotRunning,
};

NSString *NSStringFromKBInstalledStatus(KBInstalledStatus status);

@interface KBInstallStatus : NSObject

@property (readonly) NSError *error;
@property (readonly) KBInstalledStatus status;
@property (readonly) KBRuntimeStatus runtimeStatus;

+ (instancetype)installStatusWithError:(NSError *)error;
+ (instancetype)installStatusWithStatus:(KBInstalledStatus)status runtimeStatus:(KBRuntimeStatus)runtimeStatus info:(GHODictionary *)info;

- (NSString *)statusDescription;

@end
