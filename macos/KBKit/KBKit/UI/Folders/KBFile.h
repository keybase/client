//
//  KBFile.h
//  Keybase
//
//  Created by Gabriel on 3/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

typedef NS_ENUM (NSInteger, KBFileType) {
  KBFileTypeDefault,
  KBFileTypeFolder
};

typedef NS_ENUM(NSInteger, KBFileResponse) {
  KBFileResponseCancel = 1,
  KBFileResponseSkip,
  KBFileResponseOverwrite,
  KBFileResponseOverwriteAll,
};

@interface KBFile : NSObject

@property NSString *name;
@property NSString *path; // Path on filesystem
@property KBFileType fileType;
@property NSDate *dateModified;
@property (nonatomic) NSImage *icon;

+ (instancetype)fileWithPath:(NSString *)path;

+ (instancetype)fileWithURL:(NSURL *)URL;

+ (instancetype)fileFromExtensionItem:(NSExtensionItem *)extensionItem;

+ (instancetype)folderWithName:(NSString *)name dateModified:(NSDate *)dateModified;

NSImage *KBImageForFile(KBFile *file);

+ (void)promptOverwrite:(NSString *)path view:(NSView *)view completion:(void (^)(KBFileResponse response))completion;

@end
