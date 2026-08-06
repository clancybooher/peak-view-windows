# Future Change: Google Reviews Trust Badge

## What this is

The trust bar on index.html has a placeholder slot for a Google Reviews star rating. This note explains what to add once the Google Business Profile is verified and reviews start coming in.

## When to implement

- Google Business Profile is verified
- At least 5 genuine reviews collected (do not fabricate)
- Average rating is 4.5 stars or higher

## Where to add it

In [index.html](../index.html), inside the `.trust-bar__inner` div, add a new `.trust-badge` element:

```html
<div class="trust-badge">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="color:#F4B400" aria-hidden="true">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
  <span><strong>4.9★</strong> Google Reviews</span>
</div>
```

## Also add to testimonials section

Once real reviews exist, replace the placeholder testimonial cards in index.html with real ones. The placeholder cards are marked with HTML comments: `<!-- PLACEHOLDER testimonial N — replace with real review -->`.

## Testimonials section note

The current testimonials are **placeholder content only**. They must be replaced with real verified customer quotes before the section is published/promoted. Each card has an HTML comment marking it clearly.

## Google Analytics

Once GA4 is set up, uncomment the placeholder in the `<head>` of all three HTML files (index.html, windows.html, doors.html) and replace `G-XXXXXXXXXX` with the real measurement ID.

## Google Search Console

Once site ownership is verified, add the meta verification tag to all three HTML files. Placeholder is already in the `<head>` as a comment.
