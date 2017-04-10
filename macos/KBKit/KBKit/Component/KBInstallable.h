//
//  KBInstallable.h
//  Keybase
//
//  Created by Gabriel on 5/18/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <KBKit/KBEnvConfig.h>
#import <KBKit/KBComponent.h>
#import <KBKit/KBComponentStatus.h>

typedef NS_ENUM (NSInteger, KBInstallRuntimeStatus) {
  KBInstallRuntimeStatusNone,
  KBInstallRuntimeStatusStarted,
  KBInstallRuntimeStatusStopped,
};

// Default timeout for running (external) install (or status) commands
extern const NSTimeInterval KBDefaultTaskTimeout;

typedef void (^KBOnComponentStatus)(KBComponentStatus *installStatus);

@interface KBInstallable : KBComponent

@property (readonly) KBEnvConfig *config;

@property (nonatomic) KBComponentStatus *componentStatus;
@property NSError *error;

@property (getter=isInstallDisabled) BOOL installDisabled;

- (instancetype)initWithConfig:(KBEnvConfig *)config name:(NSString *)name info:(NSString *)info image:(NSImage *)image;

// Called when component updated
- (void)componentDidUpdate;

- (BOOL)isInstallDisabled;

- (void)install:(KBCompletion)completion;
- (void)uninstall:(KBCompletion)completion;
- (void)refreshComponent:(KBRefreshComponentCompletion)completion;

- (void)start:(KBCompletion)completion;
- (void)stop:(KBCompletion)completion;

- (KBInstallRuntimeStatus)runtimeStatus;

- (NSArray *)installDescription:(NSString *)delimeter;
- (NSArray *)statusDescription:(NSString *)delimeter;
- (NSString *)action;

+ (NSError *)checkForStatusErrorFromResponse:(id)response;

- (BOOL)isInstalled;

+ (NSError *)combineErrors:(NSArray *)installables ignoreWarnings:(BOOL)ignoreWarnings;

@end
