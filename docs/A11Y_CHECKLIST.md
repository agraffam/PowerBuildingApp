# Accessibility checklist (manual)

Run these occasionally on real devices, especially after navigation or form changes.

1. **Keyboard**: Tab through header nav, Account, Settings, login/register; ensure focus order is logical and focus is visible.
2. **Activate**: Use Enter/Space on buttons and links; dialogs and sheets should trap focus and close with Escape where applicable.
3. **Screen reader**: VoiceOver (iOS/macOS): landmark “Main navigation”, headings (`h1` per page), and form labels on Account and auth pages.
4. **Touch targets**: Primary actions (Start workout, Save) remain large enough on mobile (see existing `min-h-*` patterns).
5. **Contrast**: Verify destructive/success text in light and dark theme.

Optional automation: add `@axe-core/playwright` on `/`, `/account`, and `/login` when you want CI coverage.
