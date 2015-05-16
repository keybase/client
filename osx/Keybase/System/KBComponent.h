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

@property KBComponentStatus *status;

- (void)status:(KBOnComponentStatus)completion;

- (void)install:(KBCompletion)completion;

@end
