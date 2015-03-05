//
//  KBAlert.h
//  Keybase
//
//  Created by Gabriel on 1/29/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

@import AppKit;

typedef void (^KBAlertResponse)(NSModalResponse returnCode);

@interface KBAlert : NSAlert

- (void)showInView:(NSView *)view completion:(KBAlertResponse)completion;

- (void)addButtonWithTitle:(NSString *)title tag:(NSInteger)tag;

+ (void)promptWithTitle:(NSString *)title description:(NSString *)description style:(NSAlertStyle)style buttonTitles:(NSArray *)buttonTitles view:(NSView *)view completion:(void (^)(NSModalResponse response))completion;

+ (void)promptForInputWithTitle:(NSString *)title description:(NSString *)description secure:(BOOL)secure style:(NSAlertStyle)style buttonTitles:(NSArray *)buttonTitles view:(NSView *)view completion:(void (^)(NSModalResponse response, NSString *input))completion;

+ (void)yesNoWithTitle:(NSString *)title description:(NSString *)description yes:(NSString *)yes view:(NSView *)view completion:(void (^)(NSModalResponse response))completion;

@end
