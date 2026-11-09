Project Name: Side-by-Side (Bureaucracy Navigators)

1. Project Overview

This web application connects individuals facing mental health challenges (who are entitled to state benefits/allowances) with volunteers who assist them in navigating the bureaucracy.
The core philosophy is "Side-by-Side" assistance: volunteers do NOT act as legal representatives and do NOT hold Power of Attorney. They provide technical, organizational, and moral support (e.g., helping organize paperwork, typing on the keyboard while the user dictates, sitting with them during phone calls).

2. Core Legal & Security Limitations (STRICT RULES)

NO Medical Data Storage: The app is purely a matching and coordination platform. Users and volunteers MUST NOT be able to upload, store, or share sensitive medical documents (PDFs, images of diagnoses, etc.) on this platform.

NO Legal Representation: Volunteers are standard citizens, not lawyers. The UI must reflect this (e.g., use terms like "Support", "Accompany", "Assist", NEVER "Represent", "Claim", or "File for you").

PII Protection: The volunteer dashboard must hide the full identity (last name, exact address) of the help-seeker until the volunteer explicitly accepts the ticket.

3. Design System & Trauma-Informed UI

Zero Friction: Forms must be extremely short. Reduce cognitive load. Do not use long text inputs if a simple icon/button choice will do.

Color Palette: Calming, soothing colors. Pastel greens, soft blues, warm off-whites. STRICTLY NO harsh reds, bright yellows, or alarming flashing animations.

Typography: Large, highly readable fonts. Clean and minimal.

Tone of Voice: Warm, encouraging, non-bureaucratic, and respectful (e.g., "Let's do this together", "We are here to help").

Safe Exit: Every step of a flow has a calm, always-visible Exit button. It asks once for confirmation ("Leave the form? Your answers won't be saved.") and returns home. Progress is not saved.

4. Tech Stack Preferences

Next.js (App Router)

Tailwind CSS (for styling, using the calming color palette)

React Hook Form (for easy, minimal form handling)

Lucide React (for clear, simple icons)

5. Main Routes

/ - Landing Page

/ask-for-help - The zero-friction intake flow for help-seekers

/volunteer - Registration & Dashboard for volunteers

/guide - Simple, jargon-free rights guide

/terms - Clear disclaimer about the scope of assistance
