//
//  KBAlertView.h
//  Keybase
//
//  Created by Gabriel on 6/3/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Tikppa/Tikppa.h>

typedef void (^KBAlertViewCompletion)(NSInteger tag);

@interface KBAlertView : YOView

@property (copy) KBAlertViewCompletion completion;

- (void)setHeader:(NSString *)header info:(NSString *)info;

- (void)close;

// Match KBAlert
- (void)setMessageText:(NSString *)messageText;
- (void)setInformativeText:(NSString *)informativeText;
- (void)addButtonWithTitle:(NSString *)title tag:(NSInteger)tag;
- (void)showInView:(NSView *)view completion:(KBAlertViewCompletion)completion;

@end