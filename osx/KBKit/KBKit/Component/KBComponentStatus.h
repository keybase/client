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
#import "KBSemVersion.h"

typedef NS_ENUM (NSInteger, KBRuntimeStatus) {
  KBRuntimeStatusNone,
  KBRuntimeStatusRunning,
  KBRuntimeStatusNotRunning,
};

NSString *NSStringFromKBRInstallStatus(KBRInstallStatus status);
NSString *NSStringFromKBRInstallAction(KBRInstallAction action);
NSString *NSStringFromKBRuntimeStatus(KBRuntimeStatus status);

@interface KBComponentStatus : NSObject

@property (readonly) NSError *error;
@property (readonly) KBRInstallStatus installStatus;
@property (readonly) KBRInstallAction installAction;
@property (readonly) KBRuntimeStatus runtimeStatus;
@property (readonly) GHODictionary *info;

+ (instancetype)componentStatusWithInstallStatus:(KBRInstallStatus)installStatus installAction:(KBRInstallAction)installAction runtimeStatus:(KBRuntimeStatus)runtimeStatus info:(GHODictionary *)info error:(NSError *)error;

+ (instancetype)componentStatusWithVersion:(KBSemVersion *)version bundleVersion:(KBSemVersion *)bundleVersion runtimeStatus:(KBRuntimeStatus)runtimeStatus info:(GHODictionary *)info;

+ (instancetype)componentStatusWithServiceStatus:(KBRServiceStatus *)serviceStatus;

- (BOOL)needsInstallOrUpgrade;

- (NSString *)statusDescription;

- (GHODictionary *)statusInfo;

@end
