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

typedef void (^KBOnComponentStatus)(KBComponentStatus *installStatus);

@protocol KBInstallable <KBComponent>

- (KBComponentStatus *)componentStatus;

- (void)updateComponentStatus:(KBCompletion)completion;

- (void)install:(KBCompletion)completion;

- (void)uninstall:(KBCompletion)completion;

@end

@interface KBInstallableComponent : KBComponent

@property NSString *bundleVersion;
@property (nonatomic) KBComponentStatus *componentStatus;

- (NSString *)version;

// Called when component updated
- (void)componentDidUpdate;

- (void)updateComponentStatus:(KBCompletion)completion;

- (GHODictionary *)componentStatusInfo;

@end
