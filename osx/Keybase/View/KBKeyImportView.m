//
//  KBKeyImportView.m
//  Keybase
//
//  Created by Gabriel on 3/16/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBKeyImportView.h"
#import "AppDelegate.h"

@interface KBKeyImportView ()
@property KBLabel *textView;
@property KBScrollView *scrollView;

@property KBButton *importButton;

@property KBButton *chooseFileButton;

@property NSData *data;
@property NSString *armored;
@end

@implementation KBKeyImportView

- (void)viewInit {
  [super viewInit];
  self.backgroundColor = NSColor.whiteColor;

  KBBorder *pasteView = [[KBBorder alloc] init];
  pasteView.width = 2.0;
  pasteView.color = [NSColor colorWithCalibratedWhite:0.5 alpha:1.0];
  pasteView.shapeLayer.backgroundColor = [NSColor colorWithCalibratedWhite:0.94 alpha:1.0].CGColor;
  [pasteView.shapeLayer setLineDashPattern:@[@(8), @(8)]];
  pasteView.cornerRadius = 10;
  [self addSubview:pasteView];

  YOView *displayTextView = [[YOView alloc] init];
  _textView = [[KBLabel alloc] initWithFrame:CGRectMake(20, 20, 2000, 2000)];
  [displayTextView addSubview:_textView];
  [self addSubview:displayTextView];

  YOSelf yself = self;

  _chooseFileButton = [KBButton button];
  [_chooseFileButton setMarkup:@"Drag or paste your key here,\nor <a>select a file</a>." style:KBButtonStyleText font:[NSFont systemFontOfSize:20] alignment:NSCenterTextAlignment];
  _chooseFileButton.targetBlock = ^{ [yself chooseFile]; };
  [self addSubview:_chooseFileButton];

  YOView *footerView = [[YOView alloc] init];
  _cancelButton = [KBButton buttonWithText:@"Cancel" style:KBButtonStyleDefault];
  [footerView addSubview:_cancelButton];

  _importButton = [KBButton buttonWithText:@"Import" style:KBButtonStylePrimary];
  _importButton.targetBlock = ^{ [yself import]; };
  [footerView addSubview:_importButton];

  footerView.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGSize footerSize = [yself.importButton sizeThatFits:size];
    [layout setFrame:CGRectMake(size.width - 280, 0, 130, footerSize.height) view:yself.importButton];
    [layout setFrame:CGRectMake(size.width - 130, 0, 130, footerSize.height) view:yself.cancelButton];
    return CGSizeMake(size.width, footerSize.height);
  }];
  [self addSubview:footerView];

  //YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {

    CGSize footerSize = [footerView sizeThatFits:size];

    CGFloat y = 40;
    CGRect pasteRect = CGRectMake(40, y, size.width - 80, size.height - y - 40 - footerSize.height);

    [layout setFrame:pasteRect view:pasteView];
    [layout setFrame:pasteRect view:displayTextView];

    if (yself.armored) {
      [layout setFrame:CGRectMake(20, 20, 2000, 2000) view:yself.textView];
    } else {
      [layout setFrame:CGRectMake(20, 20, pasteRect.size.width - 40, 2000) view:yself.textView];
    }

    [layout centerWithSize:CGSizeZero frame:pasteRect view:yself.chooseFileButton];
    [layout setFrame:CGRectMake(0, size.height - footerSize.height - 20, size.width - 40, footerSize.height) view:footerView];
    return size;
  }];
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

- (void)setDisplayText:(NSString *)displayText {
  [_textView setText:displayText font:[NSFont systemFontOfSize:10] color:[NSColor colorWithCalibratedWhite:0.5 alpha:1.0] alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByCharWrapping];
  [self setNeedsLayout];
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
  _data = data;

  NSString *prefix = @"-----BEGIN";
  NSString *asciiPrefix = [[NSString alloc] initWithData:[_data subdataWithRange:NSMakeRange(0, MIN(10, _data.length))] encoding:NSASCIIStringEncoding];
  if ([asciiPrefix isEqualTo:prefix]) {
    NSMutableArray *scanned = [NSMutableArray array];
    NSString *str = [[NSString alloc] initWithData:_data encoding:NSASCIIStringEncoding];
    [self scanWithBeginString:@"-----BEGIN PGP PRIVATE KEY BLOCK-----" endString:@"-----END PGP PRIVATE KEY BLOCK-----" text:str scanned:scanned skipped:nil];
    _armored = [scanned firstObject];
    //[_armored replaceOccurrencesOfString:@"\n" withString:@"\r\n" options:0 range:NSMakeRange(0, _armored.length)];
    [self setDisplayText:_armored];
    _chooseFileButton.hidden = YES;
  } else {
    _armored = nil;
    NSData *displayData = [_data subdataWithRange:NSMakeRange(0, MIN(1000, _data.length))];
    [self setDisplayText:KBHexString(displayData)];
    _chooseFileButton.hidden = YES;
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
  KBCompletionBlock completion = ^(NSError *error) {
    [self.navigation.titleView setProgressEnabled:NO];
    if (error) {
      [AppDelegate setError:error sender:self];
      return;
    }
  };

  if (_armored) {
    KBRMykeyRequest *request = [[KBRMykeyRequest alloc] initWithClient:self.client];
    [request saveArmoredPGPKeyWithKey:_armored pushPublic:YES pushPrivate:NO completion:completion];
  } else if (_data) {
    KBRMykeyRequest *request = [[KBRMykeyRequest alloc] initWithClient:self.client];
    [request savePGPKeyWithKey:_data pushPublic:YES pushPrivate:NO completion:completion];
  }
}

@end