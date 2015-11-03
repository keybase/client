//
//  KBComponent.h
//  Keybase
//
//  Created by Gabriel on 5/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

#import "KBDefines.h"
#import "KBComponentStatus.h"

@protocol KBComponent <NSObject>

- (NSString *)name;
- (NSString *)info;
- (NSImage *)image;

- (NSView *)componentView;

- (void)refreshComponent:(KBCompletion)completion;

@end

@interface KBComponent : NSObject

- (void)refreshComponent:(KBCompletion)completion;

- (NSView *)componentView;

@end