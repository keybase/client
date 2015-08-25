# Keybase Style Guide

## Dot Notation Syntax

Dot notation should **always** be used for accessing and mutating properties. Bracket notation is preferred in all other instances.

**For example:**
```objc
view.backgroundColor = [UIColor orangeColor];
[UIApplication sharedApplication].delegate;
```

**Not:**
```objc
[view setBackgroundColor:[UIColor orangeColor]];
UIApplication.sharedApplication.delegate;
```

## Spacing

* Indent using 2 spaces. Never indent with tabs. Be sure to set this preference in Xcode.
* Method braces and other braces (`if`/`else`/`switch`/`while` etc.) always open on the same line as the statement.

**For example:**
```objc
if (user.isHappy) {
    // Do something
} else {
    // Do something else
}
```
* There should be exactly one blank line between methods to aid in visual clarity and organization.
* Whitespace within methods should be used to separate functionality (though often this can indicate an opportunity to split the method into several, smaller methods). In methods with long or verbose names, a single line of whitespace may be used to provide visual separation before the method’s body.
* `@synthesize` and `@dynamic` should each be declared on new lines in the implementation.

## Types

`NSInteger` and `NSUInteger` should be used instead of `int`, `long`. `CGFloat` is preferred over `float` for the same reasons.

All Apple types should be used over primitive ones. For example, if you are working with time intervals, use `NSTimeInterval` instead of `double`.

## String Formatting

If you wrap primitives in `@(..)`, then you can use `%@` for the string format specifier.

**For example:**

```objc
NSInteger num = 1;
[NSString stringWithFormat:@"Number was %@", @(num)];
```

## Properties

Don't specify `assign` or `retain` if it's the default. Don't specify `nonatomic` unless you are defining the method in the implementation.

If the name of a `BOOL` property is expressed as an adjective, the property’s name can omit the `is` prefix but should specify the conventional name for the getter.

**For example:**

```objc
@property UIColor *topColor;
@property CGSize shadowOffset;
@property (readonly, getter=isLoading) BOOL loading;
```

**Not:**

```objc
@property (nonatomic, retain) UIColor *topColor;
@property (nonatomic, assign) CGSize shadowOffset;
@property (nonatomic, assign) BOOL loading;
```

Let properties be `readonly` (immutable) unless necessary. Make them readwrite in the implementation.

**For example:**

`KBSemVersion.h`

```objc
@interface KBSemVersion : NSObject
@property (readonly) NSString *version;
@property (readonly) NSString *build;
@end
```

Private properties should be declared in class extensions (anonymous categories) in the implementation file of a class.

`KBSemVersion.m`

```objc
@interface KBSemVersion ()
@property NSString *version;
@property NSString *build;
@end
```



## Error Handling

When methods return an error parameter by reference, switch on the returned value, not the error variable.

**For example:**
```objc
NSError *error;
if (![self trySomethingWithError:&error]) {
    // Handle Error
}
```

**Not:**
```objc
NSError *error;
[self trySomethingWithError:&error];
if (error) {
    // Handle Error
}
```

Some of Apple’s APIs write garbage values to the error parameter (if non-NULL) in successful cases, so switching on the error can cause false negatives (and subsequently crash).

## Methods

In method signatures, there should be a space after the scope (`-` or `+` symbol). There should be a space between the method segments.

**For example:**
```objc
- (void)setExampleText:(NSString *)exampleText image:(UIImage *)image;
```

Method signatures the argument and parameter should match. First argument should match after the method name (and any `With` or `For`).

**For example:**

```objc
- (void)initWithText:(NSString *)text image:(UIImage *)image;
- (void)drawWithText:(NSString *)text image:(UIImage *)image offset:(CGFloat)offset;
```

**Not:**

```objc
- (void)initWithExampleText:(NSString *)text defaultImage:(UIImage *)image;
- (void)draw:(NSString *)text defaultImage:(UIImage *)image forOffset:(CGFloat)offset;
```


## Variables

Variables should be named descriptively, with the variable’s name clearly communicating what the variable _is_ and pertinent information a programmer needs to use that value properly.

Acronyms should be all caps.

**For example:**

* `NSString *title`: It is reasonable to assume a “title” is a string.
* `NSString *titleHTML`: This indicates a title that may contain HTML which needs parsing for display. _“HTML” is needed for a programmer to use this variable effectively._
* `NSAttributedString *titleAttributedString`: A title, already formatted for display. _`AttributedString` hints that this value is not just a vanilla title, and adding it could be a reasonable choice depending on context._
* `NSDate *now`: _No further clarification is needed._
* `NSDate *lastModifiedDate`: Simply `lastModified` can be ambiguous; depending on context, one could reasonably assume it is one of a few different types.
* `NSURL *URL` vs. `NSString *URLString`: In situations when a value can reasonably be represented by different classes, it is often useful to disambiguate in the variable’s name.
* `NSString *releaseDateString`: Another example where a value could be represented by another class, and the name can help disambiguate.

Single letter variable names should be avoided except as simple counter variables in loops.

Asterisks indicating a type is a pointer should be “attached to” the variable name. **For example,** `NSString *text` **not** `NSString* text` or `NSString * text`, except in the case of constants (`NSString * const KBConstantString`).

