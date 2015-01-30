//
//  KBAlert.m
//  Keybase
//
//  Created by Gabriel on 1/29/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBAlert.h"

@implementation KBAlert

- (void)showInView:(NSView *)view completion:(KBAlertResponse)completion {
  NSWindow *window = view.window;
  if (!window) window = [NSApp mainWindow];

  if (window) {
    [self beginSheetModalForWindow:window completionHandler:completion];
  } else {
    NSModalResponse returnCode = [self runModal];
    completion(returnCode);
  }
}

+ (void)promptWithTitle:(NSString *)title description:(NSString *)description style:(NSAlertStyle)style buttonTitles:(NSArray *)buttonTitles view:(NSView *)view completion:(void (^)(NSModalResponse response))completion {
  KBAlert *alert = [[KBAlert alloc] init];
  for (NSString *buttonTitle in buttonTitles) {
    [alert addButtonWithTitle:buttonTitle];
  }
  [alert setMessageText:title];
  [alert setInformativeText:description];
  [alert setAlertStyle:style];
  [alert showInView:view completion:completion];
}

+ (void)promptForInputWithTitle:(NSString *)title description:(NSString *)description secure:(BOOL)secure style:(NSAlertStyle)style buttonTitles:(NSArray *)buttonTitles view:(NSView *)view completion:(void (^)(NSModalResponse response, NSString *input))completion {
  KBAlert *alert = [[KBAlert alloc] init];
  for (NSString *buttonTitle in buttonTitles) {
    [alert addButtonWithTitle:buttonTitle];
  }

  [alert setMessageText:title];
  [alert setInformativeText:description];
  [alert setAlertStyle:style];

  NSTextField *input = secure ? [[NSSecureTextField alloc] initWithFrame:NSMakeRect(0, 0, 200, 24)] : [[NSTextField alloc] initWithFrame:NSMakeRect(0, 0, 200, 24)];
  [alert setAccessoryView:input];

  [alert showInView:view completion:^(NSModalResponse returnCode) {
    completion(returnCode, input.stringValue);
  }];
}

@end
