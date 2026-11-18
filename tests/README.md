# Regression tests

Run `npm test` from the orb directory. This builds current source, checks the
public declaration's optional component lookup, then runs Node's built-in test
runner. No additional dependencies or browser are required.

Coverage includes destruction, recycled IDs, double destruction, unallocated
IDs, stale and foreign handles, duplicate component replacement, missing lookups, query argument order,
membership clearing, storage reclamation, all three-entity removal orders,
query-time destruction, and linear query traversal. The complexity test counts
dense-array reads using internal pools rather than unreliable wall-clock timings.

Destruction and nested queries on the same world are prohibited during iteration.
Tests verify that rejection preserves components and allocation, that callback
exceptions release the guard, that rejected nested queries leave the outer guard
active, and that separate worlds remain independent. Destruction after iteration
is allowed. These tests do not impose a prohibition on creation or addition.

The earlier orbtest movement and missing-script findings belong to the game,
not this package. These tests do not depend on a sibling orbtest checkout.
Entities are generation-checked handles. Tests cover stale handles that share a
slot with a recycled entity, forged or foreign handles, and conflicting `add`
calls, which must throw without modifying component storage. `World.add` rejects
destroyed, stale, foreign, and forged handles, while `World.destroy` ignores them.
