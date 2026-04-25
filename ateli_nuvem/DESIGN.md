# Design System Strategy: The Ethereal Artisan

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Digital Atelier."** 

This system transcends the utilitarian nature of SaaS to provide a workspace that feels as tactile and intentional as a physical craft studio. We are moving away from the "standard dashboard" look by embracing a **Soft-Minimalist/Neumorphic hybrid**. The experience is defined by airy compositions, high-end iPhone-inspired tactility, and a "cloud-like" lightness that reduces cognitive load for artisans. 

By leveraging intentional asymmetry, expansive whitespace, and a departure from traditional rigid containment, we create an environment that feels premium, professional, and curated.

---

## 2. Colors & Surface Philosophy

The palette is rooted in cold, sophisticated grays and pure whites, accented by the muted, authoritative tones of slate and charcoal.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section off the UI. Separation must be achieved through:
- **Background Tonal Shifts:** Utilizing `surface` vs. `surface-container-low`.
- **Soft Shadows:** Using the elevation system to define boundaries.
- **Negative Space:** Allowing whitespace to act as the primary structural element.

### Surface Hierarchy & Nesting
Treat the UI as a series of stacked, physical layers. We use the surface-container tokens to create "depth-based" nesting:
- **App Canvas:** `background` (#f7f9fc)
- **Primary Page Sections:** `surface-container-low` (#f0f4f8)
- **Primary Cards/Interactive Containers:** `surface-container-lowest` (#ffffff)
- **In-Card Controls:** `surface-container-high` (#e1e9f0)

### The "Glass & Gradient" Rule
To elevate the system beyond a flat template, use **Glassmorphism** for floating elements (e.g., Modals, Navigation Bars, or Tooltips). 
- **Recipe:** `surface` color at 70% opacity + `backdrop-blur: 20px`.
- **Signature Accents:** Apply a subtle linear gradient (from `primary` to `primary-container`) on high-priority CTAs to provide a sense of "visual soul."

---

## 3. Typography
We utilize **Manrope** for its sophisticated, geometric balance, echoing the timelessness of Campton.

| Role | Token | Size | Weight | Intent |
| :--- | :--- | :--- | :--- | :--- |
| **Display** | `display-lg` | 3.5rem | 600 | Hero editorial statements |
| **Headline** | `headline-md` | 1.75rem | 500 | Main section titles |
| **Title** | `title-md` | 1.125rem | 500 | Card headings / Sub-sections |
| **Body** | `body-md` | 0.875rem | 400 | Primary reading font |
| **Label** | `label-md` | 0.75rem | 600 | Micro-copy and metadata |

**Editorial Note:** Use high-contrast scale transitions. Pair a `display-lg` header with a `body-md` description to create an "Editorial Boutique" feel rather than a technical one.

---

## 4. Elevation & Depth
Depth is not an effect; it is information. We achieve hierarchy through **Tonal Layering** and **Ambient Shadows**.

### The Layering Principle
Place `surface-container-lowest` cards on `surface-container-low` backgrounds. This creates a "natural lift" that mimics fine paper on a cool stone desk.

### Ambient Shadows
For floating components (Action Buttons, Modals), use extra-diffused shadows:
- **Shadow Token:** `box-shadow: 0 20px 40px rgba(41, 52, 58, 0.06);`
- **The Tint Rule:** Never use pure black for shadows. Use a low-opacity version of `on-surface` (#29343a) to ensure the shadow feels like an ambient occlusion rather than a "drop shadow."

### The "Ghost Border" Fallback
If a boundary is required for accessibility, use a **Ghost Border**: `outline-variant` (#a8b3bb) at **15% opacity**. High-contrast, 100% opaque borders are forbidden.

---

## 5. Components

### Buttons
- **Primary:** `primary` (#586062) background with `on-primary` text. Radius: `full`. No border.
- **Secondary:** `surface-container-lowest` background with a soft ambient shadow. Radius: `full`.
- **Tertiary:** No background. `primary` text. Used for low-priority actions to maintain layout "air."

### Cards
- **Construction:** `surface-container-lowest` (#ffffff).
- **Radius:** `xl` (1.5rem) for main cards; `lg` (1rem) for nested items.
- **Rules:** No dividers. Use vertical spacing (minimum 24px) to separate content sections within the card.

### Input Fields
- **Style:** `surface-container-low` (#f0f4f8) background with a "soft inset" feel (using a 1px `outline-variant` at 10% opacity). 
- **Focus:** Transition background to `surface-container-lowest` and apply a soft glow using `primary` at 5% opacity.

### Navigation Sidebar
- **Visuals:** Use a vertical "Glassmorphism" strip. Icons should be linear (2px stroke) using the `primary` token.
- **Active State:** A soft `surface-container-highest` pill behind the icon, mimicking a recessed button.

### Artisan-Specific: The "Craft Progress" Chip
- A specialized chip for artisans to track production stages. Uses `tertiary-container` for the background and `on-tertiary-container` for text, providing a subtle, non-alerting distinction from standard actions.

---

## 6. Do's and Don'ts

### Do
- **Do** prioritize "Breathing Room." If a layout feels crowded, increase the padding by 50%.
- **Do** use large corner radii (`xl` or `full`) to evoke the friendly, premium feel of high-end consumer hardware.
- **Do** use "Soft UI" transitions (300ms ease-in-out) for all hover states.

### Don't
- **Don't** use pure black (#000000) anywhere in the system. Use `on-background` (#29343a).
- **Don't** use traditional grid lines or 1px dividers. If you feel the need for a line, use a background color change instead.
- **Don't** use harsh, high-intensity shadows. If the shadow is clearly visible as a "shape," it is too dark. It should feel like a "glow" of darkness.
- **Don't** use standard "system" icons. Use custom linear icons with rounded terminals to match the `manrope` typeface.