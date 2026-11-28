<!-- PR template — merge-ready gate policy. Source of truth: ZEMA-3783 (CEO provisional policy, ratified 2026-10-05). -->

## Related Issue

<!-- Link to the ZEMA ticket this PR resolves -->

## Summary

<!-- What changed and why -->

## Testing

<!-- How it was tested: E2E / manual / unit tests -->

## Merge-Readiness Checklist

Per [ZEMA-3783](https://github.com/zemyalpha/taronyang/issues) CEO provisional policy (effective 2026-10-05), merge-ready = **QA pass + CI pass**. Human merge approval is always required — agents never merge PRs themselves.

- [ ] QA testing passed (QAEngineer subtask confirmed)
- [ ] CI passes (GitHub Actions)
- [ ] CodeRabbit reviewed — **N/A while the CodeRabbit GitHub App is absent** (zero bot activity verified across all PRs, incl. #252). This axis auto-restores the moment the App is installed.
- [ ] No breaking changes

### Policy revert triggers (ZEMA-3783)

1. CodeRabbit App installed → 3-axis gate (QA + CI + CodeRabbit) auto-restores; remove the N/A clause above.
2. Board rejects on approval card `a9d15e90` or interaction `1a4f011a` or the retroactive ratification card → immediate revert to 3-axis gate.
3. Board remains unresponsive → re-escalation 60 days after 2026-10-05.
