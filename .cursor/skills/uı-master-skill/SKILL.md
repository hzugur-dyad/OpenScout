---
name: pro-ui-ux-design
description: Guides the generation of UI/UX designs to ensure professional, modern, and minimal aesthetics without the "AI vibe." Use when building frontend interfaces, styling components, orchestrating layouts, or defining CSS animations.
---

# Professional UI/UX Design Guidelines

Follow these strict guidelines to produce high-quality, modern, and minimal user interfaces that avoid amateur or "AI-generated" aesthetics.

## 1. Color and Theming
* [cite_start]Avoid AI-chosen bright, clashing colors and emojis[cite: 256, 257].
* [cite_start]Do not rely on the 60-30-10 rule for complex product UIs; instead, utilize a neutral foundation with roughly four background layers, one or two strokes, and three text variants[cite: 207, 208].
* [cite_start]Use 98% to 99% off-whites rather than pure white for backgrounds to avoid a washed-out look[cite: 207, 210].
* [cite_start]Utilize darker or lighter versions of your accent color for backgrounds instead of pure black or pure white[cite: 346, 347].
* [cite_start]Use the OKLCH palette system to generate semantic and chart colors with consistent perceived brightness[cite: 218].
* [cite_start]For dark mode, double the distance in brightness between background layers (4-6% difference) compared to light mode to maintain visual distinction[cite: 214, 215].

## 2. Typography
* [cite_start]Establish visual hierarchy using a combination of font weights and font colors, not just font size[cite: 285, 286].
* [cite_start]Limit designs to a maximum of two font weights, ensuring they are separated by at least one weight level[cite: 286].
* [cite_start]Use a primary text color alongside a reduced opacity variant (45% to 70%) for secondary text[cite: 286].
* [cite_start]Never use display or handwritten fonts for small paragraph text[cite: 697].
* [cite_start]Apply a 1.27 multiplier (the square root of the golden ratio) to scale font sizes mathematically across the interface[cite: 707].
* [cite_start]Set line heights to approximately 150% for paragraph text and 110% to 130% for heading text[cite: 712, 713].
* [cite_start]Apply a -2% to -4% kerning (letter spacing) adjustment to large text over 70 pixels to fix visual gaps[cite: 332, 333].

## 3. Layout and Minimalism
* [cite_start]Adhere strictly to a 4-pixel or 8-pixel base grid for all spacing adjustments[cite: 345].
* [cite_start]Remove redundant container lines and dividers; use empty whitespace to separate and group elements naturally[cite: 288, 344].
* [cite_start]Maintain consistent corner radiuses across components, using 10 pixels for smaller UI elements[cite: 472, 473].
* [cite_start]When nesting rounded elements, calculate the inner corner radius by subtracting the distance between the elements from the outer corner radius[cite: 334, 335].
* [cite_start]Utilize a single, consistent SVG icon library (like Phosphor, Lucide, or Feather) to prevent mismatched stroke widths and styles[cite: 256, 290, 475].

## 4. Shadows and Effects
* [cite_start]Remove harsh default drop shadows and avoid overusing glows or gradients[cite: 469, 470].
* [cite_start]If drop shadows are necessary, keep the X value less than or equal to the Y value[cite: 297].
* [cite_start]Set the shadow blur to 1.3 to 2 times the Y value and reduce the opacity to 15-20%[cite: 297].
* [cite_start]Instead of drop shadows on light mode, define card edges using a subtle border that is roughly 85% white[cite: 210].

## 5. Interactions and Animations
* [cite_start]Implement optimistic UI patterns that assume server requests will succeed, removing awkward loading pauses for immediate visual feedback[cite: 226, 581].
* [cite_start]Apply progressive disclosure to hide complex elements until the user actively needs or requests them[cite: 230, 358].
* [cite_start]Design hover states by using a slightly lighter or brighter version of the component's base color[cite: 15].
* [cite_start]Design active or pressed states by using a slightly darker version of the base color[cite: 15].
* [cite_start]Never use linear easing for animations; utilize custom non-linear easing curves to give elements natural momentum and bounce[cite: 534].