//
//  KBInstallable.h
//  Keybase
//
//  Created by Gabriel on 5/18/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBComponent.h"
#import "KBComponentStatus.h"
#import "KBEnvConfig.h"

typedef void (^KBOnComponentStatus)(KBComponentStatus *installStatus);

@protocol KBInstallable <KBComponent>

- (KBComponentStatus *)componentStatus;

- (void)updateComponentStatus:(NSTimeInterval)timeout completion:(KBCompletion)completion;

- (void)install:(KBCompletion)completion;
- (void)uninstall:(KBCompletion)completion;

- (void)start:(KBCompletion)completion;
- (void)stop:(KBCompletion)completion;

@end

@interface KBInstallableComponent : KBComponent

@property (nonatomic) KBComponentStatus *componentStatus;
@property (readonly) KBEnvConfig *config;

- (instancetype)initWithConfig:(KBEnvConfig *)config;

// Called when component updated
- (void)componentDidUpdate;

- (void)updateComponentStatus:(NSTimeInterval)timeout completion:(KBCompletion)completion;

- (GHODictionary *)componentStatusInfo;

@end
