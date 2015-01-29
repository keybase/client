//
//  KBWindow.h
//  Keybase
//
//  Created by Gabriel on 1/28/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBUIDefines.h"

@interface KBWindow : NSWindow

+ (instancetype)windowWithContentView:(NSView *)contentView size:(CGSize)size retain:(BOOL)retain;

@property KBNavigationView *navigation;

@end
