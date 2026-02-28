//
//  PromptTests.m
//  UpdaterTests
//
//  Created by Gabriel on 4/13/16.
//  Copyright © 2016 Gabriel Handford. All rights reserved.
//

#import <XCTest/XCTest.h>

#import "Prompt.h"

@interface PromptTests : XCTestCase
@end

@implementation PromptTests

- (void)assertOutput:(NSData *)output action:(NSString *)action autoUpdate:(BOOL)autoUpdate {
  NSString *stringOutput = [[NSString alloc] initWithData:output encoding:NSUTF8StringEncoding];
  NSLog(@"Checking output: %@", stringOutput);
  NSString *expected = [NSString stringWithFormat:@"{\"action\":\"%@\",\"autoUpdate\":%@}", action, (autoUpdate ? @"true" : @"false")];
  XCTAssertEqualObjects(expected, stringOutput);
}

- (void)testUpdatePrompt {
  NSData *data = [NSJSONSerialization dataWithJSONObject:@{@"title": @"Title", @"message": @"", @"description": @"", @"autoUpdate": @NO} options:0 error:nil];
  NSString *str = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
  [Prompt showPromptWithInputString:str presenter:^NSModalResponse(NSAlert *alert) {
    return NSAlertFirstButtonReturn;
  } completion:^(NSError *error, NSData *output) {
    NSLog(@"Error: %@", error);
    XCTAssertNil(error);
    [self assertOutput:output action:@"apply" autoUpdate:NO];
  }];
}

- (void)testUpdatePromptAutoUpdate {
  NSData *data = [NSJSONSerialization dataWithJSONObject:@{@"title": @"Title", @"message": @"", @"description": @"", @"autoUpdate": @YES} options:0 error:nil];
  NSString *str = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
  [Prompt showPromptWithInputString:str presenter:^NSModalResponse(NSAlert *alert) {
    return NSAlertSecondButtonReturn;
  } completion:^(NSError *error, NSData *output) {
    NSLog(@"Error: %@", error);
    XCTAssertNil(error);
    [self assertOutput:output action:@"snooze" autoUpdate:YES];
  }];
}

- (void)testUpdatePromptNoSettings {
  [Prompt showPromptWithInputString:@"" presenter:^NSModalResponse(NSAlert *alert) {
    return NSAlertSecondButtonReturn;
  } completion:^(NSError *error, NSData *output) {
    NSLog(@"Error: %@", error);
    XCTAssertNil(error);
    [self assertOutput:output action:@"snooze" autoUpdate:NO];
  }];
}

- (void)testUpdatePromptInvalidJSONInput {
  NSData *data = [NSJSONSerialization dataWithJSONObject:@{@"title": @{}, @"message": @{}, @"description": @{}, @"autoUpdate": @{}} options:0 error:nil];
  NSString *str = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
  [Prompt showPromptWithInputString:str presenter:^NSModalResponse(NSAlert *alert) {
    return NSAlertSecondButtonReturn;
  } completion:^(NSError *error, NSData *output) {
    [self assertOutput:output action:@"snooze" autoUpdate:NO];
  }];
}

- (void)testUpdatePromptInvalidJSONRoot {
  NSData *data = [NSJSONSerialization dataWithJSONObject:@[] options:0 error:nil];
  NSString *str = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
  [Prompt showPromptWithInputString:str presenter:^NSModalResponse(NSAlert *alert) {
    return NSAlertSecondButtonReturn;
  } completion:^(NSError *error, NSData *output) {
    NSLog(@"Error: %@", error);
    XCTAssertNil(error);
    [self assertOutput:output action:@"snooze" autoUpdate:NO];
  }];
}

- (void)testUpdatePromptBadJSON {
  [Prompt showPromptWithInputString:@"badjson" presenter:^NSModalResponse(NSAlert *alert) {
    return NSAlertFirstButtonReturn;
  } completion:^(NSError *error, NSData *output) {
    NSLog(@"Error: %@", error);
    NSLog(@"Output: %@", output);
    XCTAssertNil(error);
  }];
}

@end
