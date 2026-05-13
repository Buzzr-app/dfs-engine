# Buzzr v3 Shadow Mode

Use this before changing user-visible settlement in the Buzzr app.

## Goal

Run current Buzzr settlement and v3 policy settlement side by side, store the comparison, and only promote v3 once parity is high enough across real slips.

## Adapter Path

1. Convert the existing Buzzr `CreateDfsBetInput` shape with `adaptBuzzrBetInput(...)`.
2. Keep the production result as the user-visible settlement.
3. Run `createDfsEngine().settleEntry(...)` with the same stats, statuses, provider provenance, and clock.
4. Record a shadow comparison payload with:
   - `status`
   - `multiplier`
   - `payout`
   - `adjustments`
   - `pendingReasons`
   - `policyVersion`
   - `sourceRefs`
   - `confidence`
   - `explanationCodes`
   - `auditTrail`

## Acceptance

- PrizePicks and Underdog golden fixtures match current production behavior.
- No user-visible result changes while shadow mode is active.
- Any mismatch stores both raw inputs and both settlement outputs for review.
- New books stay custom or draft until official rules, payout examples, and real slip parity are verified.
