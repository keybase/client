//
//  KBComponent.h
//  Keybase
//
//  Created by Gabriel on 5/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <GHODictionary/GHODictionary.h>
#import "KBRPC.h"

typedef NS_ENUM (NSInteger, KBRuntimeStatus) {
  KBRuntimeStatusNone,
  KBRuntimeStatusRunning,
  KBRuntimeStatusNotRunning,
};

NSString *NSStringFromKBRInstallStatus(KBRInstallStatus status);
NSString *NSStringFromKBRuntimeStatus(KBRuntimeStatus status);

@interface KBComponentStatus : NSObject

@property (readonly) NSError *error;
@property (readonly) KBRInstallStatus installStatus;
@property (readonly) KBRuntimeStatus runtimeStatus;
@property (readonly) GHODictionary *info;

+ (instancetype)componentStatusWithError:(NSError *)error;
+ (instancetype)componentStatusWithInstallStatus:(KBRInstallStatus)installStatus runtimeStatus:(KBRuntimeStatus)runtimeStatus info:(GHODictionary *)info;
+ (instancetype)componentStatusWithServiceStatus:(KBRServiceStatus *)serviceStatus;

- (BOOL)needsInstallOrUpgrade;
- (NSString *)actionLabel;

- (NSString *)statusDescription;

@end
