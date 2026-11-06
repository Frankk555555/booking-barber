# Design context — Booking Barber

Thai-first appointment app for one barber shop. The accepted direction is light, simple, and usable on mobile, including a 320px viewport.

- Customer booking and appointment management: sand `#EFE4D2`, navy `#204464`, off-white `#FAF7F0`, muted text `#566570`, and borders `#CEC5B6`. Navy appointment summary is the single visual anchor; service choices use rows instead of nested cards.
- Customer typography uses locally bundled Sarabun regular and semibold, with its OFL license in `apps/web/public/fonts`. No runtime font request is required. Admin retains its existing system fonts, warm paper surfaces and terracotta controls.
- Five customer steps: services, barber, date/time, contact, confirmation.
- Shared local primitives: Button, Modal, loading/error/empty states, receipt, hours editor and slot picker.
- Admin uses daily/weekly calendars and a sortable TanStack Table.
- Keep pending actions disabled, preserve contact data on slot conflicts, and show explicit cancellation confirmation.
- CSS variables and native cascade layers live in `apps/web/src/app/globals.css`.
- Customer tokens and responsive styles live in `apps/web/src/app/customer.css`, scoped to `.customer-experience` to keep the admin appearance separate.
- 21st catalog search returned HTTP 401. No external component code was retrieved. `21st review` ran; its remaining findings are informational color-token suggestions in CSS.

See `design.json` for extracted sources and the recorded user-approved decisions.
