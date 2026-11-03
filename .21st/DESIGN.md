# Design context — Booking Barber

Thai-first appointment app for one barber shop. The accepted direction is light, simple, and usable on mobile, including a 320px viewport.

- Warm paper background, white panels, terracotta primary action and visible keyboard focus.
- System Thai fonts; no external font request required to build or run locally.
- Five customer steps: services, barber, date/time, contact, confirmation.
- Shared local primitives: Button, Modal, loading/error/empty states, receipt, hours editor and slot picker.
- Admin uses daily/weekly calendars and a sortable TanStack Table.
- Keep pending actions disabled, preserve contact data on slot conflicts, and show explicit cancellation confirmation.
- CSS variables and native cascade layers live in `apps/web/src/app/globals.css`.
- 21st catalog search returned HTTP 401. No external component code was retrieved. `21st review` ran; its remaining findings are informational color-token suggestions in CSS.

See `design.json` for extracted sources and the recorded user-approved decisions.