Property definitions should be used in place of naked instance variables whenever possible. Direct instance variable access should be avoided except in initializer methods (`init`, `initWithCoder:`, etc…), `dealloc` methods and within custom setters and getters. For more information, see [Apple’s docs on using accessor methods in initializer methods and `dealloc`](https://developer.apple.com/library/mac/documentation/Cocoa/Conceptual/MemoryMgmt/Articles/mmPractical.html#//apple_ref/doc/uid/TP40004447-SW6).

**For example:**

```objc
@interface KBLabel: NSObject
@property NSString *text;
@end
```

**Not:**

```objc
@interface KBLabel : NSObject {
  NSString *text
}
```

## Naming

Apple naming conventions should be adhered to wherever possible, especially those related to [memory management rules](https://developer.apple.com/library/mac/#documentation/Cocoa/Conceptual/MemoryMgmt/Articles/MemoryMgmt.html) ([NARC](http://stackoverflow.com/a/2865194/340508)).

Long, descriptive method and variable names are good.

**For example:**

```objc
UIButton *settingsButton;
```

**Not**

```objc
UIButton *setBut;
```

A two letter prefix (e.g., `KB`) should always be used for class names and constants. Constants should be camel-case with all words capitalized and prefixed by the related class name for clarity.

Properties and local variables should be camel-case with the leading word being lowercase.

Instance variables should be camel-case with the leading word being lowercase, and should be prefixed with an underscore. This is consistent with instance variables synthesized automatically by LLVM.

### Categories

Categories may be used to concisely segment functionality and should be named to describe that functionality.

**For example:**

```objc
@interface UIViewController (KBMedia)
@interface NSString (KBFormatting)
```

**Not:**

```objc
@interface KBStorage (private)
@interface NSString (KBAdditions)
```

Methods and properties added in categories should be named with an app- or organization-specific prefix. This avoids unintentionally overriding an existing method, and it reduces the chance of two categories from different libraries adding a method of the same name. (The Objective-C runtime doesn’t specify which method will be called in the latter case, which can lead to unintended effects.)

**For example:**

```objc
@interface NSArray (KBAccessors)
- (id)kb_objectOrNilAtIndex:(NSUInteger)index;
@end
```

**Not:**

```objc
@interface NSArray (KBAccessors)
- (id)objectOrNilAtIndex:(NSUInteger)index;
@end
```

## Comments

When they are needed, comments should be used to explain **why** a particular piece of code does something. Any comments that are used must be kept up-to-date or deleted.

Block comments should generally be avoided, as code should be as self-documenting as possible, with only the need for intermittent, few-line explanations. This does not apply to those comments used to generate documentation.

## init and dealloc

`dealloc` methods should be placed at the top of the implementation, directly after the `@synthesize` and `@dynamic` statements. `init` should be placed directly below the `dealloc` methods of any class.

`init` methods should be structured like this:

```objc
- (instancetype)init {
  if ((self = [super init])) {
    // Init
  }
  return self;
}
```

## Literals

`NSString`, `NSDictionary`, `NSArray`, and `NSNumber` literals should be used whenever creating immutable instances of those objects. Pay special care that `nil` values not be passed into `NSArray` and `NSDictionary` literals, as this will cause a crash.

**For example:**

```objc
NSArray *names = @[@"Brian", @"Matt", @"Chris", @"Alex", @"Steve", @"Paul"];
NSDictionary *productManagers = @{@"iPhone" : @"Kate", @"iPad" : @"Kamal", @"Mobile Web" : @"Bill"};
NSNumber *shouldUseLiterals = @YES;
NSNumber *buildingZIPCode = @10018;
```

**Not:**

```objc
NSArray *names = [NSArray arrayWithObjects:@"Brian", @"Matt", @"Chris", @"Alex", @"Steve", @"Paul", nil];
NSDictionary *productManagers = [NSDictionary dictionaryWithObjectsAndKeys: @"Kate", @"iPhone", @"Kamal", @"iPad", @"Bill", @"Mobile Web", nil];
NSNumber *shouldUseLiterals = [NSNumber numberWithBool:YES];
NSNumber *buildingZIPCode = [NSNumber numberWithInteger:10018];
```

## Constants

Constants are preferred over in-line string literals or numbers, as they allow for easy reproduction of commonly used variables and can be quickly changed without the need for find and replace. Constants should be declared as `static` constants and not `#define`s unless explicitly being used as a macro.

**For example:**

```objc
static const CGFloat KBThumbnailHeight = 50.0;
```

**Not:**

```objc
#define thumbnailHeight 2
```

## Enumerated Types

When using `enum`s, use the new fixed underlying type specification, which provides stronger type checking and code completion. The SDK includes a macro to facilitate and encourage use of fixed underlying types: `NS_ENUM()`.

**Example:**

```objc
typedef NS_ENUM (NSInteger, KBButtonStyle) {
  KBButtonStyleDefault,
  KBButtonStylePrimary,
  KBButtonStyleDanger,
  KBButtonStyleWarning,
};
```

## Bitmasks

When working with bitmasks, use the `NS_OPTIONS` macro.

**Example:**

```objc
typedef NS_OPTIONS (NSInteger, KBTextOptions) {
  KBTextOptionsStrong = 1 << 1,
  KBTextOptionsMonospace = 1 << 2,
  KBTextOptionsSmall = 1 << 3,
  KBTextOptionsDanger = 1 << 4,
};
```

## Booleans

**For an object pointer:**

```objc
if (!someObject) {
}

if (!!someObject) {
}
```

**For a `BOOL` value:**

```objc
if (isAwesome)
if (!someNumber.boolValue)
```

**Not:**

```objc
if (isAwesome == YES) // Never do this.
```

## Singletons

Don't use Singletons except for AppDelegate (or NSApp).

## Thanks

This guide is a modified version of the Objective-C Style Guide used by The New York Times.
