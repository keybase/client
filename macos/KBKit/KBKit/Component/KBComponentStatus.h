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

NSString *NSStringFromKBRInstallStatus(KBRInstallStatus status);
NSString *NSStringFromKBRInstallAction(KBRInstallAction action);

@interface KBComponentStatus : NSObject

@property (readonly) NSError *error;
@property (readonly) KBRInstallStatus installStatus;
@property (readonly) KBRInstallAction installAction;
@property (readonly) GHODictionary *info;

@property (readonly) NSString *label;

+ (instancetype)componentStatusWithInstallStatus:(KBRInstallStatus)installStatus installAction:(KBRInstallAction)installAction info:(GHODictionary *)info error:(NSError *)error;

+ (instancetype)componentStatusWithVersion:(KBSemVersion *)version bundleVersion:(KBSemVersion *)bundleVersion info:(GHODictionary *)info;

+ (instancetype)componentStatusWithServiceStatus:(KBRServiceStatus *)serviceStatus;

+ (instancetype)componentStatusWithError:(NSError *)error;

- (BOOL)needsInstallOrUpgrade;

- (NSString *)statusDescription:(NSString *)delimeter;

- (GHODictionary *)statusInfo;

@end
