//
//  KBComponent.h
//  Keybase
//
//  Created by Gabriel on 5/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppDefines.h"

typedef NS_ENUM (NSInteger, KBInstallStatus) {
  KBInstallStatusError = 1,
  KBInstallStatusNotInstalled,
  KBInstallStatusNeedsUpgrade,
  KBInstallStatusInstalled,
};

typedef NS_ENUM (NSInteger, KBRuntimeStatus) {
  KBRuntimeStatusNone,
  KBRuntimeStatusRunning,
  KBRuntimeStatusNotRunning,
};

NSString *NSStringFromKBInstallStatus(KBInstallStatus status);
NSString *NSStringFromKBRuntimeStatus(KBRuntimeStatus status);

@interface KBComponentStatus : NSObject

@property (readonly) NSError *error;
@property (readonly) KBInstallStatus installStatus;
@property (readonly) KBRuntimeStatus runtimeStatus;
@property (readonly) GHODictionary *info;

+ (instancetype)componentStatusWithError:(NSError *)error;
+ (instancetype)componentStatusWithInstallStatus:(KBInstallStatus)installStatus runtimeStatus:(KBRuntimeStatus)runtimeStatus info:(GHODictionary *)info;

- (BOOL)needsInstallOrUpgrade;
- (NSString *)actionLabel;

- (NSString *)statusDescription;

@end
