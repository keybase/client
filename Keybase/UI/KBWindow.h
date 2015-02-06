//
//  KBWindow.h
//  Keybase
//
//  Created by Gabriel on 1/28/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBUIDefines.h"

@interface KBWindow : NSObject

+ (NSWindow *)windowWithContentView:(NSView *)contentView size:(CGSize)size retain:(BOOL)retain;

@end
