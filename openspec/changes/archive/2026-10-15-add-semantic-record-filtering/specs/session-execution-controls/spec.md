# Spec Delta

## MODIFIED Requirements

### Requirement: Conservative lifecycle invalidation

Successful tree navigation SHALL disable execution and expire current-generation handles and reuse without rewinding the ledger. Cancelled navigation MAY retain handles but SHALL NOT silently restore authorization revoked before navigation. Reload, reopen, shutdown, fork, clone, new session, and session switching SHALL invalidate old execution facades; replacement runtimes SHALL start disabled with no transferred mutable progress. Compaction alone SHALL preserve live-generation workspaces and accounting. Lifecycle gating and draining SHALL cover semantic parent orchestration as well as native child promises so late callbacks cannot dispatch into an expired or replacement runtime.

#### Scenario: Reopen or reload
- **WHEN** a saved session is reopened or its extensions reloaded
- **THEN** old generic batch handles return batch_expired, old semantic operation handles return search_expired, old facades return runtime_expired, and execution requires fresh authorization

#### Scenario: Forked history
- **WHEN** a new session inherits transcript entries from a parent
- **THEN** parent authorization, handles, and grant events do not become active state in the new session

#### Scenario: Compaction
- **WHEN** the current session is compacted without replacement
- **THEN** live batches remain accessible and cumulative charges remain unchanged

#### Scenario: Parent resumes after navigation begins
- **WHEN** a child settles while successful navigation is invalidating its parent generation
- **THEN** no subsequent parent child starts and the resulting old semantic handle is expired without refunding started work
