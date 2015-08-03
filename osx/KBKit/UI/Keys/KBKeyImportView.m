//
//  KBKeyImportView.m
//  Keybase
//
//  Created by Gabriel on 3/16/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBKeyImportView.h"
#import "KBPGPTextView.h"

@interface KBKeyImportView ()
@property KBPGPTextView *textView;
@property KBButton *importButton;
@property KBButton *cancelButton;
@property KBButton *chooseFileButton;
@end

@implementation KBKeyImportView

- (void)viewInit {
  [super viewInit];

  GHWeakSelf gself = self;

  _textView = [[KBPGPTextView alloc] init];
  [self addSubview:_textView];

  KBBox *line = [KBBox horizontalLine];
  [self addSubview:line];

  YOHBox *footerView = [YOHBox box:@{@"spacing": @(20), @"minSize": @"130,0", @"horizontalAlignment": @"right", @"insets": @(20)}];
  [self addSubview:footerView];

  _chooseFileButton = [KBButton buttonWithText:@"Import File" style:KBButtonStyleDefault];
  _chooseFileButton.targetBlock = ^{ [gself chooseFile]; };
  [footerView addSubview:_chooseFileButton];

  _cancelButton = [KBButton buttonWithText:@"Cancel" style:KBButtonStyleDefault];
  _cancelButton.targetBlock = ^{ gself.completion(gself, NO); };
  [footerView addSubview:_cancelButton];

  _importButton = [KBButton buttonWithText:@"Import" style:KBButtonStylePrimary];
  _importButton.targetBlock = ^{ [gself import]; };
  [footerView addSubview:_importButton];

  self.viewLayout = [YOVBorderLayout layoutWithCenter:_textView top:nil bottom:@[line, footerView] insets:UIEdgeInsetsZero spacing:0];
}

- (void)chooseFile {
  NSOpenPanel *openPanel = [NSOpenPanel openPanel];
  openPanel.canChooseDirectories = NO;
  openPanel.canChooseFiles = YES;
  openPanel.allowsMultipleSelection = NO;
  if ([openPanel runModal] == NSModalResponseOK) {
    NSURL *URL = [[openPanel URLs] firstObject];
    [self addURL:URL];
  }
}

- (void)addURL:(NSURL *)URL {
  if (!URL) return;
  if (![URL isFileURL]) return;
  NSString *path = URL.path;

  NSDictionary *pathAttributes = [NSFileManager.defaultManager attributesOfItemAtPath:path error:nil];
  if (!pathAttributes) return;
  if ([pathAttributes[NSFileSize] unsignedLongLongValue] > 20 * 1024 * 1024) return; // Ignore files larger than 20MB

  NSData *data = [NSFileManager.defaultManager contentsAtPath:path];
  if (data.length < 10) return;

  NSString *prefix = @"-----BEGIN";
  NSString *asciiPrefix = [[NSString alloc] initWithData:[data subdataWithRange:NSMakeRange(0, MIN(10, data.length))] encoding:NSASCIIStringEncoding];
  if ([asciiPrefix isEqualTo:prefix]) {
    /*
    NSMutableArray *scanned = [NSMutableArray array];
    NSString *str = [[NSString alloc] initWithData:data encoding:NSASCIIStringEncoding];
    [self scanWithBeginString:@"-----BEGIN PGP PRIVATE KEY BLOCK-----" endString:@"-----END PGP PRIVATE KEY BLOCK-----" text:str scanned:scanned skipped:nil];
    NSString *armored = [scanned firstObject];
    //[armored replaceOccurrencesOfString:@"\n" withString:@"\r\n" options:0 range:NSMakeRange(0, _armored.length)];
    [_textView setData:[armored dataUsingEncoding:NSASCIIStringEncoding] armored:YES];
     */

    [_textView setData:data armored:YES];
  } else {
    [_textView setData:data armored:NO];
  }
}

- (void)scanWithBeginString:(NSString *)beginString endString:(NSString *)endString text:(NSString *)text scanned:(NSMutableArray *)scanned skipped:(NSMutableArray *)skipped {
  if (!text) return;
  NSScanner *scanner = [[NSScanner alloc] initWithString:text];
  while (!scanner.atEnd) {
    NSString *sBefore = nil;
    [scanner scanUpToString:beginString intoString:&sBefore];
    if (sBefore && skipped) [skipped addObject:sBefore];
    if (scanner.atEnd) break;
    NSString *sIn = nil;
    [scanner scanUpToString:endString intoString:&sIn];
    if (sIn) {
      [scanner scanString:endString intoString:nil];
      if (scanned) [scanned addObject:[sIn stringByAppendingString:endString]];
    }
  }
}

- (void)import {
  [KBActivity setProgressEnabled:YES sender:self];
  KBRPgpRequest *request = [[KBRPgpRequest alloc] initWithClient:self.client];
  [request pgpImportWithKey:_textView.data pushSecret:NO completion:^(NSError *error) {
    [KBActivity setProgressEnabled:NO sender:self];
    if ([KBActivity setError:error sender:self]) return;

    self.completion(self, YES);
  }];
}

@end