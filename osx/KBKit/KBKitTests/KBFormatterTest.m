//
//  KBFormatterTest.m
//  Keybase
//
//  Created by Gabriel on 5/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Cocoa/Cocoa.h>
#import <XCTest/XCTest.h>

#import <KBKit/KBFormatter.h>
#import <GHODictionary/GHODictionary.h>

@interface KBFormatterTest : XCTestCase
@end

@implementation KBFormatterTest

- (void)testFormatter {
  NSDictionary *dict = @{@"a1": @{@"b1": @[@{@"c1": @[@"v1", @"v2"], @"c2": @(100)}]}, @"a2": @"v"};
  NSString *desc = KBDescription(dict);
  NSLog(@"%@", desc);
}

// TODO GHODictionary is not being recognized?
- (void)testOrderedDict {
  NSDictionary *dict = @{@"a1": @"v1", @"a2": @"v2"};
  GHODictionary *odict = [GHODictionary dictionaryWithDictionary:dict];
  [odict sortKeysUsingSelector:@selector(localizedCompare:) deepSort:YES];
  NSString *desc2 = KBDescription(odict);
  NSLog(@"%@", desc2);
  //XCTAssertEqualObjects(desc, expected);
}

@end
