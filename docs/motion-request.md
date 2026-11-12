# User motion request

User request, 2026-11-12: “make sure for everything you've built so far that app elements have cool transitions, effects and motion graphics”; reference https://github.com/Barty-Bart/motion-graphics. “spawn gpt luna agents for doing the heavy work, you'll orchestrate”.

Scope: the existing Comradia native/web app, including auth, code verification, all onboarding steps, Discover, match celebration, match list, chat, Profile/photos/notifications, safety sheets, navigation and shared interactive controls. Preserve existing brand, content, backend semantics, test IDs and accessibility. The separate static marketing website is outside this app request.

The reference repository contains product-explainer/video skills. Adapt its visual continuity and reacting-interface principles to live React Native/Reanimated interactions; no rendered video, audio, tracking or video dependency is required in the app.

Motion direction: restrained crisp ease-out press feedback and selection changes, connected card transitions for intentional user actions, a finite signature match celebration, readable error/success transitions and notification entry/dismissal. Preserve immediately usable controls. Avoid repetitive leaf-level reveals and unrelated visual redesign. Existing Reanimated 4 and vector assets are sufficient.

Every surface must specify reduced-motion behavior, hidden-but-mounted behavior, trigger sources (user/data hydration/refetch/account change), cancellation/unmount, focus timing and web/native parity. Validate on the actual app using named journeys and recordings where available; static/unit proof alone must not be called motion-verified.
