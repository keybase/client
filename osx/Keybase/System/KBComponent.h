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

@protocol KBComponent <NSObject>

- (NSString *)name;
- (NSString *)info;
- (NSImage *)image;

- (NSView *)contentView;

- (void)refresh:(KBCompletion)completion;

@end

@interface KBComponent : NSObject

- (void)refresh:(KBCompletion)completion;

- (NSView *)contentView;

@end