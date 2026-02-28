//
//  Prompt.m
//  Updater
//
//  Created by Gabriel on 4/13/16.
//  Copyright © 2016 Keybase. All rights reserved.
//

#import "Prompt.h"
#import "TextView.h"
#import "Defines.h"
#import "NSDictionary+Extension.h"

@interface FView : NSView
@end

@implementation Prompt

+ (NSDictionary *)parseInputString:(NSString *)inputString defaultValue:(NSDictionary *)defaultValue {
  NSData *data = [inputString dataUsingEncoding:NSUTF8StringEncoding];
  if (!data) {
    NSLog(@"No data for input");
    return defaultValue;
  }
  NSError *error = nil;
  id input = [NSJSONSerialization JSONObjectWithData:data options:0 error:&error];
  if (!!error) {
    NSLog(@"Error parsing input: %@", error);
    return defaultValue;
  }
  if (!input) {
    NSLog(@"No input");
    return defaultValue;
  }
  if (![input isKindOfClass:[NSDictionary class]]) {
    NSLog(@"Invalid input type");
    return defaultValue;
  }
  return input;
}

+ (void)showPromptWithInputString:(NSString *)inputString presenter:(NSModalResponse (^)(NSAlert *alert))presenter completion:(void (^)(NSData *output))completion {

  // Try to parse input, if there is any error use a default empty dictionary.
  NSDictionary *input = [self parseInputString:inputString defaultValue:@{}];

  // If input defines buttons it's a generic prompt
  if ([input[@"type"] isEqual:@"generic"]) {
    [self showGenericPrompt:input presenter:presenter completion:completion];
    return;
  }

  [self showUpdatePrompt:input presenter:presenter completion:completion];
}

+ (void)showUpdatePrompt:(NSDictionary *)input presenter:(NSModalResponse (^)(NSAlert *alert))presenter completion:(void (^)(NSData *output))completion {
  NSString *title = [input kb_stringForKey:@"title"];
  NSString *message = [input kb_stringForKey:@"message"];
  NSString *description = [input kb_stringForKey:@"description"];
  BOOL autoUpdate = [input kb_boolForKey:@"autoUpdate"];

  if (!title) title = @"Keybase Update";
  if (!message) message = @"There is an update available.";
  if (!description) description = @"Please visit keybase.io for more information.";

  if ([title length] > 700) title = [title substringToIndex:699];
  if ([message length] > 700) message = [message substringToIndex:699];

  NSAlert *alert = [[NSAlert alloc] init];
  alert.messageText = title;
  alert.informativeText = message;
  [alert addButtonWithTitle:@"Update"];
  [alert addButtonWithTitle:@"Ignore"];

  FView *accessoryView = [[FView alloc] init];
  TextView *textView = [[TextView alloc] init];
  textView.editable = NO;
  textView.view.textContainerInset = CGSizeMake(5, 5);

  NSFont *font = [NSFont fontWithName:@"Monaco" size:10];
  [textView setText:description font:font color:[NSColor blackColor] alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  textView.borderType = NSBezelBorder;
  textView.frame = CGRectMake(0, 0, 500, 160);
  [accessoryView addSubview:textView];

  NSButton *autoCheckbox = [[NSButton alloc] init];
  autoCheckbox.title = @"Update automatically";
  autoCheckbox.state = autoUpdate ? NSOnState : NSOffState;
  [autoCheckbox setButtonType:NSSwitchButton];
  autoCheckbox.frame = CGRectMake(0, 160, 500, 30);
  [accessoryView addSubview:autoCheckbox];
  accessoryView.frame = CGRectMake(0, 0, 500, 190);
  alert.accessoryView = accessoryView;

  [alert setAlertStyle:NSInformationalAlertStyle];


  NSModalResponse response = presenter(alert);

  BOOL autoUpdateResponse = NO;

  NSString *action = @"";
  if (response == NSAlertFirstButtonReturn) {
    action = @"apply";
    autoUpdateResponse = autoCheckbox.state == NSOnState ? YES : NO;
  } else if (response == NSAlertSecondButtonReturn) {
    action = @"snooze";
  }
  NSLog(@"Action: %@", action);

  NSError *error = nil;
  NSDictionary *result = @{
                           @"action": action,
                           @"autoUpdate": @(autoUpdateResponse),
                           };

  NSData *data = [NSJSONSerialization dataWithJSONObject:result options:0 error:&error];
  if (!!error) {
    NSLog(@"Error generating JSON response: %@", error);
  }
  completion(data);
}

+ (void)showGenericPrompt:(NSDictionary *)input presenter:(NSModalResponse (^)(NSAlert *alert))presenter completion:(void (^)(NSData *output))completion {
  NSString *title = [input kb_stringForKey:@"title"];
  NSString *message = [input kb_stringForKey:@"message"];
  NSArray *buttons = [input kb_stringArrayForKey:@"buttons"];

  if ([title length] > 700) title = [title substringToIndex:699];
  if ([message length] > 700) message = [message substringToIndex:699];

  NSAlert *alert = [[NSAlert alloc] init];
  alert.messageText = title;
  alert.informativeText = message;
  for (NSString *button in buttons) {
    [alert addButtonWithTitle:button];
  }
  [alert setAlertStyle:NSInformationalAlertStyle];

  NSModalResponse response = presenter(alert);

  NSString *buttonSelected = buttons[response-NSAlertFirstButtonReturn];

  NSError *error = nil;
  NSDictionary *result = @{@"button": buttonSelected};
  NSData *data = [NSJSONSerialization dataWithJSONObject:result options:0 error:&error];
  if (!!error) {
    NSLog(@"Error generating JSON response: %@", error);
  }
  completion(data);
}

@end

@implementation FView

- (BOOL)isFlipped {
  return YES;
}

@end
