//
//  KBComponent.h
//  Keybase
//
//  Created by Gabriel on 5/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBComponentStatus.h"
#import "KBAppDefines.h"

typedef void (^KBOnComponentStatus)(KBComponentStatus *installStatus);

@protocol KBComponent <NSObject>

- (NSString *)name;
- (NSString *)info;
- (NSImage *)image;

- (NSView *)contentView;

- (KBComponentStatus *)componentStatus;

- (void)refresh:(KBCompletion)completion;

- (void)updateComponentStatus:(KBCompletion)completion;

- (void)install:(KBCompletion)completion;

@end

@interface KBComponent : NSObject

@property NSString *bundleVersion;
@property (nonatomic) KBComponentStatus *componentStatus;

- (NSString *)version;

// Called when component updated
- (void)componentDidUpdate;

- (void)updateComponentStatus:(KBCompletion)completion;

- (GHODictionary *)componentStatusInfo;

- (void)refresh:(KBCompletion)completion;

- (NSView *)contentView;

@end